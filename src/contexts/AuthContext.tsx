"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

export type UserRole = "teacher" | "student" | "guest_teacher" | "guest_student";

export interface User {
  username: string;
  email?: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, role: UserRole) => Promise<boolean>;
  signup: (username: string, email: string, role: UserRole) => Promise<boolean>;
  loginAsGuest: (role: "guest_student" | "guest_teacher") => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("lumina_auth_user");
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse auth user", e);
        }
      }
      setLoading(false);
    }
  }, []);

  // Protect routes based on role and auth state
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/auth", "/", "/explore"];
    const isPublic = publicRoutes.includes(pathname);

    if (!user && !isPublic) {
      toast.info("Authentication required. Redirecting to login.");
      router.push("/auth");
    } else if (user) {
      // Role protection
      const isTeacherRole = user.role === "teacher" || user.role === "guest_teacher";
      if (pathname.startsWith("/teacher") && !isTeacherRole) {
        toast.error("Access denied. Teacher privilege required.");
        router.push("/my-learnings");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, role: UserRole): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        toast.error(data.error || "Failed to log in");
        return false;
      }

      const newUser: User = {
        username: data.user.username,
        email: data.user.email,
        role: role, // Log in with the selected role
      };

      setUser(newUser);
      localStorage.setItem("lumina_auth_user", JSON.stringify(newUser));
      toast.success(`Welcome back, ${newUser.username}!`);
      
      // Redirect based on role
      if (role === "teacher") {
        router.push("/teacher");
      } else {
        router.push("/my-learnings");
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to server");
      return false;
    }
  };

  const signup = async (username: string, email: string, role: UserRole): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", username, email }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        toast.error(data.error || "Failed to create account");
        return false;
      }

      const newUser: User = {
        username: username,
        email: email,
        role: role,
      };

      setUser(newUser);
      localStorage.setItem("lumina_auth_user", JSON.stringify(newUser));
      toast.success(`Account created! Welcome, ${username}.`);

      // Redirect based on role
      if (role === "teacher") {
        router.push("/teacher");
      } else {
        router.push("/my-learnings");
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to server");
      return false;
    }
  };

  const loginAsGuest = async (role: "guest_student" | "guest_teacher") => {
    const isGuestTeacher = role === "guest_teacher";
    const guestUser: User = {
      username: isGuestTeacher ? "Guest Teacher" : "Guest Student",
      role: role,
    };

    setUser(guestUser);
    localStorage.setItem("lumina_auth_user", JSON.stringify(guestUser));
    toast.success(`Logged in as ${guestUser.username}!`);

    if (isGuestTeacher) {
      router.push("/teacher");
    } else {
      router.push("/my-learnings");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("lumina_auth_user");
    toast.info("Logged out successfully");
    router.push("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
