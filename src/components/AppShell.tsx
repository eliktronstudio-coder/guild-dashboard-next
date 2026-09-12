"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LoginDialog from "./LoginDialog";
import Atmosphere from "./Atmosphere";
import BottomNav from "./BottomNav";
import { DesignTextProvider } from "./design/DesignTextProvider";
import { guild } from "@/lib/config";
import type { SessionPayload } from "@/lib/auth";

export default function AppShell({
  children,
  user,
  texts = {},
}: {
  children: ReactNode;
  user: SessionPayload | null;
  /**
   * Переопределения статических подписей из редактора «Дизайн». Каркас —
   * клиентский компонент, поэтому подписи приходят пропсом из layout, а не
   * читаются из серверного контекста.
   */
  texts?: Record<string, string>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <DesignTextProvider texts={texts}>
    <div className="relative flex min-h-screen">
      <Atmosphere />
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLoginClick={() => setLoginOpen(true)}
        user={user}
        texts={texts}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} user={user} />
        <main data-design-el="shared.main" className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">
          {children}
        </main>
        <footer
          data-design-el="shared.footer"
          className="hidden border-t border-border px-4 py-3 text-center text-xs text-muted sm:px-6 lg:block"
        >
          {texts["shared.footerText"] ?? guild.version}
        </footer>
      </div>

      <BottomNav onMoreClick={() => setMobileOpen(true)} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
    </DesignTextProvider>
  );
}
