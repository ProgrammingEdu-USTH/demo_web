// Màn mở đầu "một màn" của bài học — dịch từ Figma "PE Python v3 — 20 bài cơ bản
// B01–B20" (frame B01…B20, cùng một mẫu): nhãn chặng → tiêu đề → mục tiêu → thẻ
// NHIỆM VỤ → thẻ DỰ ĐOÁN → khung main.py → CA KIỂM TRA CÔNG KHAI → câu hỏi tự
// trả lời (Figma ghi "Giải thích trước khi xem đáp án", nhưng nội dung là một CÂU
// HỎI để người học tự giải thích, nên nhãn nói đúng việc phải làm). Nằm trong khung LessonChrome (thanh trên + nút "Tiếp tục →").
import styles from './LessonBrief.module.css';

export interface LessonBriefProps {
  /** ["M1", "BÀI TẬP CƠ BẢN", "B01"] — hiện thành "M1 / BÀI TẬP CƠ BẢN / B01". */
  eyebrow: string[];
  title: string;
  goal?: string;
  task: string;
  predict?: string;
  code?: string;
  filename?: string;
  langTag?: string;
  tests?: string[];
  reflect?: string;
}

export default function LessonBrief({
  eyebrow,
  title,
  goal,
  task,
  predict,
  code,
  filename = 'main.py',
  langTag = 'PYTHON 3',
  tests = [],
  reflect,
}: LessonBriefProps) {
  return (
    <article className={styles.brief}>
      <p className={styles.eyebrow}>
        {eyebrow.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className={styles.sep} aria-hidden="true">/</span>}
            {part}
          </span>
        ))}
      </p>
      <h2 className={styles.title}>{title}</h2>
      {goal && <p className={styles.goal}>{goal}</p>}

      <section className={styles.task}>
        <h2 className={styles.label}>Nhiệm vụ</h2>
        <p className={styles.taskText}>{task}</p>
      </section>

      {predict && (
        <section className={styles.predict}>
          <h2 className={styles.predictLabel}>Dự đoán</h2>
          <p className={styles.predictText}>{predict}</p>
        </section>
      )}

      {code !== undefined && (
        <section className={styles.code} aria-label={`Khung code ${filename}`}>
          <div className={styles.codeBar}>
            <span>{filename}</span>
            <span>{langTag}</span>
          </div>
          <pre className={styles.codeBody}>{code}</pre>
        </section>
      )}

      {tests.length > 0 && (
        <section className={styles.tests}>
          <h2 className={styles.testsLabel}>Ca kiểm tra công khai</h2>
          <ol className={styles.testList}>
            {tests.map((row, i) => (
              <li key={i}>
                <span className={styles.testNo}>{String(i + 1).padStart(2, '0')}</span>
                {row}
              </li>
            ))}
          </ol>
        </section>
      )}

      {reflect && (
        <section className={styles.reflect}>
          <h2 className={styles.reflectLabel}>Tự trả lời trước khi xem đáp án</h2>
          <p className={styles.reflectText}>{reflect}</p>
        </section>
      )}
    </article>
  );
}
