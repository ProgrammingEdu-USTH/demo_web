export interface MiniTrace {
  poppedOrder: string[];
  visitedOrder: string[];
  hitCycleTrap: boolean;
}

export interface TestCaseResult {
  id: number;
  label: string;
  start: string;
  goal: string;
  expected: number;
  actual: number | null;
  passed: boolean;
  error?: string;
}

export interface GradeSummary {
  results: TestCaseResult[];
  allPassed: boolean;
  compileError?: string;
  trace: MiniTrace;
}

export const MINI_GRAPH: Record<string, string[]> = {
  A: ['B', 'C'],
  B: ['A', 'C'],
  C: ['D'],
  D: [],
};

export const STARTER_MINI_CODE = `from collections import deque

def min_steps(graph, start, goal):
    queue = deque([(start, 0)])
    visited = {start}

    while queue:
        u, dist = queue.popleft()
        if u == goal:
            return dist

        # TODO: Duyệt các đỉnh kề v trong graph[u]
        # Nếu v chưa có trong visited:
        #   1) Thêm v vào visited
        #   2) Đẩy (v, dist + 1) vào queue

    return -1
`;

export const SOLUTION_MINI_CODE = `from collections import deque

def min_steps(graph, start, goal):
    queue = deque([(start, 0)])
    visited = {start}

    while queue:
        u, dist = queue.popleft()
        if u == goal:
            return dist

        for v in graph[u]:
            if v not in visited:
                visited.add(v)
                queue.append((v, dist + 1))

    return -1
`;

// ---------------------------------------------------------------------------
// Lightweight Python Subset Interpreter (Safe, Offline, Deterministic)
// ---------------------------------------------------------------------------

class InfiniteLoopError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InfiniteLoopError';
  }
}

class ReturnSignal {
  constructor(public value: PyVal) {}
}
class BreakSignal {}
class ContinueSignal {}

class PySet {
  items: Set<string | number>;
  constructor(initial: PyVal[] = []) {
    this.items = new Set(initial.map((v) => v as string | number));
  }
  has(v: PyVal): boolean {
    return this.items.has(v as string | number);
  }
  add(v: PyVal) {
    this.items.add(v as string | number);
  }
}

class PyDeque {
  items: PyVal[];
  constructor(initial: PyVal[] = []) {
    this.items = [...initial];
  }
}

interface PyDict {
  [key: string]: PyVal;
}

type PyVal =
  | number
  | string
  | boolean
  | null
  | PyVal[]
  | PySet
  | PyDeque
  | PyDict;

type Token =
  | { type: 'num'; val: number }
  | { type: 'str'; val: string }
  | { type: 'id'; val: string }
  | { type: 'op'; val: string }
  | { type: 'punc'; val: string };

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

function tokenizeExpr(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      i += 1;
      let s = '';
      while (i < src.length && src[i] !== q) {
        s += src[i];
        i += 1;
      }
      if (i >= src.length) throw new Error('Chuỗi chưa đóng dấu nháy.');
      i += 1;
      tokens.push({ type: 'str', val: s });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let numStr = '';
      while (i < src.length && /[0-9.]/.test(src[i])) {
        numStr += src[i];
        i += 1;
      }
      tokens.push({ type: 'num', val: Number(numStr) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) {
        id += src[i];
        i += 1;
      }
      tokens.push({ type: 'id', val: id });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '//', '+=', '-='].includes(two)) {
      tokens.push({ type: 'op', val: two });
      i += 2;
      continue;
    }
    if ('+-*%<>='.includes(ch)) {
      tokens.push({ type: 'op', val: ch });
      i += 1;
      continue;
    }
    if ('()[]{}:,.'.includes(ch)) {
      tokens.push({ type: 'punc', val: ch });
      i += 1;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ: "${ch}"`);
  }
  return tokens;
}

type Stmt =
  | { kind: 'pass' }
  | { kind: 'break' }
  | { kind: 'continue' }
  | { kind: 'return'; expr: string | null }
  | { kind: 'def'; name: string; params: string[]; body: Stmt[] }
  | { kind: 'while'; cond: string; body: Stmt[] }
  | { kind: 'for'; targets: string[]; iter: string; body: Stmt[] }
  | {
      kind: 'if';
      branches: Array<{ cond: string | null; body: Stmt[] }>;
    }
  | { kind: 'assign'; target: string; op: '=' | '+=' | '-='; expr: string }
  | { kind: 'expr'; expr: string };

interface RawLine {
  lineNo: number;
  indent: number;
  text: string;
}

function parseBlock(lines: RawLine[], startIdx: number, minIndent: number): [Stmt[], number] {
  const stmts: Stmt[] = [];
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < minIndent) break;
    if (line.indent > minIndent) {
      throw new Error(`Lỗi thụt lề (IndentationError) ở dòng ${line.lineNo}.`);
    }

    const t = line.text;

    if (t.startsWith('from ') || t.startsWith('import ')) {
      i += 1;
      continue;
    }

    if (t === 'pass') {
      stmts.push({ kind: 'pass' });
      i += 1;
      continue;
    }
    if (t === 'break') {
      stmts.push({ kind: 'break' });
      i += 1;
      continue;
    }
    if (t === 'continue') {
      stmts.push({ kind: 'continue' });
      i += 1;
      continue;
    }
    if (t === 'return' || t.startsWith('return ')) {
      const expr = t === 'return' ? null : t.slice(7).trim();
      stmts.push({ kind: 'return', expr });
      i += 1;
      continue;
    }

    if (t.startsWith('def ')) {
      const m = t.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:$/);
      if (!m) throw new Error(`Cú pháp def không hợp lệ ở dòng ${line.lineNo}.`);
      const params = m[2]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const next = lines[i + 1];
      if (!next || next.indent <= line.indent) {
        throw new Error(`Thiếu thân hàm sau def ở dòng ${line.lineNo}.`);
      }
      const [body, nextIdx] = parseBlock(lines, i + 1, next.indent);
      stmts.push({ kind: 'def', name: m[1], params, body });
      i = nextIdx;
      continue;
    }

    if (t.startsWith('while ') && t.endsWith(':')) {
      const cond = t.slice(6, -1).trim();
      const next = lines[i + 1];
      if (!next || next.indent <= line.indent) {
        throw new Error(`Thiếu thân vòng lặp while ở dòng ${line.lineNo}.`);
      }
      const [body, nextIdx] = parseBlock(lines, i + 1, next.indent);
      stmts.push({ kind: 'while', cond, body });
      i = nextIdx;
      continue;
    }

    if (t.startsWith('for ') && t.endsWith(':')) {
      const inner = t.slice(4, -1).trim();
      const inIdx = inner.indexOf(' in ');
      if (inIdx < 0) {
        throw new Error(`Cú pháp for không hợp lệ ở dòng ${line.lineNo}.`);
      }
      const targets = inner
        .slice(0, inIdx)
        .replace(/[()]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const iter = inner.slice(inIdx + 4).trim();
      const next = lines[i + 1];
      if (!next || next.indent <= line.indent) {
        throw new Error(`Thiếu thân vòng lặp for ở dòng ${line.lineNo}.`);
      }
      const [body, nextIdx] = parseBlock(lines, i + 1, next.indent);
      stmts.push({ kind: 'for', targets, iter, body });
      i = nextIdx;
      continue;
    }

    if (t.startsWith('if ') && t.endsWith(':')) {
      const branches: Array<{ cond: string | null; body: Stmt[] }> = [];
      const firstCond = t.slice(3, -1).trim();
      const firstNext = lines[i + 1];
      if (!firstNext || firstNext.indent <= line.indent) {
        throw new Error(`Thiếu thân lệnh if ở dòng ${line.lineNo}.`);
      }
      const [firstBody, afterFirst] = parseBlock(lines, i + 1, firstNext.indent);
      branches.push({ cond: firstCond, body: firstBody });
      i = afterFirst;

      while (i < lines.length && lines[i].indent === line.indent) {
        const cur = lines[i].text;
        if (cur.startsWith('elif ') && cur.endsWith(':')) {
          const elifCond = cur.slice(5, -1).trim();
          const next = lines[i + 1];
          if (!next || next.indent <= line.indent) {
            throw new Error(`Thiếu thân elif ở dòng ${lines[i].lineNo}.`);
          }
          const [elifBody, afterElif] = parseBlock(lines, i + 1, next.indent);
          branches.push({ cond: elifCond, body: elifBody });
          i = afterElif;
        } else if (cur === 'else:') {
          const next = lines[i + 1];
          if (!next || next.indent <= line.indent) {
            throw new Error(`Thiếu thân else ở dòng ${lines[i].lineNo}.`);
          }
          const [elseBody, afterElse] = parseBlock(lines, i + 1, next.indent);
          branches.push({ cond: null, body: elseBody });
          i = afterElse;
          break;
        } else {
          break;
        }
      }

      stmts.push({ kind: 'if', branches });
      continue;
    }

    // Check assignment (=, +=, -=) outside brackets
    const assignMatch = splitTopLevelAssignment(t);
    if (assignMatch) {
      stmts.push({
        kind: 'assign',
        target: assignMatch.target,
        op: assignMatch.op,
        expr: assignMatch.expr,
      });
      i += 1;
      continue;
    }

    stmts.push({ kind: 'expr', expr: t });
    i += 1;
  }

  return [stmts, i];
}

function splitTopLevelAssignment(
  line: string
): { target: string; op: '=' | '+=' | '-='; expr: string } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (depth === 0) {
      const two = line.slice(i, i + 2);
      if (two === '+=' || two === '-=') {
        return {
          target: line.slice(0, i).trim(),
          op: two,
          expr: line.slice(i + 2).trim(),
        };
      }
      if (
        ch === '=' &&
        line[i + 1] !== '=' &&
        line[i - 1] !== '!' &&
        line[i - 1] !== '<' &&
        line[i - 1] !== '>'
      ) {
        return {
          target: line.slice(0, i).trim(),
          op: '=',
          expr: line.slice(i + 1).trim(),
        };
      }
    }
  }
  return null;
}

function isTruthy(val: PyVal): boolean {
  if (val === null || val === false || val === 0 || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (val instanceof PySet) return val.items.size > 0;
  if (val instanceof PyDeque) return val.items.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
}

function pyContains(needle: PyVal, haystack: PyVal): boolean {
  if (haystack instanceof PySet) return haystack.has(needle);
  if (haystack instanceof PyDeque) return haystack.items.includes(needle);
  if (Array.isArray(haystack)) return haystack.includes(needle);
  if (typeof haystack === 'string' && typeof needle === 'string') {
    return haystack.includes(needle);
  }
  if (haystack && typeof haystack === 'object') {
    return String(needle) in haystack;
  }
  return false;
}

function toIterable(val: PyVal): PyVal[] {
  if (Array.isArray(val)) return val;
  if (val instanceof PyDeque) return val.items;
  if (val instanceof PySet) return Array.from(val.items);
  if (typeof val === 'string') return val.split('');
  if (val && typeof val === 'object') return Object.keys(val);
  throw new Error('Đối tượng không thể duyệt bằng vòng lặp for.');
}

class ExprEvaluator {
  private pos = 0;
  private tokens: Token[];
  constructor(
    src: string,
    private env: Record<string, PyVal>,
    private trace?: MiniTrace
  ) {
    this.tokens = tokenizeExpr(src);
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  evaluate(): PyVal {
    const val = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Cú pháp biểu thức chưa hợp lệ gần "${this.peek()?.val}".`);
    }
    return val;
  }

  private parseOr(): PyVal {
    let left = this.parseAnd();
    while (this.peek()?.type === 'id' && this.peek()?.val === 'or') {
      this.next();
      const right = this.parseAnd();
      left = isTruthy(left) ? left : right;
    }
    return left;
  }

  private parseAnd(): PyVal {
    let left = this.parseNot();
    while (this.peek()?.type === 'id' && this.peek()?.val === 'and') {
      this.next();
      const right = this.parseNot();
      left = isTruthy(left) ? right : left;
    }
    return left;
  }

  private parseNot(): PyVal {
    if (this.peek()?.type === 'id' && this.peek()?.val === 'not') {
      this.next();
      return !isTruthy(this.parseNot());
    }
    return this.parseCmp();
  }

  private parseCmp(): PyVal {
    const left = this.parseAdd();
    const t1 = this.peek();
    if (!t1) return left;

    if (t1.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(t1.val)) {
      this.next();
      const right = this.parseAdd();
      switch (t1.val) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '<':
          return (left as number) < (right as number);
        case '<=':
          return (left as number) <= (right as number);
        case '>':
          return (left as number) > (right as number);
        case '>=':
          return (left as number) >= (right as number);
      }
    }

    if (t1.type === 'id' && t1.val === 'in') {
      this.next();
      const right = this.parseAdd();
      return pyContains(left, right);
    }

    if (
      t1.type === 'id' &&
      t1.val === 'not' &&
      this.peek(1)?.type === 'id' &&
      this.peek(1)?.val === 'in'
    ) {
      this.next();
      this.next();
      const right = this.parseAdd();
      return !pyContains(left, right);
    }

    return left;
  }

  private parseAdd(): PyVal {
    let left = this.parseMul();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()?.val === '+' || this.peek()?.val === '-')
    ) {
      const op = this.next()!.val;
      const right = this.parseMul();
      left = op === '+' ? (left as number) + (right as number) : (left as number) - (right as number);
    }
    return left;
  }

  private parseMul(): PyVal {
    let left = this.parseUnary();
    while (
      this.peek()?.type === 'op' &&
      ['*', '//', '%'].includes(String(this.peek()?.val))
    ) {
      const op = this.next()!.val;
      const right = this.parseUnary();
      if (op === '*') left = (left as number) * (right as number);
      else if (op === '//') left = Math.floor((left as number) / (right as number));
      else left = (left as number) % (right as number);
    }
    return left;
  }

  private parseUnary(): PyVal {
    if (this.peek()?.type === 'op' && this.peek()?.val === '-') {
      this.next();
      return -(this.parseUnary() as number);
    }
    if (this.peek()?.type === 'op' && this.peek()?.val === '+') {
      this.next();
      return +(this.parseUnary() as number);
    }
    return this.parsePostfix();
  }

  private parsePostfix(): PyVal {
    let obj = this.parsePrimary();
    while (this.peek()) {
      const p = this.peek()!;
      if (p.type === 'punc' && p.val === '.') {
        this.next();
        const methodTok = this.next();
        if (!methodTok || methodTok.type !== 'id') {
          throw new Error('Tên phương thức không hợp lệ sau dấu chấm.');
        }
        const args = this.parseArgList();
        obj = this.callMethod(obj, methodTok.val, args);
      } else if (p.type === 'punc' && p.val === '[') {
        this.next();
        const idx = this.parseOr();
        if (this.next()?.val !== ']') {
          throw new Error('Thiếu dấu ngoặc vuông đóng ].');
        }
        if (Array.isArray(obj)) {
          const i = idx as number;
          obj = i < 0 ? obj[obj.length + i] : obj[i];
        } else if (obj instanceof PyDeque) {
          const i = idx as number;
          obj = i < 0 ? obj.items[obj.items.length + i] : obj.items[i];
        } else if (obj && typeof obj === 'object') {
          obj = (obj as Record<string, PyVal>)[String(idx)];
        } else {
          throw new Error('Không thể truy cập chỉ mục [...] trên giá trị này.');
        }
      } else if (p.type === 'punc' && p.val === '(') {
        const args = this.parseArgList();
        obj = this.callBuiltin(obj, args);
      } else {
        break;
      }
    }
    return obj;
  }

  private parseArgList(): PyVal[] {
    if (this.next()?.val !== '(') throw new Error('Thiếu dấu mở ngoặc (.');
    const args: PyVal[] = [];
    if (this.peek()?.val === ')') {
      this.next();
      return args;
    }
    while (true) {
      args.push(this.parseOr());
      if (this.peek()?.val === ',') {
        this.next();
        if (this.peek()?.val === ')') {
          this.next();
          break;
        }
      } else if (this.peek()?.val === ')') {
        this.next();
        break;
      } else {
        throw new Error('Thiếu dấu phẩy hoặc dấu đóng ngoặc ).');
      }
    }
    return args;
  }

  private callBuiltin(fnName: PyVal, args: PyVal[]): PyVal {
    if (fnName === '__deque__') {
      const init = args[0] ? toIterable(args[0]) : [];
      return new PyDeque(init);
    }
    if (fnName === '__set__') {
      const init = args[0] ? toIterable(args[0]) : [];
      return new PySet(init);
    }
    if (fnName === '__len__') {
      const x = args[0];
      if (Array.isArray(x) || typeof x === 'string') return x.length;
      if (x instanceof PyDeque) return x.items.length;
      if (x instanceof PySet) return x.items.size;
      if (x && typeof x === 'object') return Object.keys(x).length;
      return 0;
    }
    if (fnName === '__range__') {
      const start = args.length === 1 ? 0 : (args[0] as number);
      const stop = args.length === 1 ? (args[0] as number) : (args[1] as number);
      const out: number[] = [];
      for (let k = start; k < stop; k += 1) out.push(k);
      return out;
    }
    throw new Error(`Hàm chưa được hỗ trợ trong sandbox: ${String(fnName)}`);
  }

  private callMethod(obj: PyVal, method: string, args: PyVal[]): PyVal {
    if (obj instanceof PyDeque) {
      if (method === 'popleft') {
        if (obj.items.length === 0) throw new Error('Pop từ deque rỗng!');
        const popped = obj.items.shift()!;
        if (this.trace) {
          const node = Array.isArray(popped) ? String(popped[0]) : String(popped);
          this.trace.poppedOrder.push(node);
        }
        return popped;
      }
      if (method === 'pop') {
        if (obj.items.length === 0) throw new Error('Pop từ deque rỗng!');
        const popped = args[0] === 0 ? obj.items.shift()! : obj.items.pop()!;
        if (this.trace) {
          const node = Array.isArray(popped) ? String(popped[0]) : String(popped);
          this.trace.poppedOrder.push(node);
        }
        return popped;
      }
      if (method === 'append') {
        obj.items.push(args[0]);
        return null;
      }
    }

    if (Array.isArray(obj)) {
      if (method === 'pop') {
        if (obj.length === 0) throw new Error('Pop từ list rỗng!');
        const popped = args[0] === 0 ? obj.shift()! : obj.pop()!;
        if (this.trace) {
          const node = Array.isArray(popped) ? String(popped[0]) : String(popped);
          this.trace.poppedOrder.push(node);
        }
        return popped;
      }
      if (method === 'append') {
        obj.push(args[0]);
        return null;
      }
    }

    if (obj instanceof PySet) {
      if (method === 'add') {
        obj.add(args[0]);
        if (this.trace) {
          this.trace.visitedOrder.push(String(args[0]));
        }
        return null;
      }
    }

    if (
      obj &&
      typeof obj === 'object' &&
      !Array.isArray(obj) &&
      !(obj instanceof PySet) &&
      !(obj instanceof PyDeque)
    ) {
      if (method === 'get') {
        const key = String(args[0]);
        return key in obj ? obj[key] : (args[1] ?? null);
      }
    }

    throw new Error(`Phương thức .${method}() không được hỗ trợ.`);
  }

  private parsePrimary(): PyVal {
    const t = this.next();
    if (!t) throw new Error('Biểu thức chưa hoàn chỉnh.');
    if (t.type === 'num' || t.type === 'str') return t.val;

    if (t.type === 'id') {
      if (t.val === 'True') return true;
      if (t.val === 'False') return false;
      if (t.val === 'None') return null;
      if (t.val === 'deque') return '__deque__';
      if (t.val === 'set') return '__set__';
      if (t.val === 'len') return '__len__';
      if (t.val === 'range') return '__range__';
      if (t.val in this.env) return this.env[t.val];
      throw new Error(`Biến chưa được khai báo: "${t.val}"`);
    }

    if (t.type === 'punc' && t.val === '(') {
      if (this.peek()?.val === ')') {
        this.next();
        return [];
      }
      const first = this.parseOr();
      if (this.peek()?.val === ',') {
        const tupleItems: PyVal[] = [first];
        while (this.peek()?.val === ',') {
          this.next();
          if (this.peek()?.val === ')') break;
          tupleItems.push(this.parseOr());
        }
        if (this.next()?.val !== ')') throw new Error('Thiếu dấu đóng ngoặc ).');
        return tupleItems;
      }
      if (this.next()?.val !== ')') throw new Error('Thiếu dấu đóng ngoặc ).');
      return first;
    }

    if (t.type === 'punc' && t.val === '[') {
      const items: PyVal[] = [];
      if (this.peek()?.val !== ']') {
        while (true) {
          items.push(this.parseOr());
          if (this.peek()?.val === ',') {
            this.next();
            if (this.peek()?.val === ']') break;
          } else break;
        }
      }
      if (this.next()?.val !== ']') throw new Error('Thiếu dấu đóng ngoặc ].');
      return items;
    }

    if (t.type === 'punc' && t.val === '{') {
      if (this.peek()?.val === '}') {
        this.next();
        return {};
      }
      const first = this.parseOr();
      if (this.peek()?.val === ':') {
        this.next();
        const dict: Record<string, PyVal> = {};
        dict[String(first)] = this.parseOr();
        while (this.peek()?.val === ',') {
          this.next();
          if (this.peek()?.val === '}') break;
          const k = this.parseOr();
          if (this.next()?.val !== ':') throw new Error('Thiếu dấu : trong dict.');
          dict[String(k)] = this.parseOr();
        }
        if (this.next()?.val !== '}') throw new Error('Thiếu dấu đóng ngoặc }.');
        return dict;
      }
      const setItems: PyVal[] = [first];
      while (this.peek()?.val === ',') {
        this.next();
        if (this.peek()?.val === '}') break;
        setItems.push(this.parseOr());
      }
      if (this.next()?.val !== '}') throw new Error('Thiếu dấu đóng ngoặc }.');
      return new PySet(setItems);
    }

    throw new Error(`Không hiểu cú pháp gần "${t.val}".`);
  }
}

function execBlock(
  stmts: Stmt[],
  env: Record<string, PyVal>,
  budget: { steps: number },
  trace?: MiniTrace
): void {
  for (const stmt of stmts) {
    if (stmt.kind === 'pass') continue;
    if (stmt.kind === 'break') throw new BreakSignal();
    if (stmt.kind === 'continue') throw new ContinueSignal();
    if (stmt.kind === 'return') {
      const val = stmt.expr
        ? new ExprEvaluator(stmt.expr, env, trace).evaluate()
        : null;
      throw new ReturnSignal(val);
    }
    if (stmt.kind === 'expr') {
      new ExprEvaluator(stmt.expr, env, trace).evaluate();
      continue;
    }
    if (stmt.kind === 'assign') {
      const rhs = new ExprEvaluator(stmt.expr, env, trace).evaluate();
      const target = stmt.target;
      const bracketMatch = target.match(/^([A-Za-z_][A-Za-z0-9_]*)\[(.+)\]$/);
      if (bracketMatch) {
        const dictObj = env[bracketMatch[1]] as Record<string, PyVal>;
        const key = String(
          new ExprEvaluator(bracketMatch[2], env, trace).evaluate()
        );
        if (stmt.op === '=') dictObj[key] = rhs;
        else if (stmt.op === '+=')
          dictObj[key] = (dictObj[key] as number) + (rhs as number);
        else dictObj[key] = (dictObj[key] as number) - (rhs as number);
        continue;
      }

      const tupleNames = target
        .replace(/[()]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (tupleNames.length > 1) {
        const arr = toIterable(rhs);
        if (arr.length !== tupleNames.length) {
          throw new Error(
            `Lỗi giải nén tuple: cần ${tupleNames.length} giá trị nhưng nhận ${arr.length}.`
          );
        }
        tupleNames.forEach((name, idx) => {
          env[name] = arr[idx];
        });
      } else {
        const name = tupleNames[0];
        if (stmt.op === '=') env[name] = rhs;
        else if (stmt.op === '+=')
          env[name] = (env[name] as number) + (rhs as number);
        else env[name] = (env[name] as number) - (rhs as number);
      }
      continue;
    }
    if (stmt.kind === 'if') {
      for (const br of stmt.branches) {
        if (
          br.cond === null ||
          isTruthy(new ExprEvaluator(br.cond, env, trace).evaluate())
        ) {
          execBlock(br.body, env, budget, trace);
          break;
        }
      }
      continue;
    }
    if (stmt.kind === 'while') {
      while (isTruthy(new ExprEvaluator(stmt.cond, env, trace).evaluate())) {
        budget.steps += 1;
        if (budget.steps > 250) {
          if (trace) trace.hitCycleTrap = true;
          throw new InfiniteLoopError(
            'Vòng lặp vượt quá 250 bước (Lặp vô hạn ở chu trình A ↔ B)! Kiểm tra xem bạn đã dùng visited chưa.'
          );
        }
        try {
          execBlock(stmt.body, env, budget, trace);
        } catch (sig) {
          if (sig instanceof BreakSignal) break;
          if (sig instanceof ContinueSignal) continue;
          throw sig;
        }
      }
      continue;
    }
    if (stmt.kind === 'for') {
      const iterable = toIterable(
        new ExprEvaluator(stmt.iter, env, trace).evaluate()
      );
      for (const item of iterable) {
        budget.steps += 1;
        if (budget.steps > 250) {
          if (trace) trace.hitCycleTrap = true;
          throw new InfiniteLoopError(
            'Vòng lặp vượt quá 250 bước! Kiểm tra điều kiện dừng hoặc visited.'
          );
        }
        if (stmt.targets.length > 1) {
          const arr = toIterable(item);
          stmt.targets.forEach((name, idx) => {
            env[name] = arr[idx];
          });
        } else {
          env[stmt.targets[0]] = item;
        }
        try {
          execBlock(stmt.body, env, budget, trace);
        } catch (sig) {
          if (sig instanceof BreakSignal) break;
          if (sig instanceof ContinueSignal) continue;
          throw sig;
        }
      }
    }
  }
}

export function gradeUserMiniBfs(sourceCode: string): GradeSummary {
  const emptyTrace: MiniTrace = {
    poppedOrder: [],
    visitedOrder: [],
    hitCycleTrap: false,
  };

  let minStepsFn: Extract<Stmt, { kind: 'def' }> | undefined;
  try {
    const rawLines: RawLine[] = sourceCode
      .split(/\r?\n/)
      .map((raw, idx) => {
        const cleaned = stripComment(raw);
        const trimmed = cleaned.trim();
        if (!trimmed) return null;
        const indent = cleaned.length - cleaned.trimStart().length;
        return { lineNo: idx + 1, indent, text: trimmed };
      })
      .filter((x): x is RawLine => x !== null);

    const [topStmts] = parseBlock(rawLines, 0, 0);
    minStepsFn = topStmts.find(
      (s): s is Extract<Stmt, { kind: 'def' }> =>
        s.kind === 'def' && s.name === 'min_steps'
    );
    if (!minStepsFn) {
      return {
        results: [],
        allPassed: false,
        compileError: 'Không tìm thấy hàm `def min_steps(graph, start, goal):`.',
        trace: emptyTrace,
      };
    }
  } catch (err) {
    return {
      results: [],
      allPassed: false,
      compileError:
        err instanceof Error ? err.message : 'Lỗi cú pháp Python.',
      trace: emptyTrace,
    };
  }

  const cases = [
    { id: 1, label: 'A ➔ D (Đường ngắn nhất 2 bước)', start: 'A', goal: 'D', expected: 2 },
    { id: 2, label: 'B ➔ D (Tránh quay lại A)', start: 'B', goal: 'D', expected: 2 },
    { id: 3, label: 'A ➔ A (Đích trùng xuất phát)', start: 'A', goal: 'A', expected: 0 },
    { id: 4, label: 'D ➔ A (Không có đường đi)', start: 'D', goal: 'A', expected: -1 },
  ];

  const traceForFirst: MiniTrace = {
    poppedOrder: [],
    visitedOrder: ['A'],
    hitCycleTrap: false,
  };

  const results: TestCaseResult[] = cases.map((tc, idx) => {
    const graphClone: Record<string, string[]> = {};
    for (const k of Object.keys(MINI_GRAPH)) {
      graphClone[k] = [...MINI_GRAPH[k]];
    }
    const env: Record<string, PyVal> = {
      [minStepsFn!.params[0] ?? 'graph']: graphClone,
      [minStepsFn!.params[1] ?? 'start']: tc.start,
      [minStepsFn!.params[2] ?? 'goal']: tc.goal,
    };
    const budget = { steps: 0 };
    const activeTrace = idx === 0 ? traceForFirst : undefined;

    try {
      execBlock(minStepsFn!.body, env, budget, activeTrace);
      return {
        ...tc,
        actual: null,
        passed: false,
        error: 'Hàm kết thúc mà chưa có `return` kết quả.',
      };
    } catch (sig) {
      if (sig instanceof ReturnSignal) {
        const actual = typeof sig.value === 'number' ? sig.value : null;
        return {
          ...tc,
          actual,
          passed: actual === tc.expected,
          error:
            actual === null
              ? `Giá trị trả về phải là số nguyên, nhận được: ${String(sig.value)}`
              : undefined,
        };
      }
      return {
        ...tc,
        actual: null,
        passed: false,
        error: sig instanceof Error ? sig.message : 'Lỗi khi chạy hàm.',
      };
    }
  });

  return {
    results,
    allPassed: results.every((r) => r.passed),
    trace: traceForFirst,
  };
}
