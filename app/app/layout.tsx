import Link from "next/link";
import "./globals.css";
import { CSRF_COOKIE, getSession } from "../lib/auth";
import { cookies } from "next/headers";
import LogoutButton from "../components/logout-button";

export const metadata = {
  title: "AI Video Editor",
  description: "Prompt-driven deterministic video edits with Bun + Next.js"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  const csrf = cookies().get(CSRF_COOKIE)?.value ?? "";

  return (
    <html lang="en">
      <body className="text-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <header className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/50 px-4 py-3 shadow-lg shadow-slate-900/40">
            <div className="flex items-center gap-4">
              <div className="font-semibold text-lg tracking-tight text-emerald-300">
                Arctic Aura Video Editor
              </div>
              {session && (
                <nav className="flex items-center gap-3 text-sm text-slate-300">
                  <Link className="hover:text-white transition-colors" href="/">
                    Home
                  </Link>
                  <Link className="hover:text-white transition-colors" href="/new">
                    New Project
                  </Link>
                </nav>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              {session ? <LogoutButton csrfToken={csrf} /> : <Link href="/login">Login</Link>}
            </div>
          </header>
          <main className="mt-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
