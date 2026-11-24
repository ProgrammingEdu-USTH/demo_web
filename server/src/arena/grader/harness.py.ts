/**
 * Mã Python của harness chấm bài (chạy trong Pyodide, trong worker_threads).
 * Để dạng chuỗi hằng trong .ts: `nest build` không copy file .py và chạy được dưới jest.
 * KHÔNG dùng dấu backtick hoặc "${" trong chuỗi này.
 *
 * Lớp phòng thủ (contracts/features.md §7):
 *  1. kiểm tra AST (import trắng, cấm thuộc tính/tên nguy hiểm);
 *  2. __builtins__ trắng, import riêng chỉ trả về đối tượng bọc;
 *  3. xoá js/pyodide khỏi sys.modules và meta_path trước khi chạy mã người dùng.
 * Đây KHÔNG phải ranh giới bảo mật tuyệt đối (xem DECISIONS D1).
 */
export const HARNESS_PY = String.raw`
import sys, json, ast, types, importlib
import builtins as _real_builtins

_ALLOWED_MODULES = frozenset((
    'math', 'itertools', 'collections', 'functools', 'heapq', 'bisect',
    're', 'typing', 'statistics', 'decimal', 'fractions',
))

# Danh sách trắng tên thuộc tính cho TỪNG module bọc (H-1): chỉ những gì bài tập
# cần. Tên không có trong danh sách thì không tồn tại trên đối tượng bọc (nên
# không có get_type_hints, singledispatch, ForwardRef, NamedTuple, Template...).
_MODULE_ALLOW = {
    'math': frozenset(
        'acos acosh asin asinh atan atan2 atanh cbrt ceil comb copysign cos cosh '
        'degrees dist e erf erfc exp exp2 expm1 fabs factorial floor fmod frexp '
        'fsum gamma gcd hypot inf isclose isfinite isinf isnan isqrt lcm ldexp '
        'lgamma log log10 log1p log2 modf nan nextafter perm pi pow prod radians '
        'remainder sin sinh sqrt tan tanh tau trunc ulp'.split()
    ),
    'itertools': frozenset(
        'accumulate batched chain combinations combinations_with_replacement '
        'compress count cycle dropwhile filterfalse groupby islice pairwise '
        'permutations product repeat starmap takewhile tee zip_longest'.split()
    ),
    'collections': frozenset(
        'ChainMap Counter OrderedDict defaultdict deque namedtuple'.split()
    ),
    'functools': frozenset(
        'cache cached_property cmp_to_key lru_cache partial reduce '
        'total_ordering wraps'.split()
    ),
    'heapq': frozenset(
        'heapify heappop heappush heappushpop heapreplace merge nlargest '
        'nsmallest'.split()
    ),
    'bisect': frozenset(
        'bisect bisect_left bisect_right insort insort_left insort_right'.split()
    ),
    're': frozenset(
        'A ASCII DOTALL I IGNORECASE M MULTILINE S VERBOSE X Match Pattern error '
        'compile escape findall finditer fullmatch match search split sub '
        'subn'.split()
    ),
    'statistics': frozenset(
        'StatisticsError fmean geometric_mean harmonic_mean mean median '
        'median_grouped median_high median_low mode multimode pstdev pvariance '
        'quantiles stdev variance'.split()
    ),
    'decimal': frozenset(
        'Context Decimal DivisionByZero Inexact InvalidOperation Overflow Rounded '
        'ROUND_CEILING ROUND_DOWN ROUND_FLOOR ROUND_HALF_DOWN ROUND_HALF_EVEN '
        'ROUND_HALF_UP ROUND_UP Underflow getcontext localcontext '
        'setcontext'.split()
    ),
    'fractions': frozenset(('Fraction',)),
}
# typing: không có get_type_hints, ForwardRef, NamedTuple...
_TYPING_ALLOW = frozenset((
    'Any', 'AnyStr', 'Callable', 'ClassVar', 'Collection', 'Container', 'Counter',
    'DefaultDict', 'Deque', 'Dict', 'Final', 'FrozenSet', 'Generic', 'Hashable',
    'Iterable', 'Iterator', 'List', 'Literal', 'Mapping', 'MutableMapping',
    'MutableSequence', 'MutableSet', 'NoReturn', 'Optional', 'OrderedDict',
    'Reversible', 'Sequence', 'Set', 'Sized', 'Text', 'Tuple', 'TypeVar',
    'Union', 'TYPE_CHECKING', 'AbstractSet', 'SupportsInt', 'SupportsFloat',
))
_MODULE_ALLOW['typing'] = _TYPING_ALLOW

_BAD_ATTRS = frozenset((
    'gi_frame', 'gi_code', 'gi_yieldfrom', 'cr_frame', 'cr_code', 'cr_await',
    'ag_frame', 'ag_code', 'ag_await', 'f_globals', 'f_builtins', 'f_locals',
    'f_back', 'f_code', 'tb_frame', 'tb_next', 'co_code', 'format',
    'format_map', 'mro',
))
_BAD_NAMES = frozenset((
    'eval', 'exec', 'compile', 'open', 'input', 'getattr', 'setattr', 'delattr',
    'hasattr', 'vars', 'globals', 'locals', 'dir', 'type', 'breakpoint', 'help',
    'exit', 'quit', 'memoryview',
))
# Tên đặc biệt không được GÁN/ĐỊNH NGHĨA lại (import ... as, def, class, except ... as, global...).
_BAD_BIND = frozenset((
    '__builtins__', '__import__', '__build_class__', '__loader__', '__spec__',
))
_ASYNC_NODES = (ast.AsyncFunctionDef, ast.AsyncFor, ast.AsyncWith, ast.Await)

_SAFE_BUILTIN_NAMES = (
    'abs all any bin bool bytes callable chr dict divmod enumerate filter float '
    'frozenset hash hex int isinstance issubclass iter len list map max min next '
    'object oct ord pow range repr reversed round set slice sorted str sum tuple '
    'zip property staticmethod classmethod super '
    'Exception ValueError TypeError KeyError IndexError ZeroDivisionError '
    'StopIteration AssertionError ArithmeticError RuntimeError '
    'NotImplementedError OverflowError RecursionError AttributeError '
    'NotImplemented Ellipsis'
).split()

_OUT_LIMIT = 4096
_JSON_LIMIT = 1000000
_REPR_LIMIT = 200

_wrapped = {}
_user_globals = {}
_printed = [0]


def _wrap(name):
    cached = _wrapped.get(name)
    if cached is not None:
        return cached
    real = importlib.import_module(name)
    ns = types.SimpleNamespace()
    allow = _MODULE_ALLOW.get(name, ())
    for key in dir(real):
        if key.startswith('_') or key not in allow:
            continue
        value = getattr(real, key)
        if isinstance(value, types.ModuleType):
            continue
        setattr(ns, key, value)
    _wrapped[name] = ns
    return ns


def _arena_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level != 0:
        raise ImportError('Khong ho tro import tuong doi')
    if name not in _ALLOWED_MODULES:
        raise ImportError('Module khong duoc phep: ' + str(name))
    return _wrap(name)


def _arena_print(*args, **kwargs):
    # Bỏ đầu ra, chỉ đếm tới 4 KB để tránh tốn bộ nhớ.
    if _printed[0] < _OUT_LIMIT:
        _printed[0] += sum(len(str(a)) + 1 for a in args)


def _make_builtins():
    b = {}
    for n in _SAFE_BUILTIN_NAMES:
        b[n] = getattr(_real_builtins, n)
    b['print'] = _arena_print
    b['__build_class__'] = _real_builtins.__build_class__
    b['__import__'] = _arena_import
    b['__name__'] = 'builtins'
    return b


def _check(tree):
    """Trả về None nếu hợp lệ, ngược lại là thông điệp tiếng Việt."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name.split('.')[0] not in _ALLOWED_MODULES:
                    return 'Không được import module "' + a.name.split('.')[0] + '"'
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                return 'Không được import tương đối'
            if (node.module or '').split('.')[0] not in _ALLOWED_MODULES:
                return 'Không được import module "' + str(node.module) + '"'
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith('_') or node.attr in _BAD_ATTRS:
                return 'Không được truy cập thuộc tính "' + node.attr + '"'
        elif isinstance(node, ast.Name):
            if node.id.startswith('__') and node.id != '__name__':
                return 'Không được dùng tên "' + node.id + '"'
            if node.id in _BAD_NAMES:
                return 'Không được dùng "' + node.id + '"'
        elif isinstance(node, _ASYNC_NODES):
            return 'Không hỗ trợ cú pháp async/await'
        elif isinstance(node, ast.MatchClass):
            for k in node.kwd_attrs:
                if k.startswith('_') or k in _BAD_ATTRS:
                    return 'Không được truy cập thuộc tính "' + k + '"'
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            for n in node.names:
                if n in _BAD_BIND:
                    return 'Không được dùng tên "' + n + '"'
        for field in ('name', 'asname', 'arg', 'rest'):
            v = getattr(node, field, None)
            if isinstance(v, str) and v in _BAD_BIND:
                return 'Không được dùng tên "' + v + '"'
    return None


def _purge_pyodide():
    for k in list(sys.modules):
        if k in ('js', 'pyodide_js', 'pyodide', '_pyodide', '_pyodide_core') or k.startswith('pyodide.') or k.startswith('_pyodide') or k.startswith('js.'):
            del sys.modules[k]
    keep = []
    for f in sys.meta_path:
        mod = getattr(type(f), '__module__', '') or ''
        if mod.startswith('pyodide') or mod.startswith('_pyodide') or mod == 'js':
            continue
        keep.append(f)
    sys.meta_path[:] = keep
    sys.setrecursionlimit(500)


def _err(e):
    try:
        return type(e).__name__ + ': ' + str(e)[:_REPR_LIMIT]
    except BaseException:
        return 'Error'


def _arena_define(code):
    """Trả JSON: {t: rejected|error|defined, message?}."""
    try:
        tree = ast.parse(code, '<arena>', 'exec')
    except BaseException as e:
        return json.dumps({'t': 'error', 'message': _err(e)})
    reason = _check(tree)
    if reason is not None:
        return json.dumps({'t': 'rejected', 'message': reason})
    try:
        compiled = compile(tree, '<arena>', 'exec')
    except BaseException as e:
        return json.dumps({'t': 'error', 'message': _err(e)})
    _purge_pyodide()
    _user_globals.clear()
    _user_globals['__builtins__'] = _make_builtins()
    _user_globals['__name__'] = 'arena_user'
    try:
        exec(compiled, _user_globals)
    except BaseException as e:
        return json.dumps({'t': 'error', 'message': _err(e)})
    return json.dumps({'t': 'defined'})


def _arena_call(args_json):
    """Trả JSON: {ok, json?, repr?, error?}. args_json được parse mới cho mỗi lần gọi."""
    try:
        fn = _user_globals.get('solve')
        if fn is None or not callable(fn):
            return json.dumps({'ok': False, 'error': 'Không tìm thấy hàm solve'})
        args = json.loads(args_json)
        res = fn(*args)
        out = json.dumps(res, allow_nan=False)
        if len(out) > _JSON_LIMIT:
            return json.dumps({'ok': False, 'error': 'Kết quả quá lớn'})
        rep = repr(res)[:_REPR_LIMIT] if len(out) <= 100000 else out[:_REPR_LIMIT]
        return json.dumps({'ok': True, 'json': out, 'repr': rep})
    except BaseException as e:
        return json.dumps({'ok': False, 'error': _err(e)})
`;
