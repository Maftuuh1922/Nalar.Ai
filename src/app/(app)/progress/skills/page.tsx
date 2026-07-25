"use client";

import Link from "next/link";
import { 
  ArrowLeft, Wrench, Download, Plus, Tag, ChevronDown, 
  FileText, FilePlus, PenTool, LayoutTemplate, Lock
} from "lucide-react";

export default function SkillsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F5] min-h-full">
      <div className="max-w-5xl mx-auto px-8 py-8">
        
        {/* Breadcrumb */}
        <Link href="/progress" className="inline-flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Learning Space
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-none border border-white/30 bg-transparent flex items-center justify-center shrink-0">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">Skills</h1>
                <span className="px-2.5 py-0.5 rounded-none border border-white/30 bg-transparent text-xs font-bold text-white/70">5 skills</span>
              </div>
              <p className="text-sm text-white/50 max-w-xl">
                Capability playbooks the model reads on demand. Built-in and preset skills are read-only.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button className="flex items-center gap-2 bg-transparent border border-white/30 hover:bg-transparent text-white/80 px-4 py-2 rounded-none text-sm font-medium transition-colors shadow-none">
              <Download className="h-4 w-4" />
              Import from EduHub
            </button>
            <button className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2 rounded-none text-sm font-medium transition-colors shadow-none">
              <Plus className="h-4 w-4" />
              New skill
            </button>
          </div>
        </div>

        {/* Tags / Filters */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between rounded-none border border-white/30 bg-transparent px-4 py-3 cursor-pointer hover:border-white/30 transition-colors">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-white/40" />
              <span className="text-sm font-bold text-white">Manage Tags</span>
              <span className="px-2 py-0.5 rounded bg-transparent text-xs font-bold text-white/70">2</span>
            </div>
            <ChevronDown className="h-4 w-4 text-white/40" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill label="All" count="5" active />
            <FilterPill label="style" count="0" />
            <FilterPill label="tool" count="4" />
            <FilterPill label="Untagged" count="1" dashed />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <SkillCard 
            icon={FileText}
            title="docx"
            description="Read, create, or edit Microsoft Word .docx files — extract/summarize text..."
            tags={["tool", "office"]}
          />
          
          <SkillCard 
            icon={FilePlus}
            title="pdf"
            description="Read, extract (text/tables), create, merge/split/rotate, watermark,..."
            tags={["tool", "office"]}
          />
          
          <SkillCard 
            icon={LayoutTemplate}
            title="pptx"
            description="Read, create, or edit PowerPoint .pptx decks — build slides from an outline,..."
            tags={["tool", "office"]}
          />
          
          <SkillCard 
            icon={PenTool}
            title="skill-creator"
            description="Design and author DeepTutor skills (SKILL.md packages). Use when the..."
            tags={[]}
          />
          
          <SkillCard 
            icon={FileText}
            title="xlsx"
            description="Read, create, or edit Excel spreadsheets (.xlsx/.xlsm) — sheet..."
            tags={["tool", "office"]}
          />

        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, count, active, dashed }: { label: string, count: string, active?: boolean, dashed?: boolean }) {
  return (
    <button className={`flex items-center gap-2 px-3 py-1.5 rounded-none text-xs font-bold transition-colors ${
      active 
        ? "bg-gray-900 text-white" 
        : dashed 
          ? "border border-dashed border-white/30 bg-transparent text-white/70 hover:border-gray-400 hover:bg-transparent"
          : "border border-white/30 bg-transparent text-white/70 hover:border-white/30 hover:bg-transparent shadow-none"
    }`}>
      {label}
      <span className={active ? "text-gray-300" : "text-white/40"}>{count}</span>
    </button>
  );
}

function SkillCard({ icon: Icon, title, description, tags }: { icon: any, title: string, description: string, tags: string[] }) {
  return (
    <div className="rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all cursor-pointer">
      <div className="flex items-start gap-4 mb-4">
        <div className="h-10 w-10 rounded-none border border-white/30 bg-transparent flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-white/70" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/30 bg-transparent text-[10px] font-bold text-white/50 uppercase tracking-wider">
              <Lock className="h-3 w-3" /> BUILT-IN
            </div>
          </div>
          <p className="text-sm text-white/50 leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 pl-14">
        {tags.length > 0 ? (
          tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-none border border-white/30 bg-transparent text-[11px] font-medium text-white/70">
              {tag}
            </span>
          ))
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-none border border-dashed border-white/30 text-[11px] font-medium text-white/50">
            <Tag className="h-3 w-3" />
            Untagged
          </span>
        )}
      </div>
    </div>
  );
}
