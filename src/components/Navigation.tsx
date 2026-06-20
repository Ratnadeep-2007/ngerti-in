"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "@/contexts/UILanguageContext";
import LanguageDropdown from "@/components/ui/LanguageDropdown";
import { useAuth } from "@/contexts/AuthContext";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  // Meeting invitation listener state
  const [meetingInvite, setMeetingInvite] = useState<{ id: string; topic: string; host: string } | null>(null);

  const checkInvite = useCallback(() => {
    if (typeof window === "undefined") return;
    const inviteStr = localStorage.getItem("lumina_active_meeting_invite");
    if (inviteStr) {
      try {
        const parsed = JSON.parse(inviteStr);
        // Only show if it's active and not already in this room
        if (parsed && parsed.active && !pathname.includes(`/zoom/${parsed.id}`)) {
          setMeetingInvite(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    setMeetingInvite(null);
  }, [pathname]);

  useEffect(() => {
    checkInvite();

    // Listen to changes in other tabs
    window.addEventListener("storage", checkInvite);
    // Polling fallback
    const interval = setInterval(checkInvite, 2000);

    return () => {
      window.removeEventListener("storage", checkInvite);
      clearInterval(interval);
    };
  }, [checkInvite]);

  const handleAcceptInvite = () => {
    if (!meetingInvite) return;
    const inviteId = meetingInvite.id;
    setMeetingInvite(null);
    router.push(`/zoom/${inviteId}?role=student`);
  };

  const handleDeclineInvite = () => {
    setMeetingInvite(null);
    if (typeof window !== "undefined" && meetingInvite) {
      localStorage.removeItem("lumina_active_meeting_invite");
      window.dispatchEvent(new Event("storage"));
    }
  };

  const links = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.learn"), path: "/learn" },
    { name: t("nav.explore"), path: "/explore" },
    { name: t("nav.myLearnings"), path: "/my-learnings" },
  ].filter((link) => {
    // Restrict student routes if not logged in
    if (!user) {
      return link.path === "/" || link.path === "/explore";
    }
    return true;
  });

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel pixel-border py-2 px-4 flex flex-col sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center bg-opacity-90 transition-all duration-500 max-w-[100vw] box-border">
        <div className="flex justify-between items-center w-full sm:col-span-1">
          <Link href="/" onClick={() => setIsMenuOpen(false)}>
            <span className="text-2xl font-extrabold pixel-text-strong tracking-widest text-[var(--primary-text)] whitespace-nowrap">
              LUMINA.AI
            </span>
          </Link>
          <button
            className="sm:hidden text-3xl p-1 pixel-text"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            {isMenuOpen ? "✖" : "☰"}
          </button>
        </div>

        <div id="mobile-nav-menu" className={`flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 ${isMenuOpen ? 'flex mt-4' : 'hidden sm:flex'} sm:col-span-1`}>
          {links.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`text-lg px-3 py-1 transition-colors ${
                  isActive
                    ? "font-bold border-b-4 border-[var(--primary)] text-[var(--primary-text)]"
                    : "font-medium text-[var(--muted)] hover:text-[var(--primary-text)] text-[var(--foreground)]"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className={`flex-col sm:flex-row items-center sm:justify-end gap-2 mt-4 sm:mt-0 ${isMenuOpen ? 'flex' : 'hidden sm:flex'} sm:col-span-1`}>
          <LanguageDropdown />
          <button
            onClick={toggleTheme}
            className="text-2xl p-2 hover:scale-110 transition-transform pixel-border bg-[var(--surface-light)]"
            title={t("nav.toggleTheme")}
          >
            {isDarkMode ? "🌙" : "☀️"}
          </button>
          
          {user ? (
            <>
              {/* Teacher control dashboard shortcut - visible only to teacher roles */}
              {(user.role === "teacher" || user.role === "guest_teacher") && (
                <Link href="/teacher" onClick={() => setIsMenuOpen(false)}>
                  <button className="flex items-center gap-2 px-4 py-2 font-bold pixel-border bg-[var(--surface-light)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors">
                    <span>👨‍🏫</span> Teacher Panel
                  </button>
                </Link>
              )}

              <Link href="/profile" onClick={() => setIsMenuOpen(false)}>
                <button className="flex items-center gap-2 px-4 py-2 font-bold pixel-border bg-[var(--surface-light)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors">
                  <span>👤</span> {user.username} <span className="text-[10px] opacity-75 uppercase">({user.role.replace("guest_", "guest ")})</span>
                </button>
              </Link>

              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2 font-bold pixel-border bg-[var(--surface-light)] text-[var(--foreground)] hover:bg-[var(--error)] hover:text-white transition-colors"
              >
                <span>🚪</span> Logout
              </button>
            </>
          ) : (
            <Link href="/auth" onClick={() => setIsMenuOpen(false)}>
              <button className="flex items-center gap-2 px-4 py-2 font-bold pixel-border bg-[var(--primary)] text-white hover:opacity-90 transition-opacity">
                <span>🔑</span> Sign In
              </button>
            </Link>
          )}
        </div>
      </nav>

      {/* Slide-in meeting invitation modal banner */}
      {meetingInvite && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#16181d] text-white p-6 pixel-border w-96 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-t-4 border-t-[var(--primary)] animate-slide-up select-none">
          <div className="flex items-start gap-4">
            <span className="text-3xl animate-bounce">🔔</span>
            <div className="flex-1 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-[var(--primary-light)] tracking-widest">
                Meeting Invitation
              </span>
              <p className="text-xs font-semibold text-gray-400">
                {meetingInvite.host} has invited you to a live lesson.
              </p>
              <h4 className="font-bold text-sm text-gray-200 leading-snug line-clamp-2">
                {meetingInvite.topic}
              </h4>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAcceptInvite}
                  className="flex-1 py-2 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white pixel-border"
                >
                  Join Meeting
                </button>
                <button
                  onClick={handleDeclineInvite}
                  className="px-4 py-2 text-xs font-bold bg-gray-800 hover:bg-gray-700 text-gray-400 pixel-border border-gray-700"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
