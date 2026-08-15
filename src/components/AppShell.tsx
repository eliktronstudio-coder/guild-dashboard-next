"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LoginDialog from "./LoginDialog";
import Atmosphere from "./Atmosphere";
import BottomNav from "./BottomNav";
import { guild } from "@/lib/config";
import type { SessionPayload } from "@/lib/auth";

export default function AppShell({ children, user }: { children: ReactNode; user: SessionPayload | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen">
      <Atmosphere />
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLoginClick={() => setLoginOpen(true)}
        user={user}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} user={user} />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">{children}</main>
        <footer className="hidden border-t border-border px-4 py-3 text-center text-xs text-muted sm:px-6 lg:block">
          {guild.version}
        </footer>
      </div>

      <BottomNav onMoreClick={() => setMobileOpen(true)} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
