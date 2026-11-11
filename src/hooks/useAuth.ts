import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/types/auth";
import {
  fetchMe,
  login as loginRemote,
  logout as logoutRemote,
  register as registerRemote,
} from "@/lib/api/auth";

/**
 * Who's signed in, backed by the server's cookie session (see server/index.mjs's
 * resolveAuthAndCustomer). `checking` covers the one request on mount that finds out
 * whether a session cookie is already valid, so the app doesn't flash the login page
 * before that's known.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const signedInUser = await loginRemote(email, password);
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const signedInUser = await registerRemote(email, password, name);
      setUser(signedInUser);
      return signedInUser;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRemote().catch(() => {});
    setUser(null);
  }, []);

  /** Kept in sync by useCustomers after entering/leaving a customer, so `user.activeCustomerId`
   * never drifts from what the server's session actually has selected. */
  const setActiveCustomerId = useCallback((activeCustomerId: string | null) => {
    setUser((prev) => (prev ? { ...prev, activeCustomerId } : prev));
  }, []);

  return { user, checking, login, register, logout, setActiveCustomerId };
}
