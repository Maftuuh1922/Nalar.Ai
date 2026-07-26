import os
import re
import shutil

# Fix settings-modal.tsx
modal_file = "src/components/settings-modal.tsx"
if os.path.exists(modal_file):
    with open(modal_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Fix the main background to brutalist blue
    content = content.replace('bg-[#FAF9F5]', 'bg-[#0011ff]')
    content = content.replace('border-[#E8E6DF]', 'border-white/30')
    
    # Fix double opacity borders
    content = content.replace('border-white/30/50', 'border-white/30')
    content = content.replace('bg-white/30/50', 'bg-white/30')
    
    # Fix tabs or any inner white backgrounds that were set to transparent but might need borders
    
    with open(modal_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed settings-modal.tsx")

# Delete pengaturan page
pengaturan_dir = "src/app/(app)/pengaturan"
if os.path.exists(pengaturan_dir):
    shutil.rmtree(pengaturan_dir)
    print("Removed pengaturan directory")

# Remove or update links in beranda/page.tsx
beranda_file = "src/app/(app)/beranda/page.tsx"
if os.path.exists(beranda_file):
    with open(beranda_file, "r", encoding="utf-8") as f:
        b_content = f.read()
    b_content = b_content.replace('href="/pengaturan"', 'onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}')
    # Note: replacing with an event. We might need a better way if they click it, 
    # but the settings modal is already handled via user icon in sidebar.
    with open(beranda_file, "w", encoding="utf-8") as f:
        f.write(b_content)
    print("Updated links in beranda")

# Update mobile-nav.tsx
mobile_nav_file = "src/components/mobile-nav.tsx"
if os.path.exists(mobile_nav_file):
    with open(mobile_nav_file, "r", encoding="utf-8") as f:
        m_content = f.read()
    # Change Link to button that opens settings
    m_content = re.sub(
        r'<Link href="/pengaturan"(.*?)>(.*?)</Link>',
        r'<button \1 \2</button>',
        m_content,
        flags=re.DOTALL
    )
    with open(mobile_nav_file, "w", encoding="utf-8") as f:
        f.write(m_content)
    print("Updated mobile-nav.tsx")
