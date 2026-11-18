/* Nội dung bài học. Chuỗi HTML (<span class="kw|nm|st|cm">, <b>, &lt;) giữ nguyên như prototype. */
import { SHELVES } from "../config/shelves";
import type { CodeToken, CurrentLesson, LessonBody, LessonQuiz } from "../types";

export const currentLesson: CurrentLesson = {
  shelf: 0,
  lesson: 3,
  course: "C++ Nền tảng",
  chapter: "Vòng lặp lồng nhau",
  title: "Tam giác sao",
  file: "bai_4.cpp",
  progress: 44,
};

/** Code laptop đang gõ trên màn hình trong phòng (SCODE). */
export const LAPTOP_CODE: readonly (readonly CodeToken[])[] = [
  [['kw','#include'],['',' '],['st','<iostream>']],
  [['kw','using namespace'],['',' std;']],
  [['','']],
  [['kw','int'],['',' main() {']],
  [['','    '],['kw','int'],['',' n = '],['nm','4'],['',';']],
  [['','    '],['kw','for'],['','(int i = '],['nm','1'],['','; i <= n; i++) {']],
  [['','        '],['kw','for'],['','(int j = '],['nm','1'],['','; j <= i; j++)']],
  [['','            cout << '],['st','"*"'],['',';']],
  [['','        cout << '],['st','"\\n"'],['',';']],
  [['','    }']],
  [['cm','    // vòng ngoài: dòng, vòng trong: số sao']],
  [['','}']]
];

/** Bài 1–4 của kệ C++ Nền tảng (chỉ số = bài). */
export const LESSON_BODY: readonly LessonBody[] = [
  {paragraphsHtml:['Đặt một vòng lặp bên trong vòng lặp khác. Vòng ngoài đi một bước, vòng trong chạy hết một lượt rồi mới trả lại.','Đọc kết quả bên phải: số đầu là i của vòng ngoài, số sau là j của vòng trong.'],
   codeHtml:'<span class="kw">for</span>(int i = <span class="nm">1</span>; i &lt;= <span class="nm">2</span>; i++)\n    <span class="kw">for</span>(int j = <span class="nm">1</span>; j &lt;= <span class="nm">3</span>; j++)\n        cout &lt;&lt; i &lt;&lt; j &lt;&lt; <span class="st">" "</span>;', out:['11 12 13 21 22 23']},
  {paragraphsHtml:['Vòng ngoài chọn dòng, vòng trong in đủ số cột trên dòng đó. Đây là khuôn dùng cho mọi bài in hình.'],
   codeHtml:'<span class="kw">for</span>(int i = <span class="nm">1</span>; i &lt;= <span class="nm">3</span>; i++) {\n    <span class="kw">for</span>(int j = <span class="nm">1</span>; j &lt;= <span class="nm">5</span>; j++)\n        cout &lt;&lt; <span class="st">"*"</span>;\n    cout &lt;&lt; <span class="st">"\\n"</span>;\n}', out:['*****','*****','*****']},
  {paragraphsHtml:['Vòng ngoài là số bị nhân, vòng trong là số nhân. Mỗi lượt vòng ngoài in xong một bảng nhỏ.'],
   codeHtml:'<span class="kw">for</span>(int i = <span class="nm">2</span>; i &lt;= <span class="nm">3</span>; i++)\n    <span class="kw">for</span>(int j = <span class="nm">1</span>; j &lt;= <span class="nm">3</span>; j++)\n        cout &lt;&lt; i &lt;&lt; <span class="st">"x"</span> &lt;&lt; j &lt;&lt; <span class="st">"="</span> &lt;&lt; i*j &lt;&lt; <span class="st">"\\n"</span>;', out:['2x1=2','2x2=4','2x3=6','3x1=3','3x2=6','3x3=9']},
  {paragraphsHtml:['Lần này số dấu sao trên mỗi dòng không cố định: dòng thứ i có đúng i dấu sao.','Chỉ cần đổi giới hạn của vòng trong từ một số cố định thành <b>i</b>.'],
   codeHtml:'int n = <span class="nm">4</span>;\n<span class="kw">for</span>(int i = <span class="nm">1</span>; i &lt;= n; i++) {\n    <span class="kw">for</span>(int j = <span class="nm">1</span>; j &lt;= i; j++)\n        cout &lt;&lt; <span class="st">"*"</span>;\n    cout &lt;&lt; <span class="st">"\\n"</span>;\n}\n<span class="cm">// vòng ngoài: dòng thứ i</span>\n<span class="cm">// vòng trong: in i dấu sao</span>', out:['*','**','***','****'], quiz:true}
];

/** Câu hỏi "Thử suy nghĩ" của bài 4. */
export const LESSON_QUIZ: LessonQuiz = {
  title: "Thử suy nghĩ",
  questionHtml: "Với n = 4, đoạn code bên phải in ra tổng cộng bao nhiêu dấu <code>*</code>?",
  options: ["4", "10", "16"],
  answer: "10",
  right: "Đúng rồi: 1 + 2 + 3 + 4 = 10. Bấm Chạy thử để kiểm tra.",
  wrong: "Chưa đúng. Dòng thứ i có i dấu sao, thử cộng từng dòng xem.",
};

/** Khóa Python: mỗi bài là một cảnh motion (Pixel Stage) chạy từng dòng code. Khoá = chỉ số bài trong kệ Python. */
export const PYTHON_STEP_SCRIPTS: Readonly<Record<number, { id: string; title: string }>> = {
  0: { id: "var-memory-01", title: "Biến và kiểu dữ liệu" },
  1: { id: "io-kitchen-01", title: "Nhập và xuất: input() và print()" },
  2: { id: "if-dj-01", title: "Câu lệnh if trên bàn DJ" },
  3: { id: "branch-dj-01", title: "if, elif, else: chỉ một nhánh được chạy" },
  4: { id: "loop-dj-01", title: "Vòng lặp for trên bàn DJ" },
  5: { id: "while-city-01", title: "Vòng lặp while: giao tới khi hết hàng" },
  6: { id: "func-kitchen-01", title: "Hàm: công thức nấu dùng lại nhiều lần" },
  7: { id: "ref-memory-01", title: "List: hộp, nhãn và reference" },
  8: { id: "dict-dungeon-01", title: "Dict: chỉ số của quái vật" },
  9: { id: "str-blank-01", title: "Chuỗi: từng ký tự có vị trí" },
  10: { id: "review-kitchen-01", title: "Ôn tập: biến, hàm, if và for" },
};

/** Bài của kệ Python (s = 1) và Tư duy giải thuật (s = 2): nội dung chung theo tên bài. */
export function GENERIC(s: number, i: number): LessonBody {
  const t = SHELVES[s].lessons[i][0];
  if (s===1) return {file:`bai_${i+1}.py`, paragraphsHtml:[`Bài ôn lại của khóa Python cơ bản: <b>${t}</b>.`, 'Bản thử nghiệm: nội dung đầy đủ của bài sẽ lấy từ khóa học thật.'],
    codeHtml:`<span class="cm"># Bài ${i+1}: ${t}</span>\nten = <span class="st">"PE"</span>\n<span class="kw">for</span> i <span class="kw">in</span> range(<span class="nm">3</span>):\n    print(ten, i)`, out:['PE 0','PE 1','PE 2'],
    ...(PYTHON_STEP_SCRIPTS[i] ? { stepScript: PYTHON_STEP_SCRIPTS[i] } : null)};
  return {file:`bai_${i+1}.txt`, paragraphsHtml:[`Khóa Tư duy giải thuật: <b>${t}</b>.`, 'Bài này viết bằng mã giả, chưa cần ngôn ngữ cụ thể.'],
    codeHtml:`<span class="cm">// ${t}</span>\n<span class="kw">BẮT ĐẦU</span>\n  đọc n\n  dem ← <span class="nm">0</span>\n  <span class="kw">LẶP</span> i từ <span class="nm">1</span> đến n\n    dem ← dem + <span class="nm">1</span>\n  in dem\n<span class="kw">KẾT THÚC</span>`, out:['Với n = 5: in ra 5','Số bước tỉ lệ với n']};
}
