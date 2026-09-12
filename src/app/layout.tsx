import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import AppShell from "@/components/AppShell";
import DesignStyles from "@/components/design/DesignStyles";
import DesignBlocks from "@/components/design/DesignBlocks";
import { resolveDesign } from "@/lib/design/resolve";
import { guild } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: `${guild.tagline} · ${guild.name}`,
  description: guild.tagline,
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, design] = await Promise.all([getCurrentUser(), resolveDesign()]);
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <DesignStyles css={design.css} />
      </head>
      {/* data-design-page — область действия правил страницы: без него
          правило одной страницы применилось бы на всех остальных. */}
      <body
        data-design-page={design.pageKey ?? undefined}
        data-design-preview={design.isPreview ? "1" : undefined}
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        <AppShell user={user} texts={design.texts}>
          {/* Слоты для блоков, добавленных в редакторе «Дизайн». */}
          <DesignBlocks slot="top" />
          {children}
          <DesignBlocks slot="bottom" />
        </AppShell>
      </body>
    </html>
  );
}
