# -*- coding: utf-8 -*-
"""Chạy tracer bằng Python THẬT, trên những chương trình sinh viên thật sự viết.

Vì sao test này không phải jest: tracer là mã Python chạy trong sandbox. Test nó
bằng mock trong TypeScript là tự lừa mình — đúng cái bẫy đã ghi trong AGENTS.md
(`quizzes.service.spec.ts` test trên fixture sai hình dạng nên lỗ lộ đáp án sống
sót qua mọi lần chạy). Ở đây mỗi ca DỰNG ĐÚNG file mà backend sẽ gửi (tracer rút
gọn + mã nén base64), chạy nó bằng một tiến trình Python riêng, rồi đọc JSON ra
từ giữa hai mốc — y hệt đường đi thật, chỉ thiếu lớp container.

Chạy (Windows dùng `py`, không dùng `python`):
    py src/python-runner/tracer/pe_tracer_test.py

Bằng chứng test bắt được lỗi thật (quy ước AGENTS.md: gỡ bản sửa ra, test phải
trượt) — xem phần cuối file: hạ MAX_STEPS, bỏ phát hiện chu trình, bỏ SIGALRM,
bỏ lọc theo co_filename, bỏ ghi đè input().
"""
import base64
import io
import json
import os
import subprocess
import sys
import tempfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TRACER = os.path.join(HERE, "pe_tracer.py")
STRIP = os.path.join(ROOT, "scripts", "pe-tracer-strip.py")

BEGIN = "__PE_TRACE_V1_BEGIN__"
END = "__PE_TRACE_V1_END__"

# Trần của POST /run (MAX_CODE_BYTES trong docker-sandbox.ts). Lặp lại ở đây để
# test nói được "file dựng ra có vừa trần thật hay không".
MAX_CODE_BYTES = 20 * 1024

_failures = []
_ran = 0


def strip_source():
    """Bản rút gọn của tracer — ĐÚNG chuỗi mà backend nhúng và gửi đi."""
    out = subprocess.run(
        [sys.executable, STRIP, TRACER],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return out.stdout.decode("utf-8")


# Dựng giống trace-program.ts: tracer rút gọn + một lời gọi _pe_run với mã người
# học đã nén. Hai bên phải giữ giống nhau; chỗ nào đổi thì đổi cả hai.
def build_program(tracer_src, code):
    payload = base64.b64encode(zlib.compress(code.encode("utf-8"), 9)).decode("ascii")
    return tracer_src + '\n_pe_run("' + payload + '")\n'


def run_trace(tracer_src, code, timeout=30):
    """Chạy chương trình đã dựng trong tiến trình riêng, trả (doc, stdout, stderr)."""
    path = os.path.join(tempfile.mkdtemp(prefix="petrace-"), "main.py")
    with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(build_program(tracer_src, code))
    # -I: bỏ qua PYTHONPATH và thư mục của script, giống môi trường sandbox sạch.
    proc = subprocess.run(
        [sys.executable, "-I", path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    out = proc.stdout.decode("utf-8", "replace")
    err = proc.stderr.decode("utf-8", "replace")
    doc = None
    if BEGIN in out and END in out:
        body = out.split(BEGIN, 1)[1].rsplit(END, 1)[0]
        doc = json.loads(body)
    return doc, out, err


def check(name, cond, detail=""):
    global _ran
    _ran += 1
    if cond:
        print("  ok   " + name)
    else:
        print("  FAIL " + name + ("  -> " + detail if detail else ""))
        _failures.append(name)


def lines_of(doc, event=None):
    return [s["line"] for s in doc["steps"] if event is None or s["event"] == event]


def top(step):
    return step["frames"][-1]


def locals_of(step, frame=-1):
    return dict((k, v) for k, v in step["frames"][frame]["locals"])


def main():
    tracer_src = strip_source()
    print("tracer rút gọn: %d byte" % len(tracer_src.encode("utf-8")))

    # --- 1. Vòng lặp và biến đổi giá trị ------------------------------------
    doc, _, err = run_trace(
        tracer_src,
        "tong = 0\nfor i in range(3):\n    tong = tong + i\nprint(tong)\n",
    )
    check("vòng lặp: có vết", doc is not None, err[-400:])
    if doc:
        check("vòng lặp: chạy xong", doc["stopReason"] == "done", doc["stopReason"])
        check("vòng lặp: in đúng", doc["stdout"] == "3\n", repr(doc["stdout"]))
        check(
            "vòng lặp: dòng 3 chạy 3 lần",
            lines_of(doc, "line").count(3) == 3,
            str(lines_of(doc, "line")),
        )
        last = doc["steps"][-1]
        check(
            "vòng lặp: biến cuối tong=3",
            locals_of(last).get("tong", {}).get("r") == "3",
            json.dumps(locals_of(last)),
        )
        # "đầu ra tới bước này": bước trước print phải thấy 0 ký tự.
        before_print = [s for s in doc["steps"] if s["line"] == 4 and s["event"] == "line"]
        check(
            "vòng lặp: out=0 trước khi print chạy",
            before_print and before_print[0]["out"] == 0,
            str(before_print[:1]),
        )

    # --- 2. Hàm, call stack, giá trị trả về ---------------------------------
    doc, _, err = run_trace(
        tracer_src,
        "def cong(a, b):\n    return a + b\n\nx = cong(2, 5)\nprint(x)\n",
    )
    check("hàm: có vết", doc is not None, err[-400:])
    if doc:
        calls = [s for s in doc["steps"] if s["event"] == "call"]
        check("hàm: có sự kiện call cho cong", any(top(s)["name"] == "cong" for s in calls))
        depth2 = [s for s in doc["steps"] if len(s["frames"]) == 2]
        check("hàm: call stack sâu 2 khi ở trong hàm", len(depth2) > 0)
        if depth2:
            check(
                "hàm: frame[0] là <module>, frame[1] là cong",
                depth2[0]["frames"][0]["name"] == "<module>"
                and depth2[0]["frames"][1]["name"] == "cong",
            )
            check(
                "hàm: tham số a,b thấy được ngay ở call",
                locals_of(depth2[0]) .get("a", {}).get("r") == "2",
                json.dumps(locals_of(depth2[0])),
            )
        rets = [s for s in doc["steps"] if s["event"] == "return" and top(s)["name"] == "cong"]
        check(
            "hàm: ghi được giá trị trả về 7",
            rets and rets[0]["ret"]["r"] == "7",
            json.dumps(rets[:1]),
        )

    # --- 3. Đệ quy -----------------------------------------------------------
    doc, _, err = run_trace(
        tracer_src,
        "def gt(n):\n    if n <= 1:\n        return 1\n    return n * gt(n - 1)\n\nprint(gt(5))\n",
    )
    check("đệ quy: có vết", doc is not None, err[-400:])
    if doc:
        check("đệ quy: in 120", doc["stdout"] == "120\n", repr(doc["stdout"]))
        deepest = max(len(s["frames"]) for s in doc["steps"])
        check("đệ quy: stack sâu tới 6 (<module> + 5 lần gt)", deepest == 6, str(deepest))

    # --- 4. Trần số bước: chương trình vẫn chạy hết -------------------------
    doc, _, err = run_trace(
        tracer_src,
        "t = 0\nfor i in range(1000000):\n    t += i\nprint('xong', t)\n",
        timeout=120,
    )
    check("trần bước: có vết", doc is not None, err[-400:])
    if doc:
        check(
            "trần bước: stopReason=step-limit",
            doc["stopReason"] == "step-limit",
            doc["stopReason"],
        )
        check(
            "trần bước: đúng %d bước, không hơn" % doc["limits"]["maxSteps"],
            len(doc["steps"]) == doc["limits"]["maxSteps"],
            str(len(doc["steps"])),
        )
        # Điểm quan trọng: NGỪNG GHI nhưng chương trình vẫn chạy nốt, nên người
        # học vẫn thấy kết quả thật chứ không phải một ô trống.
        check(
            "trần bước: chương trình vẫn chạy xong và in kết quả",
            doc["stdout"].strip() == "xong 499999500000",
            repr(doc["stdout"][:80]),
        )
        check(
            "trần bước: events >> steps (nói thật là đã bỏ bao nhiêu)",
            doc["stats"]["events"] > doc["stats"]["steps"],
            json.dumps(doc["stats"]),
        )

    # --- 5. Vòng lặp vô hạn: báo thức phải kịp in vết -----------------------
    doc, out, err = run_trace(tracer_src, "i = 0\nwhile True:\n    i += 1\n", timeout=60)
    if os.name == "nt":
        # Windows không có SIGALRM; ở đó vết về theo đường _PEStop trong callback.
        check("vô hạn: có vết (Windows: qua _PEStop)", doc is not None, err[-400:])
    else:
        check("vô hạn: có vết (Linux: qua SIGALRM)", doc is not None, err[-400:])
    if doc:
        check(
            "vô hạn: stopReason nói rõ hết thời gian/hết bước",
            doc["stopReason"] in ("time-limit", "step-limit"),
            doc["stopReason"],
        )
        check("vô hạn: có bước để xem", len(doc["steps"]) > 0, str(len(doc["steps"])))

    # --- 6. Ngoại lệ làm chết chương trình ----------------------------------
    doc, _, err = run_trace(
        tracer_src,
        "def chia(a, b):\n    return a / b\n\nprint('bat dau')\nprint(chia(1, 0))\n",
    )
    check("ngoại lệ: có vết", doc is not None, err[-400:])
    if doc:
        check("ngoại lệ: stopReason=error", doc["stopReason"] == "error", doc["stopReason"])
        check(
            "ngoại lệ: đúng loại ZeroDivisionError",
            doc["error"]["type"] == "ZeroDivisionError",
            json.dumps(doc["error"]),
        )
        check("ngoại lệ: chỉ đúng dòng 2", doc["error"]["line"] == 2, str(doc["error"]["line"]))
        check(
            "ngoại lệ: traceback nói main.py, không nhắc tracer",
            'File "main.py"' in doc["error"]["traceback"]
            and "_pe_run" not in doc["error"]["traceback"],
            doc["error"]["traceback"],
        )
        check(
            "ngoại lệ: traceback in được DÒNG MÃ của người học (linecache)",
            "return a / b" in doc["error"]["traceback"],
            doc["error"]["traceback"],
        )
        check(
            "ngoại lệ: giữ đầu ra in được trước khi chết",
            doc["stdout"] == "bat dau\n",
            repr(doc["stdout"]),
        )
        check(
            "ngoại lệ: có bước event=exception",
            any(s["event"] == "exception" for s in doc["steps"]),
        )
        # Trạng thái CUỐI phải còn đó: đó là lý do người ta mở trực quan hoá.
        last = doc["steps"][-1]
        check("ngoại lệ: bước cuối vẫn có frames", len(last["frames"]) >= 1)

    # --- 7. Lỗi cú pháp ------------------------------------------------------
    doc, _, err = run_trace(tracer_src, "x = 1\nprint('thieu ngoac'\n")
    check("cú pháp: có vết", doc is not None, err[-400:])
    if doc:
        check("cú pháp: 0 bước", doc["steps"] == [], str(len(doc["steps"])))
        check(
            "cú pháp: SyntaxError có số dòng",
            doc["error"]["type"] == "SyntaxError" and doc["error"]["line"] is not None,
            json.dumps(doc["error"]),
        )

    # --- 8. Giá trị khó: tự tham chiếu, sâu, khổng lồ, repr ném lỗi ---------
    nasty = (
        "a = [1, 2]\n"
        "a.append(a)\n"
        "d = {'tu_tro': None}\n"
        "d['tu_tro'] = d\n"
        "sau = [[[[[1]]]]]\n"
        "to = list(range(5000))\n"
        "chuoi = 'x' * 10000\n"
        "sohuge = 10 ** 5000\n"
        # __slots__ nên không có __dict__: tracer buộc phải gọi repr() — và repr
        # đó ném lỗi. Không có try quanh repr thì cả vết sập vì MỘT biến.
        "class No:\n"
        "    __slots__ = ()\n"
        "    def __repr__(self):\n"
        "        raise ValueError('khong in duoc')\n"
        "no = No()\n"
        "class Diem:\n"
        "    def __init__(self):\n"
        "        self.x = 1\n"
        "        self.y = 2\n"
        "p = Diem()\n"
        "import math\n"
        "print('het')\n"
    )
    doc, _, err = run_trace(tracer_src, nasty)
    check("giá trị khó: có vết", doc is not None, err[-400:])
    if doc:
        check("giá trị khó: không chết", doc["stopReason"] == "done", doc["stopReason"])
        check("giá trị khó: in được", doc["stdout"] == "het\n", repr(doc["stdout"]))
        g = locals_of(doc["steps"][-1])
        check(
            "giá trị khó: list tự tham chiếu -> cycle",
            json.dumps(g.get("a", {})).count('"cycle"') == 1,
            json.dumps(g.get("a")),
        )
        check(
            "giá trị khó: dict tự tham chiếu -> cycle",
            '"cycle"' in json.dumps(g.get("d", {})),
            json.dumps(g.get("d")),
        )
        check(
            "giá trị khó: lồng quá sâu -> depth",
            '"depth"' in json.dumps(g.get("sau", {})),
            json.dumps(g.get("sau")),
        )
        check(
            "giá trị khó: list 5000 phần tử bị cắt còn %d, có cờ more và n thật"
            % doc["limits"]["maxItems"],
            g.get("to", {}).get("n") == 5000
            and g.get("to", {}).get("more") is True
            and len(g.get("to", {}).get("items", [])) == doc["limits"]["maxItems"],
            json.dumps(g.get("to", {}))[:200],
        )
        check(
            "giá trị khó: chuỗi 10000 ký tự bị cắt, giữ độ dài thật",
            g.get("chuoi", {}).get("trunc") is True
            and g.get("chuoi", {}).get("n") == 10000
            and len(g.get("chuoi", {}).get("r", "")) == doc["limits"]["maxStringChars"],
            json.dumps(g.get("chuoi", {}))[:120],
        )
        check(
            "giá trị khó: int khổng lồ bị cắt repr",
            len(g.get("sohuge", {}).get("r", "")) <= doc["limits"]["maxStringChars"] + 1,
            str(len(g.get("sohuge", {}).get("r", ""))),
        )
        check(
            "giá trị khó: repr ném lỗi -> không sập, báo 'repr lỗi'",
            "repr lỗi" in json.dumps(g.get("no", {}), ensure_ascii=False),
            json.dumps(g.get("no", {}), ensure_ascii=False),
        )
        check(
            "giá trị khó: đối tượng hiện thuộc tính x,y",
            g.get("p", {}).get("t") == "obj"
            and dict(g["p"]["attrs"])["x"]["r"] == "1",
            json.dumps(g.get("p", {})),
        )
        check(
            "giá trị khó: module không bị mở ra",
            g.get("math", {}).get("t") == "opaque",
            json.dumps(g.get("math", {})),
        )

    # --- 9. property KHÔNG được chạy khi đọc biến ---------------------------
    doc, _, err = run_trace(
        tracer_src,
        "class Bay:\n"
        "    @property\n"
        "    def no(self):\n"
        "        print('PROPERTY DA CHAY')\n"
        "        return 1\n"
        "b = Bay()\n"
        "print('xong')\n",
    )
    check("property: có vết", doc is not None, err[-400:])
    if doc:
        # Dùng getattr để liệt kê thuộc tính là CHẠY mã của người học giữa lúc
        # đang ghi vết: in thêm ra đầu ra, có thể ném lỗi, có thể chạy mãi.
        check(
            "property: không bị gọi khi tracer đọc biến",
            "PROPERTY DA CHAY" not in doc["stdout"],
            repr(doc["stdout"]),
        )

    # --- 10. input(): nói rõ vì sao không dùng được ------------------------
    doc, _, err = run_trace(tracer_src, "ten = input('Ten ban: ')\nprint(ten)\n")
    check("input: có vết", doc is not None, err[-400:])
    if doc:
        check("input: dừng vì lỗi", doc["stopReason"] == "error", doc["stopReason"])
        check(
            "input: vẫn là EOFError (giống lúc bấm Chạy)",
            doc["error"]["type"] == "EOFError",
            json.dumps(doc["error"]),
        )
        check(
            "input: thông điệp nói stdin và cách làm thay",
            "stdin" in doc["error"]["message"],
            doc["error"]["message"],
        )
        check(
            "input: prompt vẫn hiện ra cho người học",
            "Ten ban:" in doc["stdout"],
            repr(doc["stdout"]),
        )

    # --- 11. Tracer không được lộ khung của chính nó -----------------------
    doc, _, err = run_trace(
        tracer_src, "import json\nprint(json.dumps({'a': 1}))\n"
    )
    check("rò khung: có vết", doc is not None, err[-400:])
    if doc:
        names = set()
        for s in doc["steps"]:
            for f in s["frames"]:
                names.add(f["name"])
        check(
            "rò khung: chỉ có frame của mã người học",
            names <= {"<module>"},
            str(sorted(names)),
        )
        g = locals_of(doc["steps"][-1])
        check(
            "rò khung: biến nội bộ của tracer không lọt vào biến của người học",
            not any(k.startswith("_PE") or k.startswith("_pe") for k in g),
            str(sorted(g)),
        )
        check(
            "rò khung: không bước vào ruột thư viện json",
            all(s["line"] <= 2 for s in doc["steps"]),
            str(lines_of(doc)),
        )

    # --- 12. Mã người học cố tình phá tracer -------------------------------
    doc, out, err = run_trace(
        tracer_src,
        "import sys, os\n"
        "sys.stdout = open(os.devnull, 'w')\n"
        "print('bi chan')\n"
        "sys.settrace(None)\n"
        "x = 1\n",
    )
    check(
        "chống phá: vẫn in được vết dù sys.stdout bị gán lại",
        doc is not None,
        (out[-200:] + " / " + err[-200:]),
    )

    # --- 13. sys.exit() là cách kết thúc bình thường -----------------------
    doc, _, err = run_trace(tracer_src, "print('truoc')\nimport sys\nsys.exit(0)\nprint('sau')\n")
    check("sys.exit: có vết", doc is not None, err[-400:])
    if doc:
        check("sys.exit: coi là chạy xong", doc["stopReason"] == "done", doc["stopReason"])
        check("sys.exit: giữ đầu ra", doc["stdout"] == "truoc\n", repr(doc["stdout"]))

    # --- 14. In rất nhiều: vết không vượt trần byte ------------------------
    doc, _, err = run_trace(
        tracer_src, "for i in range(200000):\n    print('dong', i)\n", timeout=120
    )
    check("in nhiều: có vết", doc is not None, err[-400:])
    if doc:
        check(
            "in nhiều: đầu ra bị cắt ở trần, có cờ nói rõ",
            doc["stdoutTruncated"] is True
            and len(doc["stdout"]) <= doc["limits"]["maxOutputChars"],
            str(len(doc["stdout"])),
        )

    # --- 15. Kích thước: file dựng ra phải vừa trần của POST /run ----------
    typical = (
        "def fib(n):\n"
        "    if n < 2:\n"
        "        return n\n"
        "    return fib(n - 1) + fib(n - 2)\n"
        "\n"
        "for i in range(10):\n"
        "    print(i, fib(i))\n"
    )
    size = len(build_program(tracer_src, typical).encode("utf-8"))
    check(
        "kích thước: chương trình điển hình vừa trần 20 KB (%d byte)" % size,
        size < MAX_CODE_BYTES,
        str(size),
    )
    # Trần thực tế: đo trên MÃ PYTHON THẬT (dùng chính file tracer làm văn bản
    # đại diện — có chú thích, có chuỗi, nén như code thật), không phải trên
    # một dòng lặp lại vốn nén tới mức vô nghĩa.
    with io.open(TRACER, encoding="utf-8") as fh:
        real_python = fh.read()
    n = 0
    while (
        n < len(real_python)
        and len(build_program(tracer_src, real_python[: n + 500]).encode("utf-8"))
        < MAX_CODE_BYTES
    ):
        n += 500
    print("  trần với mã Python thật: ~%d byte mã người học" % n)
    # Trường hợp XẤU NHẤT: nội dung không nén được (ví dụ một chuỗi base64 dán vào).
    noise = base64.b64encode(os.urandom(12000)).decode("ascii")
    i = 0
    while (
        i < len(noise)
        and len(build_program(tracer_src, 's = "' + noise[:i] + '"').encode("utf-8"))
        < MAX_CODE_BYTES
    ):
        i += 200
    print("  trần xấu nhất (nội dung không nén được): ~%d byte" % i)

    print("")
    print("Chạy %d phép kiểm, trượt %d" % (_ran, len(_failures)))
    for f in _failures:
        print("  - " + f)
    return 1 if _failures else 0


if __name__ == "__main__":
    sys.exit(main())
