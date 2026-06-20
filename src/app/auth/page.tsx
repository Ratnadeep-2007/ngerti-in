"use client";

import React, { useState, useEffect } from "react";
import {
  StudentIcon,
  ChalkboardTeacherIcon,
} from "@phosphor-icons/react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AuthPage() {
  const { login, signup, loginAsGuest } = useAuth();
  
  // Tab states
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  
  // Form input states
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear inputs on toggle tab
  useEffect(() => {
    setUsername("");
    setEmail("");
    setPassword("");
  }, [isLoginTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in email and password");
      return;
    }

    if (!isLoginTab && !username.trim()) {
      toast.error("Please enter a username for signup");
      return;
    }

    setLoading(true);
    try {
      if (isLoginTab) {
        // Authenticate with selected role
        await login(email.trim(), selectedRole);
      } else {
        // Register and authenticate with selected role
        await signup(username.trim(), email.trim(), selectedRole);
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 mx-auto max-w-md space-y-8 px-4 py-8 animate-slide-up">
      
      {/* Title block */}
      <div className="text-center space-y-2">
        <h1 className="apple-headline">
          Lumina.ai
        </h1>
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--primary)]">
          Active Validation Control Panel
        </p>
      </div>

      {/* Auth Card wrapper */}
      <div className="space-y-6 rounded-[32px] border border-[var(--border)] bg-white/82 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
        
        {/* Tab switchers */}
        <div className="mb-4 flex rounded-full border border-[var(--border)] bg-[var(--surface-light)] p-1">
          <button
            onClick={() => setIsLoginTab(true)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
              isLoginTab
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] opacity-75 hover:opacity-100"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLoginTab(false)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
              !isLoginTab
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] opacity-75 hover:opacity-100"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginTab && (
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
                Display Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Teacher Ratnadeep"
                className="w-full rounded-[18px] border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full rounded-[18px] border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[18px] border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Role selector cards */}
          <div className="space-y-2 pt-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
              Select Your Access Level
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole("student")}
                className={`flex flex-col items-center justify-center gap-1 rounded-[20px] border p-3 text-center transition-all ${
                  selectedRole === "student"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-light)] border-border hover:bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              >
              <StudentIcon size={22} weight="duotone" />
              <span className="text-xs font-bold">Student Role</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("teacher")}
                className={`flex flex-col items-center justify-center gap-1 rounded-[20px] border p-3 text-center transition-all ${
                  selectedRole === "teacher"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-light)] border-border hover:bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              >
                <ChalkboardTeacherIcon size={22} weight="duotone" />
                <span className="text-xs font-bold">Teacher Role</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full bg-[var(--primary)] py-3.5 text-sm font-medium text-white transition-all hover:bg-[var(--primary-light)] disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {!loading && isLoginTab && <span className="hidden sm:inline-flex"><StudentIcon size={16} weight="duotone" /></span>}
              {!loading && !isLoginTab && <span className="hidden sm:inline-flex"><ChalkboardTeacherIcon size={16} weight="duotone" /></span>}
              {loading ? "Authenticating..." : isLoginTab ? "Access Sandbox" : "Create & Access"}
            </span>
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative z-10 bg-white px-3 text-[10px] font-semibold uppercase text-[var(--muted)]">
            Or Bypass Mode
          </span>
        </div>

        {/* Guest access modes */}
        <div className="space-y-3">
          <button
            onClick={() => loginAsGuest("guest_student")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-light)] py-3 text-xs font-semibold text-[var(--foreground)] transition-all hover:text-[var(--primary-text)]"
          >
            <StudentIcon size={18} weight="duotone" /> Enter immediately as Guest Student
          </button>
          <button
            onClick={() => loginAsGuest("guest_teacher")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-light)] py-3 text-xs font-semibold text-[var(--foreground)] transition-all hover:text-[var(--primary-text)]"
          >
            <ChalkboardTeacherIcon size={18} weight="duotone" /> Enter immediately as Guest Teacher
          </button>
        </div>

      </div>

    </div>
  );
}
