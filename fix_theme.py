import re
import os

def modify_file(path, replacements):
    if not os.path.exists(path):
        print(f"File {path} not found.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Modified {path}")
    else:
        print(f"No changes for {path}")

sidebar_repl = [
    (r'bg-transparent', 'bg-[#0011ff]'),
    (r'border-black/5', 'border-white/20'),
    (r'text-gray-900', 'text-white'),
    (r'text-gray-800', 'text-white'),
    (r'text-gray-700', 'text-white/80'),
    (r'text-gray-500', 'text-white/60'),
    (r'text-gray-400', 'text-white/40'),
    (r'hover:bg-black/5', 'hover:bg-white/10'),
    (r'bg-black/7', 'bg-white/10'),
    (r'bg-black/5', 'bg-white/5'),
    (r'bg-white/90', 'bg-[#0011ff]'),
    (r'bg-white', 'bg-[#0011ff] border border-white/20'),
    (r'bg-gray-50', 'bg-white/5'),
    (r'border-gray-100', 'border-white/20'),
    (r'rounded-2xl', 'rounded-none'),
    (r'rounded-xl', 'rounded-none'),
    (r'rounded-lg', 'rounded-none'),
    (r'shadow-xl', 'shadow-none'),
    (r'shadow-sm', 'shadow-none'),
    (r'bg-gradient-to-br from-gray-700 to-gray-900', 'bg-white text-[#0011ff]')
]

beranda_repl = [
    (r'rounded-\[2rem\]', 'rounded-none'),
    (r'rounded-\[1\.25rem\]', 'rounded-none'),
    (r'rounded-full', 'rounded-none'),
    (r'rounded-2xl', 'rounded-none'),
    (r'rounded-xl', 'rounded-none'),
    (r'rounded-lg', 'rounded-none'),
    (r'bg-white/10', 'bg-transparent'),
    (r'bg-background/40', 'bg-[#0011ff]'),
    (r'bg-popover', 'bg-[#0011ff]'),
    (r'bg-secondary', 'bg-white/10'),
    (r'border-border/50', 'border-white/20'),
    (r'border-border', 'border-white/20'),
    (r'text-muted-foreground', 'text-white/60'),
    (r'text-foreground', 'text-white'),
    (r'hover:bg-foreground/5', 'hover:bg-white/10'),
    (r'bg-foreground/10', 'bg-white/10'),
    (r'text-gray-500', 'text-white/50'),
    (r'text-gray-700', 'text-white/70'),
    (r'text-gray-400', 'text-white/40'),
    (r'bg-white/60', 'bg-white/10'),
    (r'text-gray-900', 'text-white'),
    (r'text-gray-800', 'text-white'),
    (r'text-gray-600', 'text-white/60'),
    (r'bg-gray-50', 'bg-white/5'),
    (r'bg-gray-100', 'bg-white/10'),
    (r'border-gray-200/50', 'border-white/20'),
    (r'border-gray-200', 'border-white/20'),
    (r'border-gray-100', 'border-white/20'),
    (r'bg-white', 'bg-[#0011ff]')
]

layout_repl = [
    (r'className="flex h-screen overflow-hidden"', 'className="flex h-screen overflow-hidden bg-[#0011ff] text-white selection:bg-white selection:text-[#0011ff]"')
]

modify_file('src/components/sidebar.tsx', sidebar_repl)
modify_file('src/app/(app)/beranda/page.tsx', beranda_repl)
modify_file('src/app/(app)/layout.tsx', layout_repl)
print("Theme classes replaced.")
