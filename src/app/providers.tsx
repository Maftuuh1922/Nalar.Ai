"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="default" themes={["default", "dark", "glass", "cream"]}>
      {children}
    </NextThemesProvider>
  );
}
