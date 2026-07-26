import os
import re

modal_file = "src/components/settings-modal.tsx"
with open(modal_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the Save button for custom name editing
content = content.replace('bg-white/100 text-white', 'bg-white text-[#0011ff]')

# Fix dropdown options (make them visible against the white browser default)
content = re.sub(r'<option>', r'<option className="bg-[#0011ff] text-white">', content)

# Fix background hover states for profiles list
content = content.replace('bg-black/5 text-white font-medium', 'bg-white/20 text-white font-bold')
content = content.replace('hover:bg-black/5', 'hover:bg-white/10')

# Fix invalid tailwind class bg-white/100/15
content = content.replace('bg-white/100/15', 'bg-white/15')

# Fix hardcoded gray box for new profile
content = content.replace('bg-[#2C2C2C]/50 text-white', 'bg-white/10 text-white')

# Ensure inputs have a distinct background if needed, but transparent is fine.
# We'll just make sure text is white and visible.

with open(modal_file, "w", encoding="utf-8") as f:
    f.write(content)

print("UI colors fixed.")
