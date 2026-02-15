"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { defineAbilitiesFor } from "@/lib/abilities";
import type { SessionData } from "./session";

interface AuthContextType {
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
  orgName: string | null;
  hasMfa: boolean;
  user: { email: string; firstName?: string | null; lastName?: string | null } | null;
  isLoaded: boolean;
  // These will be called by components; they trigger server actions via fetch
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  userId: null,
  orgId: null,
  orgRole: null,
  orgName: null,
  hasMfa: false,
  user: null,
  isLoaded: false,
  switchOrg: async () => {},
});

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: SessionData;
}) {
  const [session, setSession] = useState<SessionData>(initialSession);
  const [isLoaded, setIsLoaded] = useState(true); // Already loaded from server

  const switchOrg = useCallback(async (orgId: string) => {
    console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) called for orgId:", orgId);
    // Call the API to switch org and get new token
    // Then update session via server action
    try {
      const response = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) response ok, data:", data);
        setSession(prev => ({
          ...prev,
          orgId: data.org.id,
          orgRole: data.org.role,
          orgName: data.org.name,
        }));
        // Reload to refresh all data with new org context
        window.location.reload();
      }
    } catch (err) {
      console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) ERROR:", err);
      console.error("Failed to switch org:", err);
    }
  }, []);

  const value = useMemo(() => ({
    userId: session.userId ?? null,
    orgId: session.orgId ?? null,
    orgRole: session.orgRole ?? null,
    orgName: session.orgName ?? null,
    hasMfa: session.hasMfa ?? false,
    user: session.user ?? null,
    isLoaded,
    switchOrg,
  }), [session, isLoaded, switchOrg]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
