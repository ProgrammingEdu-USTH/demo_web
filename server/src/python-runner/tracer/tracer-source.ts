/**
 * TỆP SINH TỰ ĐỘNG — ĐỪNG SỬA TAY.
 *
 * Nguồn: src/python-runner/tracer/pe_tracer.py (bản rút gọn, bỏ chú thích)
 * Sinh lại: node scripts/build-tracer-source.mjs
 * Canh lệch: src/python-runner/tracer/tracer-source.spec.ts
 */

/** SHA-256 của pe_tracer.py lúc sinh file này. Lệch nghĩa là quên sinh lại. */
export const TRACER_SOURCE_SHA256 =
  '4b4c0dad04d9f7e27193d00cf27ea32fddccc88f8cd509007c2a249cb038723e';

/** Tracer Python đã bỏ chú thích/docstring — đúng chuỗi được gửi vào sandbox. */
export const TRACER_SOURCE = `PE_FILENAME = 'main.py'
PE_BEGIN = '__PE_TRACE_V1_BEGIN__'
PE_END = '__PE_TRACE_V1_END__'
PE_LIMITS = {'maxSteps': 1000, 'maxBytes': 700 * 1024, 'timeBudgetMs': 6500, 'maxDepth': 4, 'maxItems': 100, 'maxDictItems': 50, 'maxAttrs': 30, 'maxStringChars': 200, 'maxFrames': 20, 'maxLocals': 60, 'maxOutputChars': 60000}

class _PEStop(BaseException):
    pass

class _PEOut:

    def __init__(self, cap):
        self.parts = []
        self.n = 0
        self.cap = cap
        self.truncated = False
        self.encoding = 'utf-8'
        self.errors = 'replace'

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
        return ''.join(self.parts)

def _pe_run(src_b64):
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
    except Exception:
        signal = None
    lim = PE_LIMITS
    t0 = time.monotonic()
    try:
        out_fd = os.dup(1)
    except Exception:
        out_fd = 1
    src = zlib.decompress(base64.b64decode(src_b64)).decode('utf-8', 'replace')
    lines = src.splitlines(True)
    linecache.cache[PE_FILENAME] = (len(src), None, lines, PE_FILENAME)
    out = _PEOut(lim['maxOutputChars'])
    err = _PEOut(lim['maxOutputChars'])
    st = {'steps': [], 'bytes': 0, 'events': 0, 'trunc': 0, 'stop': None, 'halt': False, 'off': False, 'watchdog': False, 'emitted': False, 'error': None}

    def val(o, depth, seen):
        try:
            return _pe_value(o, depth, seen, lim, st)
        except BaseException:
            return {'t': 'opaque', 'cls': '?', 'r': '<không đọc được>'}

    def snap(frame):
        names = []
        is_module = frame.f_code.co_name == '<module>'
        try:
            items = list(frame.f_locals.items())
        except BaseException:
            items = []
        for k, v in items:
            if is_module and (k.startswith('__') or k.startswith('_PE') or k == '_pe_run'):
                continue
            names.append((k, v))
            if len(names) >= lim['maxLocals']:
                break
        return {'name': frame.f_code.co_name, 'line': frame.f_lineno, 'locals': [[k, val(v, 0, set())] for k, v in names]}

    def stack(frame):
        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == PE_FILENAME:
                chain.append(f)
            f = f.f_back
        chain.reverse()
        elided = 0
        if len(chain) > lim['maxFrames']:
            keep = lim['maxFrames'] - 1
            elided = len(chain) - lim['maxFrames']
            chain = [chain[0]] + chain[-keep:]
        return ([snap(f) for f in chain], elided)

    def record(frame, event, arg):
        step = {'i': len(st['steps']), 'event': event, 'line': frame.f_lineno, 'out': out.n, 'err': err.n}
        frames, elided = stack(frame)
        step['frames'] = frames
        if elided:
            step['framesElided'] = elided
        if event == 'return':
            step['ret'] = val(arg, 0, set())
        elif event == 'exception' and isinstance(arg, tuple) and (len(arg) >= 2):
            step['exc'] = {'type': getattr(arg[0], '__name__', str(arg[0])), 'message': _pe_text(arg[1], lim, st)}
        try:
            size = len(json.dumps(step, ensure_ascii=False, separators=(',', ':')))
        except BaseException:
            size = 4096
        if st['bytes'] + size > lim['maxBytes']:
            st['stop'] = 'byte-limit'
            return False
        st['steps'].append(step)
        st['bytes'] += size
        return True

    def _stop_tracing():
        if st['watchdog']:
            st['off'] = True
            sys.settrace(None)
            return None
        return tracer

    def tracer(frame, event, arg):
        try:
            if st['halt']:
                _finish_and_exit(st, out, err, lim, out_fd, t0)
            if frame.f_code.co_filename != PE_FILENAME:
                return None
            st['events'] += 1
            if time.monotonic() - t0 > lim['timeBudgetMs'] / 1000.0:
                st['stop'] = 'time-limit'
                st['halt'] = True
                raise _PEStop()
            if st['stop'] is not None:
                return None if st['off'] else tracer
            if len(st['steps']) >= lim['maxSteps']:
                st['stop'] = 'step-limit'
                return _stop_tracing()
            if not record(frame, event, arg):
                return _stop_tracing()
            return tracer
        except _PEStop:
            raise
        except BaseException:
            return None

    def on_alarm(_sig, _frm):
        if st['stop'] is None:
            st['stop'] = 'time-limit'
        st['halt'] = True
        _finish_and_exit(st, out, err, lim, out_fd, t0)
    if signal is not None and hasattr(signal, 'setitimer'):
        try:
            signal.signal(signal.SIGALRM, on_alarm)
            signal.setitimer(signal.ITIMER_REAL, lim['timeBudgetMs'] / 1000.0)
            st['watchdog'] = True
        except Exception:
            pass

    def no_input(prompt=''):
        if prompt:
            out.write(str(prompt))
        raise EOFError('input() không dùng được ở đây: mã chạy trong sandbox không có bàn phím (không có stdin). Hãy gán giá trị trực tiếp, ví dụ: ten = "An"')
    g = {'__name__': '__main__', '__file__': PE_FILENAME, '__builtins__': builtins, '__doc__': None, '__package__': None, '__spec__': None, '__loader__': None}
    real_stdout, real_stderr, real_input = (sys.stdout, sys.stderr, builtins.input)
    try:
        code_obj = compile(src, PE_FILENAME, 'exec')
    except SyntaxError as e:
        st['error'] = {'type': type(e).__name__, 'message': _pe_text(e, lim, st), 'line': getattr(e, 'lineno', None), 'traceback': ''.join(traceback.format_exception_only(type(e), e))}
        st['stop'] = st['stop'] or 'error'
        err.write(st['error']['traceback'])
        _finish(st, out, err, lim, out_fd, t0)
        return
    sys.stdout, sys.stderr, builtins.input = (out, err, no_input)
    try:
        sys.settrace(tracer)
        exec(code_obj, g)
    except _PEStop:
        pass
    except SystemExit:
        pass
    except BaseException as e:
        tb = e.__traceback__
        if tb is not None and tb.tb_frame.f_code.co_filename != PE_FILENAME:
            tb = tb.tb_next
        text = ''.join(traceback.format_exception(type(e), e, tb))
        line = None
        walk = tb
        while walk is not None:
            if walk.tb_frame.f_code.co_filename == PE_FILENAME:
                line = walk.tb_lineno
            walk = walk.tb_next
        st['error'] = {'type': type(e).__name__, 'message': _pe_text(e, lim, st), 'line': line, 'traceback': text}
        err.write(text)
    finally:
        sys.settrace(None)
        if signal is not None and hasattr(signal, 'setitimer'):
            try:
                signal.setitimer(signal.ITIMER_REAL, 0)
            except Exception:
                pass
        sys.stdout, sys.stderr, builtins.input = (real_stdout, real_stderr, real_input)
    _finish(st, out, err, lim, out_fd, t0)

def _pe_doc(st, out, err, lim, t0_elapsed_ms):
    if st['error'] is not None:
        reason = 'error'
    elif st['stop'] in ('step-limit', 'byte-limit', 'time-limit'):
        reason = st['stop']
    else:
        reason = 'done'
    return {'v': 1, 'steps': st['steps'], 'stdout': out.text(), 'stderr': err.text(), 'stdoutTruncated': out.truncated, 'stderrTruncated': err.truncated, 'stopReason': reason, 'error': st['error'], 'stats': {'steps': len(st['steps']), 'events': st['events'], 'elapsedMs': t0_elapsed_ms, 'valuesTruncated': st['trunc']}, 'limits': lim}

def _pe_write(fd, doc):
    import json
    import os
    try:
        body = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    except BaseException:
        body = json.dumps({'v': 1, 'steps': [], 'stdout': '', 'stderr': '', 'stdoutTruncated': False, 'stderrTruncated': False, 'stopReason': 'tracer-error', 'error': {'type': 'TracerError', 'message': 'không tuần tự hoá được vết', 'line': None, 'traceback': ''}, 'stats': {'steps': 0, 'events': 0, 'elapsedMs': 0, 'valuesTruncated': 0}, 'limits': PE_LIMITS})
    payload = ('\\n' + PE_BEGIN + '\\n' + body + '\\n' + PE_END + '\\n').encode('utf-8', 'replace')
    try:
        with memoryview(payload) as mv:
            n = 0
            while n < len(mv):
                n += os.write(fd, mv[n:])
    except Exception:
        pass

def _finish(st, out, err, lim, fd, t0):
    import time
    if st['emitted']:
        return
    st['emitted'] = True
    _pe_write(fd, _pe_doc(st, out, err, lim, int((time.monotonic() - t0) * 1000)))

def _finish_and_exit(st, out, err, lim, fd, t0):
    import os
    _finish(st, out, err, lim, fd, t0)
    os._exit(0)

def _pe_text(o, lim, st):
    try:
        s = str(o)
    except BaseException:
        return '<không đọc được>'
    cap = lim['maxStringChars']
    if len(s) > cap:
        st['trunc'] += 1
        return s[:cap] + '…'
    return s

def _pe_repr(o, lim, st):
    try:
        s = repr(o)
    except BaseException:
        return '<repr lỗi>'
    cap = lim['maxStringChars']
    if len(s) > cap:
        st['trunc'] += 1
        return s[:cap] + '…'
    return s
_PE_SEQ = (list, tuple, set, frozenset)

def _pe_value(o, depth, seen, lim, st):
    t = type(o)
    if o is None or o is True or o is False:
        return {'t': 'prim', 'r': repr(o)}
    if t is int or t is float or t is complex:
        return {'t': 'prim', 'r': _pe_repr(o, lim, st)}
    if t is str:
        cap = lim['maxStringChars']
        if len(o) > cap:
            st['trunc'] += 1
            return {'t': 'str', 'r': o[:cap], 'trunc': True, 'n': len(o)}
        return {'t': 'str', 'r': o}
    if t is bytes or t is bytearray:
        return {'t': 'bytes', 'r': _pe_repr(o, lim, st), 'n': len(o)}
    oid = id(o)
    if oid in seen:
        return {'t': 'cycle'}
    if t in _PE_SEQ or t is dict:
        if depth >= lim['maxDepth']:
            return {'t': 'depth'}
        kind = 'dict' if t is dict else t.__name__
        try:
            total = len(o)
        except BaseException:
            total = 0
        cap = lim['maxDictItems'] if t is dict else lim['maxItems']
        seen = seen | {oid}
        items = []
        try:
            if t is dict:
                for i, (k, v) in enumerate(o.items()):
                    if i >= cap:
                        break
                    items.append([_pe_value(k, depth + 1, seen, lim, st), _pe_value(v, depth + 1, seen, lim, st)])
            else:
                for i, v in enumerate(o):
                    if i >= cap:
                        break
                    items.append(_pe_value(v, depth + 1, seen, lim, st))
        except BaseException:
            pass
        node = {'t': kind, 'items': items, 'n': total}
        if total > len(items):
            st['trunc'] += 1
            node['more'] = True
        return node
    if t is type:
        return {'t': 'cls', 'name': str(getattr(o, '__name__', '?'))}
    if t.__name__ == 'module':
        return {'t': 'opaque', 'cls': 'module', 'r': _pe_repr(o, lim, st)}
    if callable(o) and t.__name__ in ('function', 'builtin_function_or_method', 'method', 'type'):
        return {'t': 'fn', 'name': str(getattr(o, '__name__', '?')), 'cls': t.__name__}
    try:
        d = vars(o)
    except BaseException:
        d = None
    if isinstance(d, dict):
        if depth >= lim['maxDepth']:
            return {'t': 'depth'}
        seen = seen | {oid}
        attrs = []
        for i, (k, v) in enumerate(list(d.items())):
            if i >= lim['maxAttrs']:
                break
            attrs.append([str(k), _pe_value(v, depth + 1, seen, lim, st)])
        node = {'t': 'obj', 'cls': t.__name__, 'attrs': attrs, 'n': len(d)}
        if len(d) > len(attrs):
            st['trunc'] += 1
            node['more'] = True
        return node
    return {'t': 'opaque', 'cls': t.__name__, 'r': _pe_repr(o, lim, st)}`;
