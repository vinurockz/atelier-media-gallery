import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "@/types/auth";
import { fetchGoogleSignInStatus, GOOGLE_SIGN_IN_URL } from "@/lib/api/auth";
import { FilmIcon, GoogleIcon, SpinnerIcon } from "@/components/icons";

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthUser>;
  onRegister: (
    email: string,
    password: string,
    name: string,
  ) => Promise<AuthUser>;
};

type Mode = "login" | "register";

const inputClass =
  "w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent";

/** The signed-out landing screen — email/password sign in or registration, plus a Google
 * sign-in button that's fully wired server-side but stays disabled (with an explanation)
 * until GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars are set on the server. */
export function LoginPage({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    fetchGoogleSignInStatus()
      .then((s) => setGoogleConfigured(s.configured))
      .catch(() => setGoogleConfigured(false));
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await onLogin(email, password);
      else await onRegister(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-linen bg-surface p-6 shadow-lifted">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-surface">
            <FilmIcon className="size-4" />
          </span>
          <span className="font-serif text-[1.2rem] leading-none text-ink">
            Atelier
          </span>
        </div>

        <div className="mb-5 flex rounded-md bg-linen/60 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 rounded px-3 py-1.5 transition ${
              mode === "login" ? "bg-white text-ink shadow-sm" : "text-stone"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 rounded px-3 py-1.5 transition ${
              mode === "register" ? "bg-white text-ink shadow-sm" : "text-stone"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Name"
              className={inputClass}
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8 characters)"
            aria-label="Password"
            className={inputClass}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <SpinnerIcon className="size-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-stone">
          <div className="h-px flex-1 bg-linen" />
          or
          <div className="h-px flex-1 bg-linen" />
        </div>

        <a
          href={googleConfigured ? GOOGLE_SIGN_IN_URL : undefined}
          aria-disabled={!googleConfigured}
          title={
            googleConfigured
              ? undefined
              : "Google sign-in isn't configured on this server yet."
          }
          onClick={(e) => {
            if (!googleConfigured) e.preventDefault();
          }}
          className={`flex items-center justify-center gap-2 rounded-md border border-linen px-3 py-2 text-sm font-medium transition ${
            googleConfigured
              ? "text-ink hover:bg-linen-hover"
              : "cursor-not-allowed text-stone/50"
          }`}
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </a>
      </div>
    </div>
  );
}
