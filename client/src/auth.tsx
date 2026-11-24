import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "./services/api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("evidence_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    api<User>("/auth/me")
      .then((u) => {
        setUser(u);
        localStorage.setItem("evidence_user", JSON.stringify(u));
      })
      .catch(() => {
        if (!localStorage.getItem("evidence_user")) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loginDemo = () => {
    const demoUser: User = {
      id: "demo-user",
      email: "raja.das@evidencedesk.ai",
      displayName: "Raja Das (Researcher)",
    };
    setUser(demoUser);
    localStorage.setItem("evidence_user", JSON.stringify(demoUser));
  };

  const value: AuthCtx = {
    user,
    loading,
    login: async (email, password) => {
      const u = await api<User>("/auth/login", { method: "POST", json: { email, password } });
      setUser(u);
      localStorage.setItem("evidence_user", JSON.stringify(u));
    },
    loginDemo,
    register: async (displayName, email, password) => {
      const u = await api<User>("/auth/register", { method: "POST", json: { displayName, email, password } });
      setUser(u);
      localStorage.setItem("evidence_user", JSON.stringify(u));
    },
    logout: async () => {
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("evidence_user");
      setUser(null);
    },
    deleteAccount: async () => {
      await api("/auth/me", { method: "DELETE" }).catch(() => {});
      localStorage.removeItem("evidence_user");
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
