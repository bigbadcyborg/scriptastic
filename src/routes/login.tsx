import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DeskFrame, messageOf } from "@/components/scriptastic/frame";
import { createFirstAdmin, getAccountGate } from "@/lib/accounts";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PASSWORD_ATTEMPT_LIMIT, PASSWORD_ATTEMPT_WINDOW_MINUTES } from "@/lib/login-limit";

export const Route = createFileRoute("/login")({ component: Login });

const BEARER_KEY = "grok-auth.bearer-token";

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled || isPending || user) return;
    let cancel = false;
    getAccountGate()
      .then((gate) => {
        if (!cancel) setNeedsFirstAdmin(gate.needsFirstAdmin);
      })
      .catch((error) => {
        if (!cancel) setLoadError(messageOf(error));
      });
    return () => {
      cancel = true;
    };
  }, [isPending, user]);

  if (!authEnabled) {
    return (
      <DeskFrame>
        <p className="text-sm text-muted">Sign-in is turned off.</p>
      </DeskFrame>
    );
  }
  if (isPending || (!user && needsFirstAdmin === null && !loadError)) {
    return (
      <DeskFrame>
        <p className="font-serif text-2xl">Opening the desk…</p>
      </DeskFrame>
    );
  }
  if (user) return <Navigate to="/" />;
  if (loadError) {
    return (
      <DeskFrame>
        <p className="font-serif text-2xl">The roll could not be opened</p>
        <p className="mt-3 text-sm text-muted" role="alert">
          {loadError}
        </p>
      </DeskFrame>
    );
  }
  return needsFirstAdmin ? <FirstAdminForm /> : <SignInForm />;
}

function FirstAdminForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createFirstAdmin({ data: { name, email, password } });
      await signInWithPassword(email, password);
    } catch (err) {
      setError(messageOf(err));
      setPending(false);
    }
  }

  return (
    <DeskFrame>
      <p className="text-xs font-medium tracking-widest text-faint uppercase">First administrator</p>
      <h2 className="mt-2 font-serif text-3xl leading-tight font-medium text-balance">Open the library</h2>
      <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
        This account keeps the roll. Only an administrator can add, change, or remove accounts after this.
      </p>
      <AuthForm
        name={name}
        email={email}
        password={password}
        pending={pending}
        error={error}
        submitLabel="Create administrator"
        showName
        passwordAutoComplete="new-password"
        onName={setName}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={onSubmit}
      />
    </DeskFrame>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signInWithPassword(email, password);
    } catch (err) {
      setError(messageOf(err));
      setPending(false);
    }
  }

  return (
    <DeskFrame>
      <p className="text-xs font-medium tracking-widest text-faint uppercase">Sign in</p>
      <h2 className="mt-2 font-serif text-3xl leading-tight font-medium">Welcome back</h2>
      <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
        An administrator creates every account. There is no public registration.
      </p>
      <AuthForm
        email={email}
        password={password}
        pending={pending}
        error={error}
        submitLabel="Sign in"
        passwordAutoComplete="current-password"
        showAttemptLimit
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={onSubmit}
      />
    </DeskFrame>
  );
}

function AuthForm({
  name,
  email,
  password,
  pending,
  error,
  submitLabel,
  showName,
  passwordAutoComplete,
  showAttemptLimit,
  onName,
  onEmail,
  onPassword,
  onSubmit,
}: {
  name?: string;
  email: string;
  password: string;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  showName?: boolean;
  passwordAutoComplete: "new-password" | "current-password";
  showAttemptLimit?: boolean;
  onName?: (value: string) => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="mt-6 flex max-w-sm flex-col gap-4" onSubmit={onSubmit}>
      {showName ? (
        <label className="field">
          <span>Name</span>
          <input
            id="name"
            name="name"
            value={name ?? ""}
            onChange={(event) => onName?.(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          autoComplete={passwordAutoComplete}
          minLength={8}
          required
        />
      </label>
      <p className="text-sm text-faint">At least 8 characters.</p>
      {showAttemptLimit ? (
        <p className="text-sm text-faint">
          {PASSWORD_ATTEMPT_LIMIT} wrong passwords in {PASSWORD_ATTEMPT_WINDOW_MINUTES} minutes pauses sign-in.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-fg" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-md bg-accent text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

async function signInWithPassword(email: string, password: string) {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const token = response.headers.get("set-auth-token");
  if (!response.ok) {
    let message = "That email or password is not recognized.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message && !/invalid email or password/i.test(body.message)) message = body.message;
    } catch {
      /* keep the quiet message */
    }
    throw new Error(message);
  }
  let rawToken: string | null = null;
  try {
    const body = (await response.json()) as { token?: string | null };
    rawToken = body.token ?? null;
  } catch {
    rawToken = null;
  }
  const stored = token || rawToken;
  if (stored) {
    try {
      sessionStorage.setItem(BEARER_KEY, stored);
    } catch {
      /* storage unavailable */
    }
  }
  window.location.assign("/");
}
