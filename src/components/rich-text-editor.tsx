"use client";

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote,
  Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Undo, Redo, Table as TableIcon, Link2, Link2Off, ImagePlus,
  Minus, RemoveFormatting, Type, ChevronDown, Trash2, Columns3, Rows3,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onSelectionChange?: (hasSelection: boolean, selectedText: string, editor: Editor | null) => void;
  placeholder?: string;
  /** false = mode pratinjau (read-only) */
  editable?: boolean;
  /** dipanggil tiap konten berubah, untuk status bar di halaman induk */
  onStats?: (stats: { words: number; chars: number }) => void;
}

const FONT_FAMILIES = [
  { label: 'Calibri', value: 'Calibri, Carlito, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Tinos, serif' },
  { label: 'Arial', value: 'Arial, Liberation Sans, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

const FONT_SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '24px', '30px', '36px'];

const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'];
const TEXT_COLORS = ['#111827', '#b85042', '#1d4ed8', '#047857', '#b45309', '#6d28d9'];

export function RichTextEditor({
  content, onChange, onSelectionChange, placeholder, editable = true, onStats,
}: RichTextEditorProps) {
  const initialized = useRef(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyleKit,
      TableKit.configure({ table: { resizable: true } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      emitStats(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        onSelectionChange(from !== to, editor.state.doc.textBetween(from, to, ' '), editor);
      }
    },
    onCreate: ({ editor }) => {
      onSelectionChange?.(false, '', editor);
      emitStats(editor);
    },
    editorProps: {
      attributes: {
        class: 'nalar-doc focus:outline-none',
        spellcheck: 'false',
      },
    },
  });

  function emitStats(ed: Editor) {
    if (!onStats) return;
    const text = ed.state.doc.textBetween(0, ed.state.doc.content.size, ' ').trim();
    onStats({ words: text ? text.split(/\s+/).length : 0, chars: text.length });
  }

  // Isi awal hanya dipasang sekali. Tanpa penjaga ini, `content` yang berubah
  // akibat ketikan sendiri akan memicu setContent ulang dan kursor melompat.
  useEffect(() => {
    if (!editor || initialized.current) return;
    initialized.current = true;
    if (content) editor.commands.setContent(content);
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  // Tutup dropdown ribbon saat klik di luar
  useEffect(() => {
    if (!openMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-ribbon-menu]')) setOpenMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  if (!editor) return null;

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Masukkan URL:', previous || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL gambar:');
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const currentHeading = editor.isActive('heading', { level: 1 })
    ? 'Judul 1'
    : editor.isActive('heading', { level: 2 })
      ? 'Judul 2'
      : editor.isActive('heading', { level: 3 })
        ? 'Judul 3'
        : 'Teks Biasa';

  return (
    <div className="w-full flex flex-col gap-5 h-full relative">
      {/* ===== RIBBON ===== */}
      <div className="sticky top-0 z-20 shrink-0 rounded-xl border border-white/25 bg-[#0011ff]/95 backdrop-blur-md">
        <div className="flex flex-wrap items-stretch gap-x-1 gap-y-2 p-2">

          {/* Grup: Riwayat */}
          <RibbonGroup label="Riwayat">
            <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Urungkan (Ctrl+Z)"><Undo className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ulangi (Ctrl+Y)"><Redo className="w-4 h-4" /></TB>
          </RibbonGroup>

          {/* Grup: Font */}
          <RibbonGroup label="Font">
            <Dropdown
              id="font"
              width="w-44"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              trigger={<span className="max-w-[92px] truncate">{FONT_FAMILIES.find(f => editor.isActive('textStyle', { fontFamily: f.value }))?.label || 'Calibri'}</span>}
            >
              {FONT_FAMILIES.map(f => (
                <MenuItem key={f.value} onClick={() => editor.chain().focus().setFontFamily(f.value).run()}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </MenuItem>
              ))}
              <MenuItem onClick={() => editor.chain().focus().unsetFontFamily().run()}>Bawaan</MenuItem>
            </Dropdown>

            <Dropdown
              id="size"
              width="w-24"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              trigger={<span>{(editor.getAttributes('textStyle').fontSize as string)?.replace('px', '') || '12'}</span>}
            >
              {FONT_SIZES.map(s => (
                <MenuItem key={s} onClick={() => editor.chain().focus().setFontSize(s).run()}>{s.replace('px', '')}</MenuItem>
              ))}
              <MenuItem onClick={() => editor.chain().focus().unsetFontSize().run()}>Bawaan</MenuItem>
            </Dropdown>
          </RibbonGroup>

          {/* Grup: Format karakter */}
          <RibbonGroup label="Format">
            <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Tebal (Ctrl+B)"><Bold className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Miring (Ctrl+I)"><Italic className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Garis Bawah (Ctrl+U)"><UnderlineIcon className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Coret"><Strikethrough className="w-4 h-4" /></TB>

            <Dropdown id="color" width="w-40" openMenu={openMenu} setOpenMenu={setOpenMenu} trigger={<Type className="w-4 h-4" />}>
              <div className="grid grid-cols-6 gap-1.5 p-2">
                {TEXT_COLORS.map(c => (
                  <button key={c} title={c} onClick={() => editor.chain().focus().setColor(c).run()}
                    className="h-5 w-5 rounded border border-white/40" style={{ background: c }} />
                ))}
              </div>
              <MenuItem onClick={() => editor.chain().focus().unsetColor().run()}>Hapus warna</MenuItem>
            </Dropdown>

            <Dropdown id="hl" width="w-40" openMenu={openMenu} setOpenMenu={setOpenMenu} trigger={<Highlighter className="w-4 h-4" />}>
              <div className="grid grid-cols-6 gap-1.5 p-2">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} title={c} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
                    className="h-5 w-5 rounded border border-white/40" style={{ background: c }} />
                ))}
              </div>
              <MenuItem onClick={() => editor.chain().focus().unsetHighlight().run()}>Hapus sorot</MenuItem>
            </Dropdown>

            <TB onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Bersihkan format"><RemoveFormatting className="w-4 h-4" /></TB>
          </RibbonGroup>

          {/* Grup: Gaya paragraf */}
          <RibbonGroup label="Gaya">
            <Dropdown id="heading" width="w-44" openMenu={openMenu} setOpenMenu={setOpenMenu} trigger={<span className="max-w-[80px] truncate">{currentHeading}</span>}>
              <MenuItem onClick={() => editor.chain().focus().setParagraph().run()}>Teks Biasa</MenuItem>
              <MenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><span className="text-lg font-bold">Judul 1</span></MenuItem>
              <MenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><span className="text-base font-bold">Judul 2</span></MenuItem>
              <MenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><span className="text-sm font-bold">Judul 3</span></MenuItem>
            </Dropdown>
            <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Kutipan"><Quote className="w-4 h-4" /></TB>
          </RibbonGroup>

          {/* Grup: Paragraf */}
          <RibbonGroup label="Paragraf">
            <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Daftar Butir"><List className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Daftar Bernomor"><ListOrdered className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Rata Kiri"><AlignLeft className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Rata Tengah"><AlignCenter className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rata Kanan"><AlignRight className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Rata Kiri-Kanan"><AlignJustify className="w-4 h-4" /></TB>
          </RibbonGroup>

          {/* Grup: Sisipkan */}
          <RibbonGroup label="Sisipkan">
            <Dropdown id="table" width="w-52" openMenu={openMenu} setOpenMenu={setOpenMenu} trigger={<TableIcon className="w-4 h-4" />}>
              <MenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <TableIcon className="w-3.5 h-3.5" /> Sisipkan tabel 3×3
              </MenuItem>
              <MenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="w-3.5 h-3.5" /> Tambah kolom</MenuItem>
              <MenuItem onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="w-3.5 h-3.5" /> Tambah baris</MenuItem>
              <MenuItem onClick={() => editor.chain().focus().deleteColumn().run()}><Columns3 className="w-3.5 h-3.5" /> Hapus kolom</MenuItem>
              <MenuItem onClick={() => editor.chain().focus().deleteRow().run()}><Rows3 className="w-3.5 h-3.5" /> Hapus baris</MenuItem>
              <MenuItem onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="w-3.5 h-3.5" /> Hapus tabel</MenuItem>
            </Dropdown>
            <TB onClick={addLink} active={editor.isActive('link')} title="Sisipkan tautan"><Link2 className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} title="Hapus tautan"><Link2Off className="w-4 h-4" /></TB>
            <TB onClick={addImage} title="Sisipkan gambar dari URL"><ImagePlus className="w-4 h-4" /></TB>
            <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Garis pemisah"><Minus className="w-4 h-4" /></TB>
          </RibbonGroup>
        </div>
      </div>

      {/* ===== HALAMAN DOKUMEN ===== */}
      <div className="flex-1 overflow-y-auto pb-10">
        <div
          className="mx-auto w-full max-w-[820px] bg-white text-gray-900 rounded-sm shadow-2xl px-[76px] py-[64px] min-h-[1000px] cursor-text"
          onClick={() => editable && editor.chain().focus().run()}
        >
          <EditorContent editor={editor} />
          {editor.isEmpty && placeholder && (
            <p className="pointer-events-none -mt-[1.6em] text-gray-400 select-none">{placeholder}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- sub-komponen ribbon ---------- */

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-r border-white/15 pr-2 last:border-r-0">
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="mt-1 text-[9px] uppercase tracking-wider text-white/35 select-none">{label}</span>
    </div>
  );
}

function TB({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Dropdown({ id, trigger, children, width, openMenu, setOpenMenu }: {
  id: string; trigger: React.ReactNode; children: React.ReactNode; width: string;
  openMenu: string | null; setOpenMenu: (v: string | null) => void;
}) {
  const open = openMenu === id;
  return (
    <div className="relative" data-ribbon-menu>
      <button
        type="button"
        onClick={() => setOpenMenu(open ? null : id)}
        className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
          open ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        {trigger}
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <div className={`absolute left-0 top-full mt-1 ${width} rounded-lg border border-white/25 bg-[#0011ff] py-1 shadow-2xl z-30 max-h-72 overflow-y-auto`}>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/15 hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}
