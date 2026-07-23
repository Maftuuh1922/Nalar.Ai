"use client";

import { useState, useEffect } from "react";

export type Language = "en" | "id";

const dictionary = {
  en: {
    // Settings Sidebar
    settings: "Settings",
    general: "General",
    appearance: "Appearance",
    models: "Models",
    network: "Network",
    chat: "Chat",
    knowledge: "Knowledge Base",
    partners: "Partners & Agents",
    customize: "Customize",
    memory: "Memory",

    // General Tab
    profile: "Profile",
    profileDesc: "Manage your personal profile and display information.",
    avatar: "Avatar",
    fullName: "Full name",
    instructions: "Instructions for Nalar AI",
    instructionsDesc: "Nalar AI will keep these in mind across chats.",
    instructionsPlaceholder: "e.g. keep explanations brief and to the point",

    // Appearance Tab
    appearanceTitle: "Appearance",
    appearanceDesc: "Tune the visual theme and interface language. Changes apply immediately and are stored in your account.",
    language: "Language",
    languageDesc: "Choose the interface language.",
    interfaceLanguage: "Interface language",
    interfaceLanguageDesc: "Affects the UI only. Model output language is controlled by your prompt.",
    theme: "Theme",
    themeDesc: "Pick the colour palette and interface style. Each tile previews the theme it applies.",
    themeInfo: "Cream is warm and paper-like with a terracotta accent. Dark keeps Cream's warmth on near-black. System follows your device's light/dark preference automatically.",
    
    // Sidebar
    searchPlaceholder: "Search history...",
    newChat: "New Chat",
    home: "Home",
    materials: "My Materials",
    aiAssistant: "AI Assistant",
    notes: "Notes",
    practice: "Practice",
    learningSpace: "Learning Space",
    history: "History",
    noConversations: "No conversations yet.",
    notFound: "Not found.",
    newConversation: "New Conversation",
    share: "Share",
    rename: "Rename",
    delete: "Delete",
    signedInAs: "Signed in as",
    freePlan: "Free Plan",
    logout: "Log Out",
    
    // Action bar
    draftUnsaved: "Draft has unsaved changes",
    tour: "Tour",
    saveDraft: "Save Draft",
    apply: "Apply",
  },
  id: {
    // Settings Sidebar
    settings: "Pengaturan",
    general: "Umum",
    appearance: "Tampilan",
    models: "Model AI",
    network: "Jaringan",
    chat: "Percakapan",
    knowledge: "Pusat Pengetahuan",
    partners: "Partner & Agen",
    customize: "Kustomisasi",
    memory: "Memori",

    // General Tab
    profile: "Profil",
    profileDesc: "Kelola profil pribadi dan informasi tampilan Anda.",
    avatar: "Avatar",
    fullName: "Nama lengkap",
    instructions: "Instruksi Khusus untuk Nalar AI",
    instructionsDesc: "Nalar AI akan mengingat instruksi ini di semua percakapan.",
    instructionsPlaceholder: "cth. berikan penjelasan singkat dan langsung ke intinya",

    // Appearance Tab
    appearanceTitle: "Tampilan",
    appearanceDesc: "Sesuaikan tema visual dan bahasa antarmuka. Perubahan akan langsung diterapkan dan disimpan.",
    language: "Bahasa",
    languageDesc: "Pilih bahasa antarmuka.",
    interfaceLanguage: "Bahasa antarmuka",
    interfaceLanguageDesc: "Hanya mengubah tampilan UI. Bahasa jawaban AI bergantung pada prompt Anda.",
    theme: "Tema",
    themeDesc: "Pilih palet warna dan gaya antarmuka. Setiap kartu menampilkan pratinjau tema yang digunakan.",
    themeInfo: "Krim (Cream) memberikan kesan hangat dan seperti kertas. Gelap (Dark) mempertahankan warna hangat tersebut di atas warna hampir hitam. Sistem otomatis mengikuti preferensi terang/gelap perangkat Anda.",

    // Sidebar
    searchPlaceholder: "Cari riwayat...",
    newChat: "Chat Baru",
    home: "Beranda",
    materials: "Materi Saya",
    aiAssistant: "Asisten AI",
    notes: "Catatan",
    practice: "Latihan Soal",
    learningSpace: "Ruang Belajar",
    history: "Riwayat",
    noConversations: "Belum ada percakapan.",
    notFound: "Tidak ditemukan.",
    newConversation: "Percakapan Baru",
    share: "Bagikan",
    rename: "Ubah Nama",
    delete: "Hapus",
    signedInAs: "Masuk sebagai",
    freePlan: "Paket Gratis",
    logout: "Keluar",
    
    // Action bar
    draftUnsaved: "Ada perubahan yang belum disimpan",
    tour: "Tur Aplikasi",
    saveDraft: "Simpan Draf",
    apply: "Terapkan",
  }
};

export function useLanguage() {
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("nalar-lang") as Language | null;
      if (savedLang && (savedLang === "en" || savedLang === "id")) {
        setLang(savedLang);
      }

      const handleLangChange = (e: Event) => {
        const customEvent = e as CustomEvent<Language>;
        if (customEvent.detail) {
          setLang(customEvent.detail);
        }
      };

      window.addEventListener("nalar-lang-change", handleLangChange);
      return () => window.removeEventListener("nalar-lang-change", handleLangChange);
    }
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("nalar-lang", newLang);
      document.documentElement.lang = newLang;
      window.dispatchEvent(new CustomEvent("nalar-lang-change", { detail: newLang }));
    }
  };

  const t = (key: keyof typeof dictionary.en) => {
    return dictionary[lang][key] || dictionary.en[key] || key;
  };

  return { lang, changeLanguage, t };
}
