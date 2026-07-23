"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { Sidebar, SidebarProvider } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Migrate old 'glass' theme to new warm-orange 'default'
      let savedTheme = localStorage.getItem("nalar-theme") || "default";
      if (savedTheme === "glass") savedTheme = "default";
      document.documentElement.className = "";
      document.documentElement.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-cloudy">
        Memuat...
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SidebarProvider>
  );
}
