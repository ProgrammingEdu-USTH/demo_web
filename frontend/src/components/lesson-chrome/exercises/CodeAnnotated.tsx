// Dịch từ màn Stitch "4. CODE-ANNOTATED — Chú giải mã lệnh". Bản gốc vẽ
// đường nối cong từ dòng code sang khung chú giải; ở đây đơn giản hoá thành
// danh sách chú giải xếp cạnh khối code, đánh số cùng màu chấm để vẫn đối
// chiếu được — bỏ animation vẽ đường nối SVG cho gọn.
import CodeBlock, { CodeBlockLine } from './CodeBlock';

export interface Annotation {
  label: string;
  detail: React.ReactNode;
}

export interface CodeAnnotatedProps {
  filename?: string;
  langTag?: string;
  code: CodeBlockLine[];
  annotations: Annotation[];
}

export default function CodeAnnotated({ filename, langTag, code, annotations }: CodeAnnotatedProps) {
  return (
    <div className="![display:flex] ![gap:16px] ![flex-wrap:wrap] ![align-items:flex-start]">
      <div className="![flex:1_1_300px] ![min-width:0]">
        <CodeBlock filename={filename} langTag={langTag} lines={code} />
      </div>
      <div className="![flex:1_1_220px] ![display:flex] ![flex-direction:column] ![gap:10px]">
        {annotations.map((a, i) => (
          <div
            key={i}
            className="![background:var(--edu-card-bg)] ![border:1px_solid_var(--edu-sidebar-border)] ![border-radius:10px] ![padding:10px_14px] ![font-size:13px]"
          >
            <div className="![display:flex] ![align-items:center] ![gap:8px] ![color:var(--edu-t1)] ![font-weight:600]">
              <span className="![width:6px] ![height:6px] ![border-radius:50%] ![background:var(--edu-accent)] ![flex-shrink:0]" />
              {a.label}
            </div>
            <div className="![color:var(--edu-t3)] ![margin-top:4px]">{a.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
