"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  List,
  X,
  Moon,
  SunDim,
  Student,
  ChalkboardTeacher,
  UserCircle,
  SignOut,
  SignIn,
  Bell,
} from "@phosphor-icons/react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "@/contexts/UILanguageContext";
import LanguageDropdown from "@/components/ui/LanguageDropdown";
import { useAuth } from "@/contexts/AuthContext";

function NavChip({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-black"
          : "text-white/72 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function ActionChip({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
        primary
          ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-light)]"
          : "border border-white/12 bg-white/8 text-white/85 hover:bg-white/15 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [meetingInvite, setMeetingInvite] = useState<{ id: string; topic: string; host: string } | null>(null);

  // Derive whether this user is a student
  const isStudentRole = user?.role === "student" || user?.role === "guest_student";

  const checkInvite = useCallback(() => {
    if (typeof window === "undefined") return;
    // Only students receive meeting invitations — teachers create meetings
    if (!isStudentRole) {
      setMeetingInvite(null);
      return;
    }
    fetch("/api/meetings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.activeInvite) {
          const invite = data.activeInvite;
          // Don't show if already declined or already in this meeting room
          const isDeclined = localStorage.getItem(`lumina_declined_invite_${invite.id}`) === "true";
          const isAlreadyInMeeting = pathname.includes(`/zoom/${invite.id}`);
          if (!isDeclined && !isAlreadyInMeeting) {
            setMeetingInvite(invite);
            return;
          }
        }
        setMeetingInvite(null);
      })
      .catch((err) => console.error("Error checking meetings", err));
  }, [pathname, isStudentRole]);

  useEffect(() => {
    checkInvite();
    // Poll every 5 s — 2 s was causing excessive server load
    const interval = setInterval(checkInvite, 5000);
    return () => clearInterval(interval);
  }, [checkInvite]);

  const handleAcceptInvite = () => {
    if (!meetingInvite) return;
    const inviteId = meetingInvite.id;
    // Mark this invite as accepted so the room page can verify they came through the proper flow
    if (typeof window !== "undefined") {
      localStorage.setItem(`lumina_accepted_invite_${inviteId}`, "true");
    }
    setMeetingInvite(null);
    router.push(`/zoom/${inviteId}?role=student`);
  };

  const handleDeclineInvite = () => {
    if (!meetingInvite) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(`lumina_declined_invite_${meetingInvite.id}`, "true");
    }
    setMeetingInvite(null);
  };

  const links = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.learn"), path: "/learn" },
    { name: t("nav.explore"), path: "/explore" },
    { name: t("nav.myLearnings"), path: "/my-learnings" },
  ].filter((link) => {
    if (!user) {
      return link.path === "/" || link.path === "/explore";
    }
    return true;
  });

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/92 text-white backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href="/" onClick={closeMenu} className="shrink-0 text-[15px] font-semibold tracking-[-0.03em] text-white">
              Lumina.ai
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {links.map((link) => (
                <NavChip
                  key={link.path}
                  href={link.path}
                  active={pathname === link.path}
                >
                  {link.name}
                </NavChip>
              ))}
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageDropdown />

            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              title={t("nav.toggleTheme")}
            >
              {isDarkMode ? <Moon size={18} weight="bold" /> : <SunDim size={18} weight="bold" />}
            </button>

            {user ? (
              <>
                {(user.role === "teacher" || user.role === "guest_teacher") && (
                  <Link href="/teacher" onClick={closeMenu}>
                    <ActionChip>
                      <ChalkboardTeacher size={18} weight="duotone" />
                      Teacher Panel
                    </ActionChip>
                  </Link>
                )}

                {(user.role === "student" || user.role === "guest_student") && (
                  <Link href="/my-learnings" onClick={closeMenu}>
                    <ActionChip>
                      <Student size={18} weight="duotone" />
                      Student Panel
                    </ActionChip>
                  </Link>
                )}

                <Link href="/profile" onClick={closeMenu}>
                  <ActionChip>
                    <UserCircle size={18} weight="duotone" />
                    <span className="max-w-[180px] truncate">{user.username}</span>
                  </ActionChip>
                </Link>

                <ActionChip
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                >
                  <SignOut size={18} weight="duotone" />
                  Logout
                </ActionChip>
              </>
            ) : (
              <Link href="/auth" onClick={closeMenu}>
                <ActionChip primary>
                  <SignIn size={18} weight="duotone" />
                  Sign In
                </ActionChip>
              </Link>
            )}
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/85 transition-colors hover:bg-white/15 hover:text-white lg:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            {isMenuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>

        {isMenuOpen && (
          <div id="mobile-nav-menu" className="border-t border-white/10 px-4 py-4 lg:hidden">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <NavChip
                    key={link.path}
                    href={link.path}
                    active={pathname === link.path}
                    onClick={closeMenu}
                  >
                    {link.name}
                  </NavChip>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <LanguageDropdown />
                <button
                  onClick={toggleTheme}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                  title={t("nav.toggleTheme")}
                >
                  {isDarkMode ? <Moon size={18} weight="bold" /> : <SunDim size={18} weight="bold" />}
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {user ? (
                  <>
                    {(user.role === "teacher" || user.role === "guest_teacher") && (
                      <Link href="/teacher" onClick={closeMenu}>
                        <ActionChip>
                          <ChalkboardTeacher size={18} weight="duotone" />
                          Teacher Panel
                        </ActionChip>
                      </Link>
                    )}

                    {(user.role === "student" || user.role === "guest_student") && (
                      <Link href="/my-learnings" onClick={closeMenu}>
                        <ActionChip>
                          <Student size={18} weight="duotone" />
                          Student Panel
                        </ActionChip>
                      </Link>
                    )}

                    <Link href="/profile" onClick={closeMenu}>
                      <ActionChip>
                        <UserCircle size={18} weight="duotone" />
                        {user.username}
                      </ActionChip>
                    </Link>

                    <ActionChip
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                    >
                      <SignOut size={18} weight="duotone" />
                      Logout
                    </ActionChip>
                  </>
                ) : (
                  <Link href="/auth" onClick={closeMenu}>
                    <ActionChip primary>
                      <SignIn size={18} weight="duotone" />
                      Sign In
                    </ActionChip>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {meetingInvite && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(24rem,calc(100vw-2rem))] select-none rounded-3xl border border-white/12 bg-black/82 p-6 text-white shadow-[var(--product-shadow)] backdrop-blur-2xl animate-slide-up">
          <div className="flex items-start gap-4">
            <Bell size={28} weight="duotone" className="text-[var(--primary-light)]" />
            <div className="flex-1 space-y-2">
              <span className="text-xs font-semibold text-[var(--primary-light)]">
                Meeting Invitation
              </span>
              <p className="text-xs font-semibold text-gray-400">
                {meetingInvite.host} has invited you to a live lesson.
              </p>
              <h4 className="line-clamp-2 text-sm font-bold leading-snug text-gray-200">
                {meetingInvite.topic}
              </h4>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAcceptInvite}
                  className="flex-1 rounded-full bg-[var(--primary)] py-2 text-xs font-semibold text-white hover:bg-[var(--primary-light)]"
                >
                  Join Meeting
                </button>
                <button
                  onClick={handleDeclineInvite}
                  className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/15"
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
