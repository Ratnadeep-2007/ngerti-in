"use client";

import React, { useState, useEffect } from "react";
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
    <div className="max-w-md mx-auto px-4 py-8 space-y-8 animate-slide-up relative z-10">
      
      {/* Title block */}
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-extrabold tracking-tight pixel-text-strong">
          Lumina.ai
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--primary-light)]">
          Active Validation Control Panel
        </p>
      </div>

      {/* Auth Card wrapper */}
      <div className="glass-panel pixel-border p-8 rounded-xl space-y-6">
        
        {/* Tab switchers */}
        <div className="flex border-b border-border p-1 bg-[var(--surface-light)] pixel-border mb-4">
          <button
            onClick={() => setIsLoginTab(true)}
            className={`flex-1 py-2 font-bold text-sm pixel-border transition-all ${
              isLoginTab
                ? "bg-[var(--primary)] text-white shadow-[0_3px_0_var(--primary-dark)]"
                : "text-[var(--foreground)] opacity-75 hover:opacity-100"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLoginTab(false)}
            className={`flex-1 py-2 font-bold text-sm pixel-border transition-all ${
              !isLoginTab
                ? "bg-[var(--primary)] text-white shadow-[0_3px_0_var(--primary-dark)]"
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
                className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-border p-2.5 outline-none focus:border-[var(--primary)] pixel-border text-sm"
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
              className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-border p-2.5 outline-none focus:border-[var(--primary)] pixel-border text-sm"
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
              className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-border p-2.5 outline-none focus:border-[var(--primary)] pixel-border text-sm"
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
                className={`p-3 text-center pixel-border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedRole === "student"
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-[0_4px_0_var(--primary-dark)] translate-y-[-2px]"
                    : "bg-[var(--surface-light)] border-border hover:bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              >
                <span className="text-xl">🎓</span>
                <span className="text-xs font-bold">Student Role</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("teacher")}
                className={`p-3 text-center pixel-border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedRole === "teacher"
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-[0_4px_0_var(--primary-dark)] translate-y-[-2px]"
                    : "bg-[var(--surface-light)] border-border hover:bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              >
                <span className="text-xl">👨‍🏫</span>
                <span className="text-xs font-bold">Teacher Role</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-extrabold text-sm py-3.5 pixel-border transition-all active:translate-y-[1px] disabled:opacity-50 mt-4"
          >
            {loading ? "Authenticating..." : isLoginTab ? "Access Sandbox" : "Create & Access"}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-[#1a1c22] px-3 text-[10px] font-extrabold uppercase text-[var(--muted)] z-10">
            Or Bypass Mode
          </span>
        </div>

        {/* Guest access modes */}
        <div className="space-y-3">
          <button
            onClick={() => loginAsGuest("guest_student")}
            className="w-full py-3 bg-[var(--surface-light)] hover:bg-[var(--surface)] text-[var(--foreground)] hover:text-[var(--primary-text)] font-extrabold text-xs pixel-border flex items-center justify-center gap-2 transition-all active:translate-y-[1px]"
          >
            <span>🎓</span> Enter immediately as Guest Student
          </button>
          <button
            onClick={() => loginAsGuest("guest_teacher")}
            className="w-full py-3 bg-[var(--surface-light)] hover:bg-[var(--surface)] text-[var(--foreground)] hover:text-[var(--primary-text)] font-extrabold text-xs pixel-border flex items-center justify-center gap-2 transition-all active:translate-y-[1px]"
          >
            <span>👨‍🏫</span> Enter immediately as Guest Teacher
          </button>
        </div>

      </div>

    </div>
  );
}
