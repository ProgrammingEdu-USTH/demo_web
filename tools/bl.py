"""Tiny client for the BlenderMCP addon socket (default localhost:9876).

  python bl.py run script.py            -> execute a python file inside Blender
  python bl.py cmd <type> [json-params] -> send a raw addon command
"""
import json
import socket
import sys

HOST, PORT = "127.0.0.1", 9876


def send(cmd_type, params=None, timeout=600):
    s = socket.create_connection((HOST, PORT), timeout=15)
    s.settimeout(timeout)
    s.sendall(json.dumps({"type": cmd_type, "params": params or {}}).encode("utf-8"))
    buf = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
        try:
            out = json.loads(buf.decode("utf-8"))
            s.close()
            return out
        except ValueError:
            continue
    s.close()
    return json.loads(buf.decode("utf-8"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    mode = sys.argv[1]
    if mode == "run":
        code = open(sys.argv[2], encoding="utf-8").read()
        res = send("execute_code", {"code": code})
    else:
        params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        res = send(sys.argv[2], params)
    if isinstance(res.get("result"), dict) and "result" in res["result"]:
        print(res.get("status"))
        print(res["result"]["result"])
    else:
        print(json.dumps(res, ensure_ascii=False, indent=1)[:6000])
