# -*- coding: utf-8 -*-
"""Bộ ghi vết (tracer) chạy BÊN TRONG sandbox Docker, in ra một tài liệu JSON.

Vì sao nó tồn tại: `/ide` cần cho người học bước từng dòng qua chương trình của
mình — thấy dòng đang chạy, biến và giá trị, call stack, đầu ra tới thời điểm đó.
Chấm/chạy đã nằm ở Python THẬT trong sandbox (xem src/python-runner), nên trực
quan hoá cũng phải chạy ở đúng chỗ đó, không mô phỏng lại trong trình duyệt —
người học phải thấy đúng cái Python mà họ sẽ nhận khi bấm Chạy.

Vì sao MỘT lần chạy ra TOÀN BỘ vết: mỗi lượt chạy là một container dùng một lần,
không có tiến trình nào sống sót giữa hai request. Không thể "bước tiếp" bằng
cách gọi lại máy chủ. Nên tiến trình này ghi lại mọi bước rồi in ra một lần; UI
bước qua lại cục bộ trên dữ liệu đó.

Đường đi: backend dán file này + mã người học (base64) thành MỘT file Python rồi
gửi qua đúng POST /run hiện có (cùng hàng đợi, cùng cờ cách ly, cùng trần thời
gian). Xem src/python-runner/tracer/trace-program.ts.

Ba trần phải có, vì mã của sinh viên thật sẽ chạm vào cả ba:
  1. SỐ BƯỚC — `for i in range(1000000)` sinh hàng triệu sự kiện. Chạm trần thì
     NGỪNG GHI nhưng vẫn để chương trình chạy tiếp (không ghi nên nhanh), rồi nói
     thẳng trong tài liệu là đã chạm trần. Không cắt im lặng.
  2. SỐ BYTE — vết phải về được qua stdout (Node giữ tối đa 1 MB, vượt là bị cắt
     giữa dòng và JSON thành rác). Tự dừng ở MAX_JSON_BYTES trước khi tới đó.
  3. THỜI GIAN — container bị SIGKILL sau PY_RUN_TIMEOUT_MS; lúc đó không còn cơ
     hội in gì cả. Vòng lặp vô hạn là thứ sinh viên viết hằng ngày, nên phải tự
     đặt báo thức SỚM HƠN (SIGALRM) để kịp in vết đã ghi được. Không có báo thức
     thì `while True: pass` trả về một ô trống, không giải thích gì.

Giá trị thì phải tuần tự hoá được MÀ KHÔNG BAO GIỜ nổ: tự tham chiếu (`a.append(a)`),
repr ném lỗi, danh sách một triệu phần tử, chuỗi khổng lồ. Cách làm: đi theo đường
(path) với trần độ sâu/số phần tử/số ký tự, phát hiện chu trình bằng id() trên
đường đang đi, và `try` quanh MỌI lời gọi vào mã của người học.

Không nhìn thấy khung của chính mình: lọc theo `co_filename` — chỉ ghi frame của
file mã người học (`main.py`, tên giả), nên khung của tracer và của thư viện
chuẩn không bao giờ lọt vào vết.

Tương thích: cố ý chỉ dùng API có từ Python 3.8 (sandbox dùng 3.12, máy dev có
thể 3.14). `sys.settrace` chứ không phải `sys.monitoring` — xem GHI CHÚ CHỌN API
ở cuối file.
"""

# Tên file giả của mã người học. Hai việc phụ thuộc vào nó:
#   - lọc sự kiện: chỉ frame có co_filename == tên này mới được ghi;
#   - traceback: nạp sẵn vào linecache nên lỗi in ra ĐÚNG dòng mã người học,
#     dù đường dẫn đó không có thật trên đĩa (file thật là /code/main.py và
#     chứa cả tracer, số dòng lệch hoàn toàn).
PE_FILENAME = "main.py"

# Mốc bao quanh JSON trên stdout. Có mốc thì dù mã người học có ghi thẳng vào
# fd 1 (os.write(1, ...)) thì backend vẫn tách được tài liệu ra.
PE_BEGIN = "__PE_TRACE_V1_BEGIN__"
PE_END = "__PE_TRACE_V1_END__"

PE_LIMITS = {
    # 1000 bước đủ cho mọi bài học (vòng lặp 50 vòng, đệ quy 20 tầng) mà JSON
    # vẫn ~300-500 KB trường hợp xấu. Xem mục "Trần" ở đầu file.
    "maxSteps": 1000,
    # Node giữ tối đa 1 MB mỗi luồng (MAX_BUFFER trong docker-sandbox.ts) và vượt
    # là CẮT + giết tiến trình. 700 KB để còn chỗ cho stdout/stderr của chương trình.
    "maxBytes": 700 * 1024,
    # Container bị giết ở 10 s. Dừng ở 6,5 s để còn thời gian tuần tự hoá và in.
    "timeBudgetMs": 6500,
    # Lồng sâu hơn thì thay bằng {"t":"depth"} — người học không đọc nổi 5 tầng
    # trong một ô biến, và đây là nơi dễ nổ nhất với dữ liệu tự tham chiếu.
    "maxDepth": 4,
    "maxItems": 100,
    "maxDictItems": 50,
    "maxAttrs": 30,
    "maxStringChars": 200,
    # Đệ quy sâu: giữ frame ngoài cùng + 19 frame trong cùng, phần giữa ghi số
    # lượng bị bỏ. Không có trần này thì đệ quy 900 tầng nhân 900 bước = nổ JSON.
    "maxFrames": 20,
    "maxLocals": 60,
    # Đầu ra của chương trình giữ lại bấy nhiêu ký tự mỗi luồng (chỉ để hiển thị
    # trong panel "đầu ra tới bước này").
    "maxOutputChars": 60000,
}


class _PEStop(BaseException):
    """Tín hiệu "dừng chương trình" do tracer ném ra từ callback.

    Kế thừa BaseException (không phải Exception) để `except Exception` của người
    học không nuốt mất nó. `except:` trần vẫn nuốt được — vì thế còn SIGALRM làm
    lưới cuối.
    """


class _PEOut:
    """Nơi nhận stdout/stderr của chương trình, có trần ký tự.

    Cố ý KHÔNG có `fileno()`: thứ gì hỏi fd thật sẽ không lấy được fd 1 qua đây,
    nên vết JSON (ghi bằng os.write vào fd đã dup) không bị trộn.
    """

    def __init__(self, cap):
        self.parts = []
        self.n = 0
        self.cap = cap
        self.truncated = False
        self.encoding = "utf-8"
        self.errors = "replace"

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)

        room = self.cap - self.n
        if room <= 0:
            self.truncated = True
            return len(s)
        if len(s) > room:
            self.parts.append(s[:room])
            self.n = self.cap
            self.truncated = True
        else:
            self.parts.append(s)
            self.n += len(s)
        return len(s)

    def writelines(self, seq):
        for s in seq:
            self.write(s)

    def flush(self):
        return None

    def isatty(self):
        return False

    def writable(self):
        return True

    def readable(self):
        return False

    def seekable(self):
        return False

    def text(self):
        return "".join(self.parts)


def _pe_run(src_b64):
    """Chạy mã người học rồi in tài liệu vết ra stdout.

    `src_b64` là base64 của zlib(UTF-8 của mã người học). Vì sao nén: tracer +
    mã người học phải cùng nằm trong MỘT file dưới 20 KB (MAX_CODE_BYTES của
    POST /run). Tracer rút gọn đã chiếm ~12,5 KB; base64 thô lại phình 33% nên
    người học chỉ còn ~5,8 KB. Mã Python nén được 3-4 lần, nên nén xong thì gần
    như mọi chương trình trong trần 20 KB của editor đều vừa. Backend đo kích
    thước THẬT sau khi dựng và từ chối kèm con số, không đoán trước.
    """
    import base64
    import zlib
    import builtins
    import json
    import linecache
    import os
    import sys
    import time
    import traceback

    try:
        import signal
    except Exception:  # pragma: no cover - nền tảng không có module signal
        signal = None

    lim = PE_LIMITS
    t0 = time.monotonic()
    # Giữ MỘT bản fd 1 thật từ đầu: mã người học có thể gán lại sys.stdout, đóng
    # nó, hay ghi rác vào fd 1 — vết vẫn ra được đúng chỗ.
    try:
        out_fd = os.dup(1)
    except Exception:
        out_fd = 1

    # Dữ liệu do chính backend sinh ra nên luôn hợp lệ. Sai thì cứ để nổ: backend
    # không thấy mốc JSON sẽ trả về tài liệu "không dựng được vết" kèm đầu ra thô.
    src = zlib.decompress(base64.b64decode(src_b64)).decode("utf-8", "replace")

    # Traceback đọc dòng mã qua linecache. Entry có mtime = None là quy ước
    # "đừng kiểm lại trên đĩa" (checkcache bỏ qua), nên bản giả này không bị
    # thay bằng nội dung file thật /code/main.py (vốn là tracer + mã người học).
    lines = src.splitlines(True)
    linecache.cache[PE_FILENAME] = (len(src), None, lines, PE_FILENAME)

    out = _PEOut(lim["maxOutputChars"])
    err = _PEOut(lim["maxOutputChars"])

    # Trạng thái dùng chung giữa callback, handler báo thức và phần kết.
    st = {
        "steps": [],        # danh sách bước đã ghi
        "bytes": 0,         # xấp xỉ số byte JSON của phần steps
        "events": 0,        # tổng số sự kiện ĐÃ THẤY (kể cả sau khi ngừng ghi)
        "trunc": 0,         # số giá trị bị cắt bớt
        "stop": None,       # lý do ngừng GHI: step-limit | byte-limit | time-limit
        "halt": False,      # đã yêu cầu DỪNG CHƯƠNG TRÌNH (hết thời gian)
        "off": False,       # đã tắt hẳn callback (chỉ khi có báo thức canh giờ)
        "watchdog": False,  # SIGALRM đặt được chưa (Linux có, Windows không)
        "emitted": False,
        "error": None,
    }

    def val(o, depth, seen):
        """Giá trị -> cây JSON an toàn. Không bao giờ ném ra ngoài."""
        try:
            return _pe_value(o, depth, seen, lim, st)
        except BaseException:
            # repr/__dict__ của người học ném lỗi lạ: đừng để một biến làm sập vết.
            return {"t": "opaque", "cls": "?", "r": "<không đọc được>"}

    def snap(frame):
        """Một frame -> {name, line, locals}."""
        names = []
        is_module = frame.f_code.co_name == "<module>"
        try:
            items = list(frame.f_locals.items())
        except BaseException:
            items = []
        for k, v in items:
            if is_module and (k.startswith("__") or k.startswith("_PE") or k == "_pe_run"):
                continue
            names.append((k, v))
            if len(names) >= lim["maxLocals"]:
                break
        return {
            "name": frame.f_code.co_name,
            "line": frame.f_lineno,
            "locals": [[k, val(v, 0, set())] for k, v in names],
        }

    def stack(frame):
        """Call stack: [0] là ngoài cùng (<module>), cuối là frame hiện tại."""
        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == PE_FILENAME:
                chain.append(f)
            f = f.f_back
        chain.reverse()
        elided = 0
        if len(chain) > lim["maxFrames"]:
            # Giữ frame ngoài cùng (nơi chương trình bắt đầu) + các frame TRONG
            # CÙNG (nơi đang chạy). Đệ quy sâu thì phần giữa chỉ là lặp lại.
            keep = lim["maxFrames"] - 1
            elided = len(chain) - lim["maxFrames"]
            chain = [chain[0]] + chain[-keep:]
        return [snap(f) for f in chain], elided

    def record(frame, event, arg):
        step = {
            "i": len(st["steps"]),
            "event": event,
            "line": frame.f_lineno,
            "out": out.n,
            "err": err.n,
        }
        frames, elided = stack(frame)
        step["frames"] = frames
        if elided:
            step["framesElided"] = elided
        if event == "return":
            step["ret"] = val(arg, 0, set())
        elif event == "exception" and isinstance(arg, tuple) and len(arg) >= 2:
            step["exc"] = {
                "type": getattr(arg[0], "__name__", str(arg[0])),
                "message": _pe_text(arg[1], lim, st),
            }
        try:
            size = len(json.dumps(step, ensure_ascii=False, separators=(",", ":")))
        except BaseException:
            size = 4096
        if st["bytes"] + size > lim["maxBytes"]:
            st["stop"] = "byte-limit"
            return False
        st["steps"].append(step)
        st["bytes"] += size
        return True

    def _stop_tracing():
        """Ngừng ghi. Tắt hẳn callback CHỈ KHI còn một lưới khác canh thời gian.

        Không có SIGALRM (Windows, hay báo thức đặt không được) mà lại tắt
        callback thì `while True: pass` sau bước thứ 1000 chạy tới khi container
        bị SIGKILL — và lúc đó không còn ai in vết ra. Thà chậm còn hơn trả về
        một ô trống, nên khi không có lưới thì giữ callback để còn đo được giờ.
        """
        if st["watchdog"]:
            st["off"] = True
            sys.settrace(None)
            return None
        return tracer

    def tracer(frame, event, arg):
        # Callback KHÔNG bao giờ được ném lỗi ra ngoài (trừ _PEStop có chủ ý):
        # lỗi ở đây làm Python tắt trace và biến thành lỗi của chương trình.
        try:
            if st["halt"]:
                # Đã ném _PEStop mà vẫn còn được gọi: mã người học nuốt mất nó
                # (`except:` trần). In vết rồi thoát cứng, đừng chạy vô hạn.
                _finish_and_exit(st, out, err, lim, out_fd, t0)
            if frame.f_code.co_filename != PE_FILENAME:
                # Không theo vào thư viện chuẩn hay vào chính tracer: người học
                # không cần bước qua ruột của json/math, và khung của tracer thì
                # không bao giờ được xuất hiện trong vết.
                return None
            st["events"] += 1
            if time.monotonic() - t0 > lim["timeBudgetMs"] / 1000.0:
                st["stop"] = "time-limit"
                st["halt"] = True
                # Ném từ callback: ngoại lệ lan vào chính frame đang chạy nên
                # vòng lặp vô hạn bị cắt. Python tự tắt trace sau cú ném này.
                raise _PEStop()
            if st["stop"] is not None:
                # Đã ngừng ghi nhưng vẫn giữ callback: không có báo thức thì ĐÂY
                # là chỗ duy nhất còn đo được thời gian (xem _stop_tracing).
                return None if st["off"] else tracer
            if len(st["steps"]) >= lim["maxSteps"]:
                st["stop"] = "step-limit"
                # Chạm trần số bước: NGỪNG GHI nhưng để chương trình chạy nốt,
                # nên người học vẫn thấy đầu ra đầy đủ và kết quả thật thay vì
                # một ô trống. UI nói rõ vết dừng ở bước nào.
                return _stop_tracing()
            if not record(frame, event, arg):
                return _stop_tracing()
            return tracer
        except _PEStop:
            raise
        except BaseException:
            return None

    def on_alarm(_sig, _frm):
        # Lưới cuối: tới đây nghĩa là callback không còn chạy (đã ngừng ghi vì
        # chạm trần) hoặc mã người học nuốt _PEStop. Container sẽ bị SIGKILL vài
        # giây nữa — in ngay cái đã có.
        if st["stop"] is None:
            st["stop"] = "time-limit"
        st["halt"] = True
        _finish_and_exit(st, out, err, lim, out_fd, t0)

    if signal is not None and hasattr(signal, "setitimer"):
        try:
            signal.signal(signal.SIGALRM, on_alarm)
            signal.setitimer(signal.ITIMER_REAL, lim["timeBudgetMs"] / 1000.0)
            st["watchdog"] = True
        except Exception:  # pragma: no cover - Windows không có SIGALRM
            pass

    def no_input(prompt=""):
        # Sandbox chạy `docker run` KHÔNG có -i: stdin đóng ngay, nên input()
        # thật chỉ ném EOFError trần trụi. Giữ nguyên LOẠI ngoại lệ (để giống
        # lúc bấm Chạy) nhưng nói rõ vì sao và phải làm gì.
        if prompt:
            out.write(str(prompt))
        raise EOFError(
            "input() không dùng được ở đây: mã chạy trong sandbox không có bàn phím "
            "(không có stdin). Hãy gán giá trị trực tiếp, ví dụ: ten = \"An\""
        )

    g = {
        "__name__": "__main__",
        "__file__": PE_FILENAME,
        "__builtins__": builtins,
        "__doc__": None,
        "__package__": None,
        "__spec__": None,
        "__loader__": None,
    }

    real_stdout, real_stderr, real_input = sys.stdout, sys.stderr, builtins.input
    try:
        code_obj = compile(src, PE_FILENAME, "exec")
    except SyntaxError as e:
        st["error"] = {
            "type": type(e).__name__,
            "message": _pe_text(e, lim, st),
            "line": getattr(e, "lineno", None),
            "traceback": "".join(traceback.format_exception_only(type(e), e)),
        }
        st["stop"] = st["stop"] or "error"
        err.write(st["error"]["traceback"])
        _finish(st, out, err, lim, out_fd, t0)
        return

    sys.stdout, sys.stderr, builtins.input = out, err, no_input
    try:
        sys.settrace(tracer)
        exec(code_obj, g)
    except _PEStop:
        pass
    except SystemExit:
        # sys.exit() là cách kết thúc bình thường, không phải lỗi.
        pass
    except BaseException as e:
        tb = e.__traceback__
        # Bỏ frame `exec` của chính tracer: traceback phải bắt đầu từ mã người học.
        if tb is not None and tb.tb_frame.f_code.co_filename != PE_FILENAME:
            tb = tb.tb_next
        text = "".join(traceback.format_exception(type(e), e, tb))
        line = None
        walk = tb
        while walk is not None:
            if walk.tb_frame.f_code.co_filename == PE_FILENAME:
                line = walk.tb_lineno
            walk = walk.tb_next
        st["error"] = {
            "type": type(e).__name__,
            "message": _pe_text(e, lim, st),
            "line": line,
            "traceback": text,
        }
        err.write(text)
    finally:
        sys.settrace(None)
        if signal is not None and hasattr(signal, "setitimer"):
            try:
                signal.setitimer(signal.ITIMER_REAL, 0)
            except Exception:
                pass
        sys.stdout, sys.stderr, builtins.input = real_stdout, real_stderr, real_input

    _finish(st, out, err, lim, out_fd, t0)


def _pe_doc(st, out, err, lim, t0_elapsed_ms):
    """Gom tài liệu cuối cùng. `stopReason` là thứ UI dùng để nói thật với người học."""
    if st["error"] is not None:
        reason = "error"
    elif st["stop"] in ("step-limit", "byte-limit", "time-limit"):
        reason = st["stop"]
    else:
        reason = "done"
    return {
        "v": 1,
        "steps": st["steps"],
        "stdout": out.text(),
        "stderr": err.text(),
        "stdoutTruncated": out.truncated,
        "stderrTruncated": err.truncated,
        "stopReason": reason,
        "error": st["error"],
        "stats": {
            "steps": len(st["steps"]),
            "events": st["events"],
            "elapsedMs": t0_elapsed_ms,
            "valuesTruncated": st["trunc"],
        },
        "limits": lim,
    }


def _pe_write(fd, doc):
    import json
    import os

    try:
        body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    except BaseException:
        body = json.dumps(
            {
                "v": 1,
                "steps": [],
                "stdout": "",
                "stderr": "",
                "stdoutTruncated": False,
                "stderrTruncated": False,
                "stopReason": "tracer-error",
                "error": {
                    "type": "TracerError",
                    "message": "không tuần tự hoá được vết",
                    "line": None,
                    "traceback": "",
                },
                "stats": {"steps": 0, "events": 0, "elapsedMs": 0, "valuesTruncated": 0},
                "limits": PE_LIMITS,
            }
        )
    payload = ("\n" + PE_BEGIN + "\n" + body + "\n" + PE_END + "\n").encode(
        "utf-8", "replace"
    )
    try:
        with memoryview(payload) as mv:
            n = 0
            while n < len(mv):
                n += os.write(fd, mv[n:])
    except Exception:
        pass


def _finish(st, out, err, lim, fd, t0):
    import time

    if st["emitted"]:
        return
    st["emitted"] = True
    _pe_write(fd, _pe_doc(st, out, err, lim, int((time.monotonic() - t0) * 1000)))


def _finish_and_exit(st, out, err, lim, fd, t0):
    import os

    _finish(st, out, err, lim, fd, t0)
    # os._exit: không chạy atexit, không gọi __del__ của người học, không có cách
    # nào để mã người học chen vào giữa "đã in vết" và "đã thoát".
    os._exit(0)


def _pe_text(o, lim, st):
    """str(o) an toàn, có trần ký tự."""
    try:
        s = str(o)
    except BaseException:
        return "<không đọc được>"
    cap = lim["maxStringChars"]
    if len(s) > cap:
        st["trunc"] += 1
        return s[:cap] + "…"
    return s


def _pe_repr(o, lim, st):
    """repr(o) an toàn, có trần ký tự. repr của người học có thể ném lỗi."""
    try:
        s = repr(o)
    except BaseException:
        return "<repr lỗi>"
    cap = lim["maxStringChars"]
    if len(s) > cap:
        st["trunc"] += 1
        return s[:cap] + "…"
    return s


_PE_SEQ = (list, tuple, set, frozenset)


def _pe_value(o, depth, seen, lim, st):
    """Giá trị Python -> cây JSON có trần. Xem hợp đồng ở trace-document.ts."""
    t = type(o)
    if o is None or o is True or o is False:
        return {"t": "prim", "r": repr(o)}
    if t is int or t is float or t is complex:
        # int có thể khổng lồ (10**100000): repr phải qua trần ký tự.
        return {"t": "prim", "r": _pe_repr(o, lim, st)}
    if t is str:
        cap = lim["maxStringChars"]
        if len(o) > cap:
            st["trunc"] += 1
            return {"t": "str", "r": o[:cap], "trunc": True, "n": len(o)}
        return {"t": "str", "r": o}
    if t is bytes or t is bytearray:
        return {"t": "bytes", "r": _pe_repr(o, lim, st), "n": len(o)}

    oid = id(o)
    if oid in seen:
        # a = []; a.append(a) — không có nhánh này là đệ quy vô hạn.
        return {"t": "cycle"}

    if t in _PE_SEQ or t is dict:
        if depth >= lim["maxDepth"]:
            return {"t": "depth"}
        kind = "dict" if t is dict else t.__name__
        try:
            total = len(o)
        except BaseException:
            total = 0
        cap = lim["maxDictItems"] if t is dict else lim["maxItems"]
        seen = seen | {oid}
        items = []
        try:
            if t is dict:
                for i, (k, v) in enumerate(o.items()):
                    if i >= cap:
                        break
                    items.append(
                        [
                            _pe_value(k, depth + 1, seen, lim, st),
                            _pe_value(v, depth + 1, seen, lim, st),
                        ]
                    )
            else:
                for i, v in enumerate(o):
                    if i >= cap:
                        break
                    items.append(_pe_value(v, depth + 1, seen, lim, st))
        except BaseException:
            # Iterator của người học ném lỗi giữa đường: giữ phần đã lấy được.
            pass
        node = {"t": kind, "items": items, "n": total}
        if total > len(items):
            st["trunc"] += 1
            node["more"] = True
        return node

    if t is type:
        # Lớp do người học định nghĩa: hiện tên lớp, không mở __dict__ của nó.
        return {"t": "cls", "name": str(getattr(o, "__name__", "?"))}
    if t.__name__ == "module":
        return {"t": "opaque", "cls": "module", "r": _pe_repr(o, lim, st)}
    if callable(o) and (
        t.__name__ in ("function", "builtin_function_or_method", "method", "type")
    ):
        return {
            "t": "fn",
            "name": str(getattr(o, "__name__", "?")),
            "cls": t.__name__,
        }

    # Đối tượng thường: đọc __dict__ bằng vars(), KHÔNG dùng getattr — property
    # của người học sẽ chạy mã (và có thể in, ném lỗi, hay chạy mãi) nếu dùng getattr.
    try:
        d = vars(o)
    except BaseException:
        d = None
    if isinstance(d, dict):
        if depth >= lim["maxDepth"]:
            return {"t": "depth"}
        seen = seen | {oid}
        attrs = []
        for i, (k, v) in enumerate(list(d.items())):
            if i >= lim["maxAttrs"]:
                break
            attrs.append([str(k), _pe_value(v, depth + 1, seen, lim, st)])
        node = {"t": "obj", "cls": t.__name__, "attrs": attrs, "n": len(d)}
        if len(d) > len(attrs):
            st["trunc"] += 1
            node["more"] = True
        return node

    return {"t": "opaque", "cls": t.__name__, "r": _pe_repr(o, lim, st)}


# GHI CHÚ CHỌN API: vì sao `sys.settrace` mà không phải `sys.monitoring`
#
# `sys.monitoring` (PEP 669, Python 3.12+) nhanh hơn đáng kể vì bật/tắt được theo
# từng loại sự kiện và theo từng code object. Vẫn chọn `sys.settrace` vì:
#
#   1. Thứ cần ở đây là FRAME. Callback của settrace nhận thẳng `frame` nên đọc
#      được f_locals/f_back/f_lineno — đúng ba thứ dựng nên "biến" và "call
#      stack". Callback của monitoring chỉ nhận (code, offset), muốn có frame
#      phải `sys._getframe()` rồi tự lần ngược, dễ sai hơn mà chẳng được gì.
#   2. settrace có trace function CỤC BỘ theo frame: trả về `tracer` thì frame đó
#      được theo tiếp, trả về None thì không. Nhờ vậy việc lọc "chỉ theo file mã
#      người học" là MỘT phép so chuỗi ở sự kiện `call`.
#   3. Hiệu năng không phải ràng buộc: trần là 1000 bước, không phải 10 triệu.
#      Chi phí thật của một lượt là tạo container (0,2-0,6 s), không phải callback.
#   4. settrace chạy từ 3.8 tới 3.14 với cùng một đoạn mã; sandbox hiện dùng
#      3.12 nhưng đừng buộc trực quan hoá vào đúng một phiên bản.
#
# Giới hạn đã biết của lựa chọn này (nói thẳng, không che):
#   - Chỉ theo LUỒNG CHÍNH. Mã dùng threading thì luồng con không có vết (muốn có
#     thì phải threading.settrace). Vết vẫn ghi phần luồng chính, không sai.
#   - Mã người học gọi `sys.settrace(None)` thì tracer tắt từ đó; vết vẫn in ra
#     phần đã ghi. Đây là ranh giới TIN CẬY đã biết: lớp bảo vệ thật là container
#     (xem docker-sandbox.ts), không phải tracer.
#   - `os._exit()` trong mã người học bỏ qua mọi thứ, kể cả phần in vết.
