"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, me, type MeOrganization, type MeRead } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { getCachedUser, setCachedUser } from "@/lib/user";

interface UserContextValue {
  user: MeRead | null;
  organization: MeOrganization | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeRead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCachedUser());
  }, []);

  useEffect(() => {
    let active = true;

    me()
      .then((data) => {
        if (!active) return;
        setUser(data);
        setCachedUser(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/auth/login");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const value = useMemo<UserContextValue>(
    () => ({ user, organization: user?.organization ?? null, loading }),
    [user, loading],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser deve ser usado dentro de <UserProvider>");
  }
  return context;
}
