"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <button className="flex items-center justify-center rounded-lg p-2 text-cloudy hover:bg-crail/10 :bg-white/10 transition-colors opacity-0">
        {" "}
        <Sun className="h-5 w-5" />{" "}
      </button>
    );
  }
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative flex items-center justify-center rounded-lg p-2 text-cloudy hover:bg-crail/10 :bg-white/10 transition-colors"
      title="Ubah Tema"
    >
      {" "}
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all" />{" "}
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all" />{" "}
      <span className="sr-only">Ubah Tema</span>{" "}
    </button>
  );
}
