import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type AccountRole = "admin" | "member";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: AccountRole | "none";
};

type CreateInput = {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
};

type UpdateInput = {
  id: string;
  name: string;
  role: AccountRole;
  password: string;
};

function cleanName(value: string) {
  const name = value.trim();
  if (name.length < 1 || name.length > 80) throw new Error("Enter a name.");
  return name;
}

function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
  return email;
}

function cleanPassword(value: string, required: boolean) {
  if (!value && !required) return "";
  if (value.length < 8 || value.length > 128) throw new Error("Use a password of at least 8 characters.");
  return value;
}

function asCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function cleanRole(value: string): AccountRole {
  if (value !== "admin" && value !== "member") throw new Error("Choose administrator or member.");
  return value;
}

async function requireAdmin(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from member_role where user_id = ${userId}`;
  if (rows[0]?.role !== "admin") throw new Error("Only an administrator can manage accounts.");
  return sql;
}

async function insertCredential(email: string, name: string, password: string, role: AccountRole) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select "id" from "user" where lower("email") = ${email}`;
  if (existing.length) throw new Error("An account with that email already exists.");
  const id = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${name}, ${email}, true, now(), now())
  `;
  await sql`
    insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
    values (${accountId}, ${id}, 'credential', ${id}, ${passwordHash}, now(), now())
  `;
  await sql`insert into member_role (user_id, role) values (${id}, ${role})`;
  return { id, name, email, role };
}

export const getAccountGate = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ users: number }>`select count(*)::int as users from "user"`;
  return { needsFirstAdmin: asCount(rows[0]?.users) === 0 };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ users: number }>`select count(*)::int as users from "user"`;
    if (asCount(rows[0]?.users) > 0) throw new Error("An administrator already exists. Sign in instead.");
    const name = cleanName(data.name);
    const email = cleanEmail(data.email);
    const password = cleanPassword(data.password, true);
    await insertCredential(email, name, password, "admin");
    return { ok: true as const };
  });

export const ensureMembership = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const mine = await sql<{ role: AccountRole }>`select role from member_role where user_id = ${context.userId}`;
    if (mine[0]) return { role: mine[0].role as AccountRole | null };
    const admins = await sql<{ user_id: string }>`select user_id from member_role where role = 'admin' limit 1`;
    if (admins.length === 0) {
      await sql`
        insert into member_role (user_id, role) values (${context.userId}, 'admin')
        on conflict (user_id) do nothing
      `;
      const again = await sql<{ role: AccountRole }>`select role from member_role where user_id = ${context.userId}`;
      return { role: (again[0]?.role ?? null) as AccountRole | null };
    }
    return { role: null };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<AccountRow>`
      select u."id" as id, u."name" as name, u."email" as email, coalesce(r.role, 'none') as role
      from "user" u
      left join member_role r on r.user_id = u."id"
      order by u."createdAt" asc
    `;
  });

export const createAccount = createServerFn({ method: "POST" })
  .validator((input: CreateInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const name = cleanName(data.name);
    const email = cleanEmail(data.email);
    const password = cleanPassword(data.password, true);
    const role = cleanRole(data.role);
    return insertCredential(email, name, password, role);
  });

export const updateAccount = createServerFn({ method: "POST" })
  .validator((input: UpdateInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const id = data.id.trim();
    if (!id) throw new Error("Missing account.");
    const name = cleanName(data.name);
    const role = cleanRole(data.role);
    const password = cleanPassword(data.password ?? "", false);
    const current = await sql<{ role: string }>`select role from member_role where user_id = ${id}`;
    if (current[0]?.role === "admin" && role !== "admin") {
      const admins = await sql<{ n: number }>`select count(*)::int as n from member_role where role = 'admin'`;
      if (asCount(admins[0]?.n) <= 1) throw new Error("The library needs at least one administrator.");
    }
    const updated = await sql<{ id: string }>`
      update "user" set "name" = ${name}, "updatedAt" = now() where "id" = ${id} returning "id"
    `;
    if (!updated.length) throw new Error("That account is gone.");
    await sql`
      insert into member_role (user_id, role) values (${id}, ${role})
      on conflict (user_id) do update set role = excluded.role
    `;
    if (password) {
      const passwordHash = await hashPassword(password);
      const creds = await sql<{ id: string }>`
        select "id" from "account" where "userId" = ${id} and "providerId" = 'credential'
      `;
      if (creds[0]) {
        await sql`
          update "account" set "password" = ${passwordHash}, "updatedAt" = now() where "id" = ${creds[0].id}
        `;
      } else {
        await sql`
          insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
          values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${passwordHash}, now(), now())
        `;
      }
    }
    return { ok: true as const };
  });

export const removeAccount = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const id = data.id.trim();
    if (id === context.userId) throw new Error("You cannot remove your own account.");
    const current = await sql<{ role: string }>`select role from member_role where user_id = ${id}`;
    if (current[0]?.role === "admin") {
      const admins = await sql<{ n: number }>`select count(*)::int as n from member_role where role = 'admin'`;
      if (asCount(admins[0]?.n) <= 1) throw new Error("The library needs at least one administrator.");
    }
    const removed = await sql<{ id: string }>`delete from "user" where "id" = ${id} returning "id"`;
    if (!removed.length) throw new Error("That account is gone.");
    return { ok: true as const };
  });
