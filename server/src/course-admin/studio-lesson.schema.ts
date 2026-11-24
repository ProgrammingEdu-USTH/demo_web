/**
 * studio-lesson/v1 — cấu trúc một bài Python Studio lưu trong
 * `lessons.content_json`. Bản sao của frontend/src/lib/studio-lesson.ts; giữ hai
 * bên khớp nhau khi đổi schema.
 *
 * RÀNG BUỘC: trắc nghiệm PHẢI nằm ở `step_2.mcq`. QuizzesService.collectQuestions()
 * đọc đúng đường dẫn đó để dựng quiz ôn tập (src/quizzes/quizzes.service.ts).
 */

export const STUDIO_LESSON_SCHEMA = 'studio-lesson/v1';
/** v1 + khối `play` (mini-game của khoá Python Advanced). */
export const STUDIO_LESSON_SCHEMA_V2 = 'studio-lesson/v2';

export const PLAY_GAME_TYPES = [
  'traceTable',
  'match',
  'trueFalse',
  'fill',
  'parsons',
  'spotError',
  'debug',
  'selfExplain',
] as const;

export type McqOption =
  string | { text: string; correct?: boolean; detail?: string };

export interface Mcq {
  question: string;
  options: McqOption[];
  correct?: number;
  explanation?: string;
}

/**
 * step_4.procedure: các bước quy trình của bài không có mã Python để chạy.
 * step_4.files / contracts / gate / env: thêm cho giáo trình PE v3 (xem
 * scripts/pe-v3/README.md) — kiểu chi tiết ở frontend/src/lib/studio-lesson.ts.
 * step_4.packages: (khoá Python Advanced pe-v4) thư viện Pyodide bài cần — numpy,
 * pandas, matplotlib, sqlite3. scripts/pe-v4/build.py đã chặn giá trị lạ; ở đây
 * không kiểm thêm vì worker tự bỏ qua gói nó không có.
 */
export interface StudioLesson {
  schema?: string;
  title?: string;
  subtitle?: string;
  source?: {
    kind?: string;
    filename?: string;
    parser?: string;
    importedAt?: string;
  };
  step_1?: Record<string, unknown>;
  step_2?: { mcq?: Mcq[] } & Record<string, unknown>;
  step_3?: Record<string, unknown>;
  step_4?: Record<string, unknown>;
  play?: Record<string, unknown>;
}

export const STEP_KEYS = ['step_1', 'step_2', 'step_3', 'step_4'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Kiểm tra một bản nháp trước khi cho lưu. Trả danh sách lỗi theo đường dẫn
 * field để admin biết sửa chỗ nào — KHÔNG ném exception, người gọi quyết định.
 */
export function validateStudioLesson(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ['Nội dung phải là một object JSON.'];

  const lesson = value as StudioLesson;

  if (!nonEmptyString(lesson.title)) {
    errors.push('title: thiếu tiêu đề bài học.');
  }

  const present = STEP_KEYS.filter((key) => {
    const step = lesson[key];
    return isObject(step) && Object.keys(step).length > 0;
  });
  if (present.length === 0) {
    errors.push(
      'step_1..step_4: không có bước nào có nội dung. Cần ít nhất một bước.',
    );
  }

  const one = lesson.step_1;
  if (isObject(one) && isObject(one.predict)) {
    const predict = one.predict as Record<string, unknown>;
    const options = predict.options;
    if (!Array.isArray(options) || options.length < 2) {
      errors.push('step_1.predict.options: cần ít nhất 2 lựa chọn.');
    } else if (!options.some((o) => isObject(o) && o.correct === true)) {
      errors.push('step_1.predict.options: phải đánh dấu đúng một đáp án.');
    }
  }

  if (isObject(one)) errors.push(...validateTheory(one));

  const two = lesson.step_2;
  if (isObject(two) && two.mcq !== undefined) {
    if (!Array.isArray(two.mcq)) {
      errors.push('step_2.mcq: phải là mảng câu hỏi.');
    } else {
      two.mcq.forEach((q, i) => {
        const at = `step_2.mcq[${i}]`;
        if (!isObject(q)) return errors.push(`${at}: phải là object.`);
        if (!nonEmptyString(q.question))
          errors.push(`${at}.question: thiếu đề bài.`);
        const options = (q as Mcq).options;
        if (!Array.isArray(options) || options.length < 2) {
          errors.push(`${at}.options: cần ít nhất 2 lựa chọn.`);
          return;
        }
        const flagged = options.some(
          (o) => isObject(o) && (o as { correct?: boolean }).correct === true,
        );
        const indexed =
          typeof (q as Mcq).correct === 'number' &&
          (q as Mcq).correct! >= 0 &&
          (q as Mcq).correct! < options.length;
        if (!flagged && !indexed) {
          errors.push(`${at}.correct: chưa chỉ ra đáp án đúng.`);
        }
      });
    }
  }
  if (isObject(two) && isObject(two.classify)) {
    const classify = two.classify as Record<string, unknown>;
    const bins = classify.bins;
    const tokens = classify.tokens;
    if (!Array.isArray(bins) || bins.length < 2) {
      errors.push('step_2.classify.bins: cần ít nhất 2 nhóm.');
    }
    if (!Array.isArray(tokens) || tokens.length === 0) {
      errors.push('step_2.classify.tokens: cần ít nhất 1 thẻ.');
    }
    if (Array.isArray(bins) && Array.isArray(tokens)) {
      const keys = new Set(
        bins.filter(isObject).map((b) => String((b as { key: string }).key)),
      );
      tokens.filter(isObject).forEach((t, i) => {
        const bin = String((t as { bin?: string }).bin ?? '');
        if (!keys.has(bin)) {
          errors.push(
            `step_2.classify.tokens[${i}].bin: "${bin}" không khớp nhóm nào.`,
          );
        }
      });
    }
  }

  const three = lesson.step_3;
  if (isObject(three) && isObject(three.scaffold)) {
    const scaffold = three.scaffold as Record<string, unknown>;
    const template = scaffold.template;
    const slots = scaffold.slots;
    if (!nonEmptyString(template)) {
      errors.push('step_3.scaffold.template: thiếu khung mã.');
    }
    if (!Array.isArray(slots) || slots.length === 0) {
      errors.push('step_3.scaffold.slots: cần ít nhất 1 slot.');
    } else if (nonEmptyString(template)) {
      slots.filter(isObject).forEach((slot) => {
        const n = (slot as { n?: number }).n;
        if (!String(template).includes(`{{slot${n}}}`)) {
          errors.push(`step_3.scaffold.template: thiếu chỗ đặt {{slot${n}}}.`);
        }
        if (!nonEmptyString((slot as { answer?: string }).answer)) {
          errors.push(`step_3.scaffold.slots: slot ${n} thiếu đáp án.`);
        }
      });
    }
  }

  const four = lesson.step_4;
  if (isObject(four)) {
    const tests = four.tests;
    if (tests !== undefined) {
      if (!Array.isArray(tests) || tests.length === 0) {
        errors.push('step_4.tests: cần ít nhất 1 trường hợp kiểm thử.');
      } else {
        tests.forEach((t, i) => {
          if (!isObject(t)) return errors.push(`step_4.tests[${i}]: sai kiểu.`);
          if (!nonEmptyString(t.call))
            errors.push(`step_4.tests[${i}].call: thiếu biểu thức gọi hàm.`);
          if (!nonEmptyString(t.expect))
            errors.push(`step_4.tests[${i}].expect: thiếu kết quả mong đợi.`);
        });
      }
    }
    // Bước sandbox mà không có test thì học viên không thể nộp bài.
    if (nonEmptyString(four.starterCode) && !Array.isArray(tests)) {
      errors.push('step_4.tests: có code khởi tạo thì phải có phần Test.');
    }
    // File cấp sẵn (language_base.py, data.txt…) được ghi vào thư mục chạy bài
    // trong trình duyệt — tên phải là tên file trơn, không có đường dẫn.
    if (four.files !== undefined) {
      if (!Array.isArray(four.files)) {
        errors.push('step_4.files: phải là mảng { name, content }.');
      } else {
        four.files.forEach((f, i) => {
          if (!isObject(f)) return errors.push(`step_4.files[${i}]: sai kiểu.`);
          const name = f.name;
          if (!nonEmptyString(name) || !/^[\w.-]+$/.test(String(name)))
            errors.push(
              `step_4.files[${i}].name: cần tên file trơn (chữ, số, . _ -).`,
            );
          if (typeof f.content !== 'string')
            errors.push(`step_4.files[${i}].content: phải là chuỗi.`);
        });
      }
    }
  }

  if (lesson.play !== undefined) errors.push(...validatePlay(lesson));

  return errors;
}

/**
 * step_1.theory + step_1.figure — khối LÝ THUYẾT và hình minh hoạ của khoá
 * python_advanced (scripts/pe-v4, chặng M1–M3). Chỉ chạy khi bài có khai: bài cũ
 * và M4–M8 không có hai khoá này nên không bị siết thêm luật nào.
 *
 * Kiểm cái gì: frontend dựng màn `theory` rồi vẽ hình bằng
 * `<img src={figure.src} alt={figure.alt}>`. Thiếu `src` thì ảnh vỡ, thiếu `alt`
 * thì trình đọc màn hình đọc ra đường dẫn file. Giới hạn ĐỘ DÀI thì không kiểm ở
 * đây — đó là việc của build.py; chỗ này chỉ chặn dữ liệu không dựng được màn.
 */
function validateFigure(value: unknown, at: string): string[] {
  if (!isObject(value)) return [`${at}: phải là object { src, caption, alt }.`];
  const errors: string[] = [];
  const src = value.src;
  if (!nonEmptyString(src)) errors.push(`${at}.src: thiếu đường dẫn hình.`);
  else if (!/^\/[\w./-]+\.svg$/.test(String(src)))
    errors.push(
      `${at}.src: phải là đường dẫn cùng miền tới file .svg (vd. /static/anim/P02-lifecycle.svg).`,
    );
  if (!nonEmptyString(value.caption)) errors.push(`${at}.caption: thiếu chú thích.`);
  if (!nonEmptyString(value.alt)) errors.push(`${at}.alt: thiếu mô tả cho trình đọc màn hình.`);
  return errors;
}

function validateTheory(one: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (one.figure !== undefined) errors.push(...validateFigure(one.figure, 'step_1.figure'));
  if (one.theory === undefined) return errors;
  if (!Array.isArray(one.theory)) return [...errors, 'step_1.theory: phải là mảng khối lý thuyết.'];
  if (one.theory.length === 0)
    return [...errors, 'step_1.theory: mảng rỗng — bỏ hẳn khoá này nếu bài không có lý thuyết.'];
  one.theory.forEach((block, i) => {
    const at = `step_1.theory[${i}]`;
    if (!isObject(block)) return errors.push(`${at}: phải là object.`);
    if (!nonEmptyString(block.title)) errors.push(`${at}.title: thiếu tiêu đề khối.`);
    const bullets = block.bullets;
    if (bullets !== undefined) {
      if (!Array.isArray(bullets)) errors.push(`${at}.bullets: phải là mảng chuỗi.`);
      else if (!bullets.every((b) => nonEmptyString(b)))
        errors.push(`${at}.bullets: mỗi gạch đầu dòng phải là chuỗi không rỗng.`);
    }
    const hasBullets = Array.isArray(bullets) && bullets.length > 0;
    if (!nonEmptyString(block.body) && !hasBullets)
      errors.push(`${at}: phải có body hoặc bullets — khối rỗng không hiện được gì.`);
    if (block.figure !== undefined && block.figure !== null)
      errors.push(...validateFigure(block.figure, `${at}.figure`));
  });
  return errors;
}

/** Kiểm tra khối `play`: game phải đủ dữ liệu để chơi và chấm được. */
function validatePlay(lesson: StudioLesson): string[] {
  const errors: string[] = [];
  const play = lesson.play;
  if (!isObject(play)) return ['play: phải là object.'];
  if (!Array.isArray(play.games) || play.games.length === 0)
    return ['play.games: cần ít nhất 1 game.'];
  const ids = new Set<string>();
  play.games.forEach((g, i) => {
    const at = `play.games[${i}]`;
    if (!isObject(g)) return errors.push(`${at}: phải là object.`);
    const id = String(g.id ?? '');
    if (!nonEmptyString(id)) errors.push(`${at}.id: thiếu id.`);
    else if (ids.has(id)) errors.push(`${at}.id: trùng "${id}".`);
    ids.add(id);
    const type = String(g.type ?? '');
    if (!(PLAY_GAME_TYPES as readonly string[]).includes(type)) {
      errors.push(`${at}.type: "${type}" không phải loại game hợp lệ.`);
      return;
    }
    const need = (cond: boolean, msg: string) => {
      if (!cond) errors.push(`${at} (${type}): ${msg}`);
    };
    const four = lesson.step_4;
    const hasTests =
      isObject(four) && Array.isArray(four.tests) && four.tests.length > 0;
    switch (type) {
      case 'traceTable':
        need(
          Array.isArray(g.columns) && g.columns.length > 0,
          'thiếu columns.',
        );
        need(Array.isArray(g.rows) && g.rows.length > 0, 'thiếu rows.');
        need(
          isObject(g.answers) && Object.keys(g.answers).length > 0,
          'không có ô nào để điền.',
        );
        break;
      case 'match':
        need(
          Array.isArray(g.pairs) && g.pairs.length >= 2,
          'cần ít nhất 2 cặp.',
        );
        need(
          Array.isArray(g.rightOrder) &&
            Array.isArray(g.pairs) &&
            g.rightOrder.length === g.pairs.length,
          'rightOrder phải có đúng số phần tử của pairs.',
        );
        break;
      case 'trueFalse':
        need(Array.isArray(g.items) && g.items.length > 0, 'thiếu items.');
        break;
      case 'fill':
        need(
          isObject(lesson.step_3) && isObject(lesson.step_3.scaffold),
          'cần step_3.scaffold.',
        );
        break;
      case 'parsons':
        need(
          Array.isArray(g.lines) && g.lines.length >= 2,
          'cần ít nhất 2 dòng để xếp.',
        );
        need(Array.isArray(g.order), 'thiếu order.');
        need(hasTests, 'chấm bằng chạy code nên bài phải có step_4.tests.');
        break;
      case 'spotError':
        need(nonEmptyString(g.code), 'thiếu code.');
        need(typeof g.line === 'number', 'thiếu số dòng lỗi.');
        break;
      case 'debug':
        need(nonEmptyString(g.code), 'thiếu code cần sửa.');
        need(hasTests, 'chấm bằng chạy code nên bài phải có step_4.tests.');
        break;
      case 'selfExplain':
        need(
          isObject(lesson.step_2) && isObject(lesson.step_2.selfExplain),
          'cần step_2.selfExplain.',
        );
        break;
    }
  });
  return errors;
}
