import type { Metadata } from "next";
import { Alfa_Slab_One, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ToastViewport from "@/components/common/ToastViewport";
import { AppShellProvider } from "@/context/AppShellContext";
import { I18nClientBridge } from "@/i18n/I18nClientBridge";

// Inter matches the Beautiful UI design language (neutral greys, blue accent)
// and stays crisp at the small UI sizes the composer/toolbars use.
const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Serif-styled headings render in Inter too — the design system is sans-only.
const fontSerif = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Nalar AI",
  description: "Agent-native intelligent learning companion",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}
    >
      <head>
        {/* Tema dipasang sebelum cat pertama supaya tidak ada kilatan tema
            salah. Dimuat dari berkas statis, bukan skrip inline: React 19
            memperingatkan setiap render untuk `<script>` inline di dalam
            komponen ("Encountered a script tag while rendering React
            component"). Tanpa `async`/`defer` — harus bloking agar kelas tema
            sudah menempel di <html> saat halaman pertama digambar. */}
        <script src="/theme-init.js" />
      </head>
      <body
        className="font-sans bg-[var(--background)] text-[var(--foreground)]"
        suppressHydrationWarning
      >
        <AppShellProvider>
          <I18nClientBridge>{children}</I18nClientBridge>
          <ToastViewport />
        </AppShellProvider>
      </body>
    </html>
  );
}
