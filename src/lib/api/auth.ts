import type { AuthUser } from "@/types/auth";
import { request } from "@/lib/api/request";

export function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  return request<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function fetchGoogleSignInStatus(): Promise<{ configured: boolean }> {
  return request<{ configured: boolean }>("/auth/google/status");
}

/** A full browser navigation, not a fetch — OAuth needs a real redirect to Google. */
export const GOOGLE_SIGN_IN_URL = "/api/auth/google/start";
