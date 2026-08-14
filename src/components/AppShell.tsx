"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LoginDialog from "./LoginDialog";
import { guild } from "@/lib/config";
import type { SessionPayload } from "@/lib/auth";

export default function AppShell({ children, user }: { children: ReactNode; user: SessionPayload | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLoginClick={() => setLoginOpen(true)}
        user={user}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted sm:px-6">
          {guild.version}
        </footer>
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
