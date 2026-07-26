import os
import re

TARGET_FILES = [
    "src/components/settings-modal.tsx",
    "src/app/(app)/pengaturan/page.tsx",
    "src/app/(app)/progress/page.tsx",
    "src/app/(app)/progress/history/page.tsx",
    "src/app/(app)/progress/skills/page.tsx",
    "src/app/(app)/materi-saya/page.tsx",
    "src/app/(app)/latihan-soal/page.tsx",
]

REPLACEMENTS = [
    # Rounded corners -> none
    (r'rounded-(?:3xl|2xl|xl|lg|md|sm|full)', 'rounded-none'),
    
    # Shadows -> none
    (r'shadow-(?:sm|md|lg|xl|2xl|inner)', 'shadow-none'),
    
    # Backgrounds: white / gray / cream -> transparent or white with low opacity
    (r'bg-white/90', 'bg-transparent'),
    (r'bg-white/80', 'bg-transparent'),
    (r'bg-white/60', 'bg-transparent'),
    (r'bg-white/50', 'bg-transparent'),
    (r'bg-white/30', 'bg-transparent'),
    (r'bg-white(?!\/)', 'bg-transparent'), # exactly bg-white
    (r'bg-gray-50', 'bg-transparent'),
    (r'bg-gray-100', 'bg-transparent'),
    (r'bg-emerald-50', 'bg-white/10'),
    (r'bg-emerald-100', 'bg-white/10'),
    
    # Borders: gray -> white/30
    (r'border-gray-100', 'border-white/30'),
    (r'border-gray-200', 'border-white/30'),
    (r'border-gray-300', 'border-white/30'),
    (r'border-emerald-100', 'border-white/30'),
    (r'border-emerald-200', 'border-white/30'),
    
    # Text colors: gray/black -> white
    (r'text-gray-900', 'text-white'),
    (r'text-gray-800', 'text-white'),
    (r'text-gray-700', 'text-white/80'),
    (r'text-gray-600', 'text-white/70'),
    (r'text-gray-500', 'text-white/50'),
    (r'text-gray-400', 'text-white/40'),
    (r'text-emerald-800', 'text-white'),
    (r'text-emerald-700', 'text-white'),
    
    # Hover states
    (r'hover:bg-gray-50', 'hover:bg-white/10'),
    (r'hover:border-gray-300', 'hover:border-white/50'),
    (r'hover:border-gray-900', 'hover:border-white'),
    
    # Divide
    (r'divide-gray-200/50', 'divide-white/30'),
]

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - Not found")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    for old, new in REPLACEMENTS:
        content = re.sub(old, new, content)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in TARGET_FILES:
    fix_file(f)

print("Done fixing themes!")
