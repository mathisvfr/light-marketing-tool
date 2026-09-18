import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useCallback } from 'react';
import './rich-text-editor.css';

const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Underline,
  Link.configure({ openOnClick: false }),
];

function MenuBar({ editor }) {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="rte-toolbar">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''} title="Vet">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''} title="Cursief">
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'is-active' : ''} title="Onderstreept">
        <u>U</u>
      </button>

      <span className="rte-separator" />

      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="Kop 2">
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="Kop 3">
        H3
      </button>

      <span className="rte-separator" />

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''} title="Opsomming">
        •
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''} title="Genummerde lijst">
        1.
      </button>

      <span className="rte-separator" />

      <button type="button" onClick={setLink}
        className={editor.isActive('link') ? 'is-active' : ''} title="Link">
        🔗
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'is-active' : ''} title="Citaat">
        „"
      </button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontale lijn">
        ―
      </button>
    </div>
  );
}

export default function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  // Sync external value changes (e.g. after generation) into the editor
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Only replace if the value actually differs (avoid cursor jump)
    if (value !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [editor, value]);

  return (
    <div className="rte-wrapper">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
