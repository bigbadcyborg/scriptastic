import { getSql } from "@/lib/db";
import { PASSWORD_ATTEMPT_LIMIT, PASSWORD_ATTEMPT_WINDOW_MINUTES } from "@/lib/login-limit";

const IP_LIMIT = 20;
const WINDOW_MS = PASSWORD_ATTEMPT_WINDOW_MINUTES * 60_000;

type Sql = Awaited<ReturnType<typeof getSql>>;

type Recorded = {
  emailBucket: string | null;
  emailId: number | string | null;
  ipId: number | string | null;
};

function isPasswordSignIn(request: Request) {
  if (request.method !== "POST") return false;
  try {
    return new URL(request.url).pathname.endsWith("/sign-in/email");
  } catch {
    return false;
  }
}

function emailBucket(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase().slice(0, 200);
  if (!email) return null;
  return `email:${email}`;
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || real;
  if (!ip) return null;
  return `ip:${ip.slice(0, 64)}`;
}

function windowStart() {
  return new Date(Date.now() - WINDOW_MS).toISOString();
}

function minutesLeft(oldest: unknown) {
  const time = oldest instanceof Date ? oldest.getTime() : Date.parse(String(oldest ?? ""));
  if (!Number.isFinite(time)) return PASSWORD_ATTEMPT_WINDOW_MINUTES;
  const remaining = time + WINDOW_MS - Date.now();
  return Math.max(1, Math.ceil(remaining / 60_000));
}

function locked(oldest: unknown) {
  const minutes = minutesLeft(oldest);
  const unit = minutes === 1 ? "minute" : "minutes";
  return new Response(
    JSON.stringify({
      message: `Too many password attempts. Try again in ${minutes} ${unit}.`,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(minutes * 60),
        "cache-control": "no-store",
      },
    },
  );
}

async function prune(sql: Sql) {
  const since = windowStart();
  await sql`delete from password_attempt where attempted_at < ${since}`;
}

async function countBucket(sql: Sql, bucket: string) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from password_attempt where bucket = ${bucket}
  `;
  const count = Number(rows[0]?.n ?? 0);
  return Number.isFinite(count) ? count : 0;
}

async function oldestOf(sql: Sql, bucket: string) {
  const rows = await sql<{ oldest: string | Date | null }>`
    select min(attempted_at) as oldest from password_attempt where bucket = ${bucket}
  `;
  return rows[0]?.oldest ?? null;
}

async function record(sql: Sql, bucket: string) {
  const rows = await sql<{ id: number | string }>`
    insert into password_attempt (bucket) values (${bucket}) returning id
  `;
  return rows[0]?.id ?? null;
}

async function begin(request: Request): Promise<Response | Recorded> {
  let email: string | null = null;
  let password = "";
  try {
    const body = (await request.clone().json()) as { email?: unknown; password?: unknown };
    email = emailBucket(body.email);
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return { emailBucket: null, emailId: null, ipId: null };
  }
  if (!password) return { emailBucket: null, emailId: null, ipId: null };

  const ip = clientIp(request);
  const sql = await getSql();
  await prune(sql);

  if (email && (await countBucket(sql, email)) >= PASSWORD_ATTEMPT_LIMIT) {
    return locked(await oldestOf(sql, email));
  }
  if (ip && (await countBucket(sql, ip)) >= IP_LIMIT) {
    return locked(await oldestOf(sql, ip));
  }

  const emailId = email ? await record(sql, email) : null;
  const ipId = ip ? await record(sql, ip) : null;

  if (email && (await countBucket(sql, email)) > PASSWORD_ATTEMPT_LIMIT) {
    return locked(await oldestOf(sql, email));
  }
  if (ip && (await countBucket(sql, ip)) > IP_LIMIT) {
    return locked(await oldestOf(sql, ip));
  }

  return { emailBucket: email, emailId, ipId };
}

async function dropAttempt(recorded: Recorded) {
  const sql = await getSql();
  if (recorded.emailId != null) {
    await sql`delete from password_attempt where id = ${recorded.emailId}`;
  }
  if (recorded.ipId != null) {
    await sql`delete from password_attempt where id = ${recorded.ipId}`;
  }
}

/**
 * Caps password sign-in. Wrong guesses are kept for the window; a correct
 * password clears that email so a later sign-in is not stuck behind typos.
 * Returns the auth response, or 429 once the window is full.
 */
export async function guardPasswordAttempt(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  if (!isPasswordSignIn(request)) return next();
  let recorded: Recorded;
  try {
    const gate = await begin(request);
    if (gate instanceof Response) return gate;
    recorded = gate;
  } catch (error) {
    console.error("[login-throttle]", error);
    return next();
  }
  if (!recorded.emailBucket && recorded.ipId == null) return next();
  const response = await next();
  try {
    if (response.ok && recorded.emailBucket) {
      const sql = await getSql();
      await sql`delete from password_attempt where bucket = ${recorded.emailBucket}`;
      await dropAttempt({ ...recorded, emailId: null });
    } else if (response.status !== 401) {
      await dropAttempt(recorded);
    }
  } catch (error) {
    console.error("[login-throttle]", error);
  }
  return response;
}
