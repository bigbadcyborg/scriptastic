import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Scriptastic } from "@/components/scriptastic/app";
import { DeskFrame } from "@/components/scriptastic/frame";
import { ensureMembership, type AccountRole } from "@/lib/accounts";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState<AccountRole | "locked" | "pending" | "error">("pending");

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setRole("pending");
      return;
    }
    let cancel = false;
    setRole("pending");
    ensureMembership()
      .then((membership) => {
        if (cancel) return;
        setRole(membership.role === "admin" || membership.role === "member" ? membership.role : "locked");
      })
      .catch(() => {
        if (!cancel) setRole("error");
      });
    return () => {
      cancel = true;
    };
  }, [isPending, user?.id]);

  if (isPending || (user && role === "pending")) {
    return (
      <DeskFrame>
        <p className="font-serif text-2xl">Opening the desk…</p>
      </DeskFrame>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (role === "error") {
    return (
      <DeskFrame aside={<UserButton />}>
        <p className="font-serif text-2xl">The desk could not be opened</p>
        <p className="mt-3 text-sm text-muted">Sign out and try again.</p>
      </DeskFrame>
    );
  }
  if (role === "locked") {
    return (
      <DeskFrame aside={<UserButton />}>
        <p className="text-xs font-medium tracking-widest text-faint uppercase">Not on the roll</p>
        <h2 className="mt-2 font-serif text-3xl font-medium text-balance">This sign-in has no account here</h2>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
          An administrator has to add you before the desk will open. Signing in somewhere else does not create an account.
        </p>
      </DeskFrame>
    );
  }
  if (role === "admin" || role === "member") return <Scriptastic role={role} />;
  return null;
}
