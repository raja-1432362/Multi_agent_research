import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "./services/api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value: AuthCtx = {
    user,
    loading,
    login: async (email, password) => setUser(await api<User>("/auth/login", { method: "POST", json: { email, password } })),
    register: async (displayName, email, password) =>
      setUser(await api<User>("/auth/register", { method: "POST", json: { displayName, email, password } })),
    logout: async () => {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    },
    deleteAccount: async () => {
      await api("/auth/me", { method: "DELETE" });
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
