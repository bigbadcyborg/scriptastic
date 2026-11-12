import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DeskFrame, messageOf } from "@/components/scriptastic/frame";
import {
  createAccount,
  ensureMembership,
  listAccounts,
  removeAccount,
  updateAccount,
  type AccountRole,
  type AccountRow,
} from "@/lib/accounts";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

function AccountsPage() {
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState<AccountRole | "locked" | "pending" | "error">("pending");
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancel = false;
    ensureMembership()
      .then(async (membership) => {
        if (cancel) return;
        if (membership.role !== "admin") {
          setRole("locked");
          return;
        }
        const accounts = await listAccounts();
        if (cancel) return;
        setRows(accounts);
        setRole("admin");
      })
      .catch((err) => {
        if (cancel) return;
        setError(messageOf(err));
        setRole("error");
      });
    return () => {
      cancel = true;
    };
  }, [isPending, user?.id]);

  if (isPending || (user && role === "pending")) {
    return (
      <DeskFrame aside={<UserButton />}>
        <p className="font-serif text-2xl">Opening the roll…</p>
      </DeskFrame>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (role === "error") {
    return (
      <DeskFrame aside={<UserButton />}>
        <p className="font-serif text-2xl">The roll could not be opened</p>
        <p className="mt-3 text-sm text-muted" role="alert">
          {error}
        </p>
      </DeskFrame>
    );
  }
  if (role !== "admin") {
    return (
      <DeskFrame aside={<UserButton />}>
        <p className="text-xs font-medium tracking-widest text-faint uppercase">Accounts</p>
        <h2 className="mt-2 font-serif text-3xl font-medium">Administrators only</h2>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
          Members may read and search. Only an administrator can create, edit, or remove accounts.
        </p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center text-sm underline decoration-line-strong underline-offset-4">
          Return to the desk
        </Link>
      </DeskFrame>
    );
  }

  return (
    <DeskFrame aside={<UserButton />}>
      <p className="text-xs font-medium tracking-widest text-faint uppercase">Accounts</p>
      <h2 className="mt-2 font-serif text-3xl font-medium">The roll</h2>
      <p className="mt-3 max-w-prose text-sm leading-6 text-muted">
        Add a reader, change a name or password, or take someone off the roll. Members cannot do this.
      </p>
      <CreateAccount
        onCreated={(row) => setRows((current) => [...current, row])}
      />
      <ul className="mt-8 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <AccountCard
              row={row}
              selfId={user.id}
              adminCount={rows.filter((item) => item.role === "admin").length}
              onChanged={(next) => setRows((current) => current.map((item) => (item.id === next.id ? next : item)))}
              onRemoved={() => setRows((current) => current.filter((item) => item.id !== row.id))}
            />
          </li>
        ))}
      </ul>
    </DeskFrame>
  );
}

function CreateAccount({ onCreated }: { onCreated: (row: AccountRow) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const row = await createAccount({ data: { name, email, password, role } });
      onCreated(row);
      setName("");
      setEmail("");
      setPassword("");
      setRole("member");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 rounded-md border border-line bg-raised p-4" onSubmit={onSubmit}>
      <h3 className="font-serif text-xl font-medium">New account</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Name</span>
          <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select id="account-role" value={role} onChange={(event) => setRole(event.target.value as AccountRole)}>
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-fg" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 h-12 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add account"}
      </button>
    </form>
  );
}

function AccountCard({
  row,
  selfId,
  adminCount,
  onChanged,
  onRemoved,
}: {
  row: AccountRow;
  selfId: string;
  adminCount: number;
  onChanged: (row: AccountRow) => void;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(row.name);
  const [role, setRole] = useState<AccountRole>(row.role === "admin" ? "admin" : "member");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSelf = row.id === selfId;
  const lastAdmin = row.role === "admin" && adminCount <= 1;

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateAccount({ data: { id: row.id, name, role, password } });
      onChanged({ ...row, name: name.trim(), role });
      setPassword("");
      setEditing(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    setError(null);
    setPending(true);
    try {
      await removeAccount({ data: { id: row.id } });
      onRemoved();
    } catch (err) {
      setError(messageOf(err));
      setPending(false);
    }
  }

  return (
    <article className="rounded-md border border-line bg-inset p-4">
      {editing ? (
        <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AccountRole)}
              disabled={lastAdmin}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label className="field sm:col-span-2">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep the current password"
            />
          </label>
          {error ? (
            <p className="text-sm text-fg sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="h-11 rounded-sm border border-line px-4 text-sm"
              onClick={() => {
                setEditing(false);
                setName(row.name);
                setRole(row.role === "admin" ? "admin" : "member");
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-serif text-xl font-medium">{row.name}</h3>
            <p className="truncate text-sm text-muted">{row.email}</p>
            <p className="mt-1 text-xs font-medium tracking-widest text-faint uppercase">
              {row.role === "admin" ? "Administrator" : row.role === "member" ? "Member" : "No role"}
              {isSelf ? " · You" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-11 rounded-sm border border-line bg-raised px-4 text-sm"
              onClick={() => {
                setConfirming(false);
                setEditing(true);
              }}
            >
              Edit
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  className="h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
                  onClick={() => void onRemove()}
                >
                  {pending ? "Removing…" : "Confirm remove"}
                </button>
                <button type="button" className="h-11 rounded-sm border border-line px-4 text-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="h-11 rounded-sm border border-line px-4 text-sm disabled:opacity-40"
                disabled={isSelf || lastAdmin}
                onClick={() => setConfirming(true)}
              >
                Remove
              </button>
            )}
          </div>
          {error ? (
            <p className="text-sm text-fg sm:hidden" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
      {!editing && error ? (
        <p className="mt-3 hidden text-sm text-fg sm:block" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
