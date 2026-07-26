"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { ToastProvider } from "@/components/toast-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="default" themes={["default", "dark", "glass", "cream"]}>
      <ToastProvider>{children}</ToastProvider>
    </NextThemesProvider>
  );
}
