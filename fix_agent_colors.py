import os

file_path = r"c:\Users\Administrator\Documents\project ta\Nalar.ai_fe\src\app\(app)\agents\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("cloudy", "gray-500")
content = content.replace("pampas", "gray-50")
content = content.replace("foreground", "gray-900")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
