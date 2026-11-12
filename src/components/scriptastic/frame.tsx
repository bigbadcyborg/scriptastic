import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function DeskFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen">
      <header className="relative overflow-hidden border-b border-line">
        <svg
          className="orbits pointer-events-none absolute inset-x-0 top-0 h-32 w-full"
          viewBox="0 0 768 128"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <ellipse cx="70" cy="70" rx="680" ry="28" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="70" cy="70" rx="480" ry="18" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="70" cy="70" rx="300" ry="10" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </svg>
        <div className="relative mx-auto flex w-full max-w-3xl items-end justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-faint uppercase">Holy Bible</p>
            <h1 className="font-serif text-3xl leading-none font-medium tracking-tight">Scriptastic</h1>
          </Link>
          {aside ? <div className="identity-chip flex min-h-11 items-center">{aside}</div> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export function messageOf(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Something went wrong. Try again.";
}
