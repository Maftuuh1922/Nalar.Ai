import os

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            if 'emerald' in content:
                content = content.replace('emerald', 'indigo')
                with open(path, 'w') as f:
                    f.write(content)
