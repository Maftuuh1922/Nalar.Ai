import os
import re

replacements = {
    r'bg-\[\#F9F8F6\]': 'bg-pampas',
    r'bg-\[\#F4F3EF\]': 'bg-pampas',
    r'bg-\[\#E6E4DD\]': 'bg-cloudy/30',
    r'border-\[\#E6E4DD\]': 'border-cloudy',
    r'bg-\[\#D6D3CD\]': 'bg-cloudy/20',
    r'text-\[\#121212\]': 'text-foreground',
    r'bg-\[\#121212\]': 'bg-foreground',
    r'bg-\[\#E3E1DE\]': 'bg-cloudy/30',
    r'bg-\[\#252525\]': 'bg-white',
    r'bg-\[\#1A1A1A\]': 'bg-pampas',
    r'bg-\[\#1E1E1E\]': 'bg-white',
    r'bg-gray-50/50': 'bg-pampas',
    r'bg-gray-50': 'bg-pampas',
    r'border-gray-200': 'border-cloudy/50',
    r'border-gray-100': 'border-cloudy/30',
    r'text-gray-900': 'text-foreground',
    r'text-gray-800': 'text-foreground',
    r'text-gray-700': 'text-foreground/80',
    r'text-gray-600': 'text-cloudy',
    r'text-gray-500': 'text-cloudy',
    r'text-gray-400': 'text-cloudy/70',
    r'border-black/10': 'border-cloudy/30',
    r'bg-black/5': 'bg-crail/10',
    r'bg-black/10': 'bg-crail/20',
    r'text-indigo-900': 'text-crail',
    r'bg-indigo-200': 'bg-crail/20',
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Remove all dark mode classes safely
    content = re.sub(r'dark:[^\s"\'`]+', '', content)

    # Apply color replacements
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    if original != content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            process_file(os.path.join(root, file))
