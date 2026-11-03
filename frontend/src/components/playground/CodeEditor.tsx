'use client';

// Editor CodeMirror 6. File này CHỈ được nạp qua dynamic import (xem PlaygroundApp) để CodeMirror
// không rơi vào bundle của trang khác. Màu lấy từ biến --ui-* nên tự đổi sáng/tối theo body.dark.
import { closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

export type EditorLanguage = 'python' | 'html' | 'css' | 'js';

const langExt: Record<EditorLanguage, () => Extension> = {
  python: () => python(),
  html: () => html(),
  css: () => css(),
  js: () => javascript(),
};

const v = (name: string) => `rgb(var(--ui-${name}))`;

const theme = EditorView.theme({
  '&': { height: '100%', color: v('fg'), backgroundColor: v('surface'), fontSize: '14px' },
  '&.cm-focused': { outline: `2px solid ${v('ring')}`, outlineOffset: '-2px' },
  '.cm-scroller': { fontFamily: 'var(--font-code), ui-monospace, monospace', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { caretColor: v('primary'), padding: '8px 0' },
  '.cm-cursor': { borderLeftColor: v('primary') },
  '.cm-gutters': { backgroundColor: v('surface-2'), color: v('fg-muted'), border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--ui-primary) / 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: v('fg') },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgb(var(--ui-primary) / 0.22)' },
  '.cm-matchingBracket': { backgroundColor: 'rgb(var(--ui-primary) / 0.2)', outline: 'none' },
  '.cm-placeholder': { color: v('fg-muted') },
});

// Màu cú pháp lấy từ token ngữ nghĩa (đã đo tương phản ở cả hai chế độ sáng/tối).
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: v('primary'), fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: v('success') },
  { tag: [t.number, t.bool, t.null, t.atom], color: v('accent') },
  { tag: [t.comment, t.lineComment, t.blockComment], color: v('fg-muted'), fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: v('info') },
  { tag: [t.tagName, t.className, t.typeName], color: v('danger') },
  { tag: [t.attributeName, t.propertyName], color: v('info') },
  { tag: [t.operator, t.punctuation], color: v('fg-muted') },
]);

type Props = {
  value: string;
  language: EditorLanguage;
  /** Đổi `docKey` khi chuyển sang tài liệu khác (đổi ngôn ngữ, tab HTML/CSS/JS, mẫu mới). */
  docKey: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  label: string;
};

export default function CodeEditor({ value, language, docKey, onChange, onRun, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  // Giữ giá trị/callback mới nhất trong ref để không phải dựng lại editor mỗi lần render.
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const valueRef = useRef(value);
  const languageRef = useRef(language);
  useEffect(() => {
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
    valueRef.current = value;
    languageRef.current = language;
  });

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        EditorState.tabSize.of(4),
        placeholder('Viết code ở đây…'),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRunRef.current?.();
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        syntaxHighlighting(highlight),
        theme,
        langCompartment.current.of(langExt[languageRef.current]()),
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false', autocapitalize: 'off' }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const created = new EditorView({ state, parent: host.current });
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
  }, [label]);

  // Chuyển tài liệu: thay toàn bộ nội dung + ngôn ngữ.
  useEffect(() => {
    const ev = view.current;
    if (!ev) return;
    ev.dispatch({
      changes: { from: 0, to: ev.state.doc.length, insert: valueRef.current },
      effects: langCompartment.current.reconfigure(langExt[languageRef.current]()),
    });
  }, [docKey]);

  // Giá trị đổi từ bên ngoài (đặt lại mẫu) mà không đổi docKey.
  useEffect(() => {
    const ev = view.current;
    if (ev && ev.state.doc.toString() !== value) {
      ev.dispatch({ changes: { from: 0, to: ev.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
