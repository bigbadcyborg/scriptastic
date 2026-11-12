import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function postAuth(request: Request) {
  const { guardPasswordAttempt } = await import("@/lib/login-throttle");
  return guardPasswordAttempt(request, () => auth.handler(request));
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => postAuth(request),
    },
  },
});
