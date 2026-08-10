import { redirect } from "next/navigation";

import { firstParam } from "@/lib/route-params";

/**
 * Fallback for `/`.
 *
 * Normally unreachable: `next.config.js` redirects `/` (and the legacy
 * `/?session=<id>` deep link) at the routing layer, before any route is
 * compiled or rendered. This server component only exists so the root URL
 * still resolves if that config is ever dropped — and unlike the client
 * component it replaced, it never mounts an empty screen just to call
 * `router.replace()` one render later.
 */
export default async function RootIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const sessionId = firstParam(params.session);
  const capability = firstParam(params.capability);
  const tools = params.tool
    ? Array.isArray(params.tool)
      ? params.tool
      : [params.tool]
    : [];

  const query = new URLSearchParams();
  if (capability) query.set("capability", capability);
  for (const tool of tools) query.append("tool", tool);

  const path = sessionId ? `/home/${encodeURIComponent(sessionId)}` : "/home";
  const search = query.toString();

  redirect(search ? `${path}?${search}` : path);
}
