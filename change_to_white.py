import os
import re

file_path = r"c:\Users\Administrator\Documents\project ta\Nalar.ai_fe\src\app\(app)\beranda\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Change root div background
content = content.replace(
    'className="flex h-full flex-col relative bg-[#0011ff] text-white selection:bg-[#0011ff] selection:text-[#0011ff]"',
    'className="flex h-full flex-col relative bg-[#F4F4F5] text-gray-900 selection:bg-blue-200"'
)

# Floating dock
content = content.replace('bg-[#0011ff] backdrop-blur-2xl border border-white/20', 'bg-white backdrop-blur-2xl border border-gray-200 shadow-sm')
content = content.replace('text-white/60 border border-transparent hover:border-white/20 hover:bg-[#0011ff]/10 hover:text-white', 'text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900')
content = content.replace('bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90', 'bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white')

# Welcome Screen
content = content.replace('text-white text-center', 'text-gray-900 text-center')
content = content.replace('text-white/70', 'text-gray-500')
content = content.replace('text-white', 'text-gray-900')
content = content.replace('border border-white/30 bg-transparent', 'border border-gray-200 bg-white shadow-sm')
content = content.replace('hover:border-white hover:bg-transparent', 'hover:border-gray-300 hover:bg-gray-50')
content = content.replace('bg-transparent text-white', 'bg-white text-gray-900')
content = content.replace('text-[10px] font-mono font-bold uppercase tracking-widest text-white', 'text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700')

# Input Area
content = content.replace('bg-transparent rounded-none shadow-sm border border-white/20 transition-colors focus-within:border-white/40', 'bg-white rounded-2xl shadow-sm border border-gray-200 transition-colors focus-within:border-blue-400')
content = content.replace('bg-[#0011ff]/10 px-3 py-1.5 text-xs font-medium text-white/70', 'bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700')
content = content.replace('text-white/50', 'text-gray-400')
content = content.replace('text-white/40 hover:bg-black/5 hover:text-white/70', 'text-gray-400 hover:bg-gray-200 hover:text-gray-700')
content = content.replace('bg-transparent text-[15px] text-white placeholder:text-white/50', 'bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400')
content = content.replace('text-white/50 hover:bg-black/5 hover:text-white', 'text-gray-400 hover:bg-gray-100 hover:text-gray-700')
content = content.replace('bg-[#0011ff]/10 hover:text-white', 'bg-gray-100 hover:text-gray-900')
content = content.replace('bg-primary text-primary-foreground', 'bg-blue-600 text-white')
content = content.replace('text-white/60 hover:bg-[#0011ff]/10', 'text-gray-500 hover:bg-gray-100')

# Agent picker popover
content = content.replace('bg-[#0011ff] p-4 shadow-xl text-xs space-y-3', 'bg-white p-4 shadow-xl text-xs space-y-3 border border-gray-100 rounded-2xl')
content = content.replace('border-white/20 pb-2', 'border-gray-100 pb-2')

# Token Analytics Popover
content = content.replace('border-emerald-200/80 bg-[#0011ff] p-4 shadow-xl', 'border-emerald-200 bg-white p-4 shadow-xl rounded-2xl')
content = content.replace('text-white animate-in', 'text-gray-800 animate-in')
content = content.replace('bg-[#0011ff]/5 p-2.5 border border-white/20', 'bg-gray-50 p-2.5 border border-gray-100 rounded-xl')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

# Revert chat-message.tsx to use gray/black colors
chat_path = r"c:\Users\Administrator\Documents\project ta\Nalar.ai_fe\src\components\chat-message.tsx"
with open(chat_path, "r", encoding="utf-8") as f:
    chat = f.read()

chat = chat.replace('w-full text-white py-3 px-1 group', 'w-full text-gray-900 py-3 px-1 group')
chat = chat.replace('Bot className="h-4 w-4 text-white/50"', 'Bot className="h-4 w-4 text-gray-500"')
chat = chat.replace('text-xs font-bold uppercase tracking-wider text-white/60', 'text-xs font-bold uppercase tracking-wider text-gray-600')
chat = chat.replace('text-white/50 hover:text-white/80', 'text-gray-500 hover:text-gray-700')
chat = chat.replace('text-white/60 text-[11.5px] font-sans leading-relaxed space-y-2 bg-white/10 rounded-none p-3 border border-white/20', 'text-gray-600 text-[11.5px] font-sans leading-relaxed space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100')
chat = chat.replace('bg-white/20', 'bg-gray-200')
chat = chat.replace('History className="h-4 w-4 text-white/50"', 'History className="h-4 w-4 text-gray-400"')
chat = chat.replace('border-white/40', 'border-gray-300')
chat = chat.replace('Check className="h-2.5 w-2.5 text-white/50"', 'Check className="h-2.5 w-2.5 text-gray-400"')
chat = chat.replace('text-[11px] text-white/50', 'text-[11px] text-gray-500')
chat = chat.replace('border-white/20 pt-3', 'border-gray-100 pt-3')
chat = chat.replace('text-white/50 opacity-0', 'text-gray-500 opacity-0')
chat = chat.replace('border border-white/30 bg-transparent px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-white hover:bg-white hover:text-[#0011ff]', 'border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-xl')
chat = chat.replace('Check className="h-3.5 w-3.5 text-white"', 'Check className="h-3.5 w-3.5 text-blue-600"')
chat = chat.replace('text-white">Tersalin', 'text-blue-600">Tersalin')
chat = chat.replace('Copy className="h-3.5 w-3.5 text-white/50"', 'Copy className="h-3.5 w-3.5 text-gray-500"')
chat = chat.replace('RotateCcw className="h-3.5 w-3.5 text-white/50"', 'RotateCcw className="h-3.5 w-3.5 text-gray-500"')

with open(chat_path, "w", encoding="utf-8") as f:
    f.write(chat)
