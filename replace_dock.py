import os
import re

file_path = r"c:\Users\Administrator\Documents\project ta\Nalar.ai_fe\src\app\(app)\beranda\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
if "Maximize" not in content:
    content = content.replace("AlignJustify\n}", "AlignJustify,\n  Download,\n  Maximize,\n  Minimize,\n  Trash2,\n  MessageSquarePlus\n}")

# 2. Add state and functions before `return (`
functions_to_add = """
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const downloadChat = () => {
    if (chatMessages.length === 0) {
      showToast("Tidak ada chat untuk diunduh");
      return;
    }
    const text = chatMessages.map(m => `${m.role.toUpperCase()}:\\n${m.content}`).join("\\n\\n-----------------\\n\\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chat_Nalar_AI_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Chat berhasil diunduh");
  };

  const deleteCurrentSession = async () => {
    if (!sessionId) {
      startNewChat();
      showToast("Chat dibersihkan");
      return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus sesi chat ini permanen?")) {
      try {
        await chatSessionsApi.delete(token!, sessionId);
        showToast("Sesi berhasil dihapus");
        chatSessionsApi.getAll(token!).then(setSessions).catch(() => {});
        startNewChat();
      } catch (err) {
        showToast("Gagal menghapus sesi");
      }
    }
  };

  return (
"""
if "const [isFullscreen" not in content:
    content = content.replace("  return (", functions_to_add, 1)


# 3. Replace the dock UI
dock_start = content.find("{/* Mode Baca & Penjajaran Teks Button */}")
dock_end = content.find("      </div>\n\n      {/* Floating Realtime Token Tracker Badge")

new_dock = """{/* Mulai Chat Baru */}
        <Button
          isIconOnly
          onPress={startNewChat}
          className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
          aria-label="Mulai Chat Baru"
        >
          <MessageSquarePlus className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
            Mulai Chat Baru
          </span>
        </Button>

        {/* Unduh Chat */}
        <Button
          isIconOnly
          onPress={downloadChat}
          className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
          aria-label="Unduh Chat"
        >
          <Download className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
            Unduh Percakapan
          </span>
        </Button>

        {/* Layar Penuh */}
        <Button
          isIconOnly
          onPress={toggleFullscreen}
          className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
          aria-label="Layar Penuh"
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
            {isFullscreen ? "Tutup Layar Penuh" : "Layar Penuh"}
          </span>
        </Button>

        {/* Hapus Chat / Riwayat */}
        <Button
          isIconOnly
          onPress={deleteCurrentSession}
          className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
          aria-label="Hapus Percakapan"
        >
          <Trash2 className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-red-600 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
            Hapus Percakapan
          </span>
        </Button>
"""

if dock_start != -1 and dock_end != -1:
    content = content[:dock_start] + new_dock + content[dock_end:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
