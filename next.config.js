/** @type {import('next').NextConfig} */

const fs = require("fs");
const path = require("path");

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeBoolean(value) {
  if (value === "__NEXT_PUBLIC_AUTH_ENABLED_PLACEHOLDER__") {
    return value;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase())
    ? "true"
    : "false";
}

const SETTINGS_DIR = path.resolve(__dirname, "..", "data", "user", "settings");
const SYSTEM_SETTINGS = readJsonFile(path.join(SETTINGS_DIR, "system.json"));
const AUTH_SETTINGS = readJsonFile(path.join(SETTINGS_DIR, "auth.json"));
const BACKEND_PORT = firstNonEmpty(
  process.env.BACKEND_PORT,
  SYSTEM_SETTINGS.backend_port,
  "8001",
);

// Use data/user/settings as the frontend source of truth. Environment values
// remain explicit deployment overrides for Docker/CI.
const NEXT_PUBLIC_API_BASE = firstNonEmpty(
  process.env.NEXT_PUBLIC_API_BASE_EXTERNAL,
  SYSTEM_SETTINGS.next_public_api_base_external,
  process.env.NEXT_PUBLIC_API_BASE,
  SYSTEM_SETTINGS.next_public_api_base,
  `http://localhost:${BACKEND_PORT}`,
);

const NEXT_PUBLIC_AUTH_ENABLED = normalizeBoolean(
  firstNonEmpty(
    process.env.NEXT_PUBLIC_AUTH_ENABLED,
    process.env.AUTH_ENABLED,
    AUTH_SETTINGS.enabled,
    "false",
  ),
);

process.env.NEXT_PUBLIC_API_BASE = NEXT_PUBLIC_API_BASE;
process.env.NEXT_PUBLIC_AUTH_ENABLED = NEXT_PUBLIC_AUTH_ENABLED;

// Resolve the build-time application version.
const APP_VERSION = (() => {
  try {
    const text = fs.readFileSync(
      path.resolve(__dirname, "..", "nalar-ai", "__version__.py"),
      "utf8",
    );
    const match = text.match(/__version__\s*=\s*["']([^"']+)["']/);
    if (match) return match[1];
  } catch {}
  return "";
})();

const nextConfig = {
  // Expose the build-time version to the browser so the sidebar badge
  // can compare it against GitHub's latest release.
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_AUTH_ENABLED,
  },

  // Standalone output: self-contained server.js + minimal node_modules
  // This eliminates the need to copy the full node_modules into Docker production images
  output: "standalone",

  // web/proxy.ts (the Next.js middleware) forwards /api/* and /ws/* to the
  // backend by buffering and re-issuing the request. Next caps the buffered
  // request body at 10MB by default, but the backend accepts uploads up to
  // 200MB (DocumentValidator.MAX_FILE_SIZE). Raise the proxy cap to match (plus
  // multipart overhead headroom) so knowledge-base document uploads aren't
  // silently truncated when they pass through the proxy.
  // NOTE: keep this the ONLY `experimental` key in this object. A second one
  // used to sit further down with just `proxyTimeout`, and because a later key
  // wins in a JS object literal it silently dropped `proxyClientMaxBodySize`
  // and `turbopackMemoryLimit` below — uploads went back to Next's 10MB default
  // even after restarting the dev server.
  experimental: {
    // Rewrites to the backend are proxied by the dev server, which caps the
    // proxied request at 30s by default (router-utils/proxy-request.ts). PDF
    // imports for final-report documents routinely take 60-120s of extraction
    // on this 2-core machine, so the proxy cut the connection at 30s and the
    // browser saw 500 while the backend had actually finished with 201. Raise
    // the ceiling to 10 minutes; normal requests are unaffected.
    proxyTimeout: 30 * 60 * 1000,

    proxyClientMaxBodySize: 210 * 1024 * 1024,

    // This app is developed on a 2-core / 8GB Windows box. Turbopack's native
    // side is allowed to grow unbounded by default, and with `next dev` it grew
    // until Windows refused the allocation and V8 aborted the dev server with
    // "FATAL ERROR: Zone Allocation failed - process out of memory" mid-compile
    // (the JS heap was only ~12MB at the time — the machine, not the heap, ran
    // out). Capping the compiler makes it evict and stay alive instead.
    turbopackMemoryLimit: 2048 * 1024 * 1024,

    // Kurangi jumlah modul barrel yang diproses pada cold compile.
    optimizePackageImports: ["lucide-react", "framer-motion"],

    // Turbopack's dev filesystem cache defaults to on. On this project it grew
    // to 855MB across two stale generations and logged "Finished writing to
    // filesystem cache in 94s" — 94 seconds of disk churn fighting the same two
    // cores that are trying to compile the route you are waiting for. Keep the
    // cache *on* so the 70-second cold compile only hits once; the write penalty
    // is tolerable after clearing the stale cache and setting a memory cap.
    // (SST files land in .next/dev/cache/turbopack/.gitignore that already
    // exists, so they won't leak into git.)
  },

  // Move dev indicator to bottom-right corner
  devIndicators: {
    position: "bottom-right",
  },

  // `/` is not a page, it is an alias for the chat workspace. Resolving that
  // alias at the routing layer (rather than in a client component that mounts,
  // reads window.location and calls router.replace) means opening the app
  // builds and renders ONE route instead of two: previously every cold start
  // compiled `(workspace)/page.tsx` + the workspace layout, painted an empty
  // screen, and only then started compiling `/home` — two sequential Turbopack
  // compiles before the user saw anything.
  //
  // Query strings are forwarded automatically, so `?capability=` / `?tool=`
  // still reach `/home` (it reads them from window.location itself), and the
  // legacy `/?session=<id>` deep link keeps mapping onto `/home/<id>`.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "session", value: "(?<sessionId>[^&]+)" }],
        destination: "/home/:sessionId",
        permanent: false,
      },
      {
        source: "/",
        destination: "/home",
        permanent: false,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${NEXT_PUBLIC_API_BASE}/api/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${NEXT_PUBLIC_API_BASE}/ws/:path*`,
      },
    ];
  },

  // Transpile mermaid and related packages for proper ESM handling
  transpilePackages: ["mermaid"],

  // Next.js 16 blocks cross-origin access to /_next/* dev resources (HMR
  // WebSocket, fonts, dev-only scripts) unless the request host is on this
  // allow-list. Without it, browsing http://127.0.0.1:<port>/ against a dev
  // server bound to localhost silently breaks client hydration — the SSR HTML
  // renders, but no React event handlers or effects ever attach.
  allowedDevOrigins: ["127.0.0.1"],

  // Turbopack configuration (used when running `npm run dev:turbo`)
  turbopack: {
    resolveAlias: {
      // Fix for mermaid's cytoscape dependency - use CJS version
      cytoscape: "cytoscape/dist/cytoscape.cjs.js",
    },
  },

  // Webpack configuration (used for production builds - next build)
  webpack: (config) => {
    const path = require("path");
    config.resolve.alias = {
      ...config.resolve.alias,
      cytoscape: path.resolve(
        __dirname,
        "node_modules/cytoscape/dist/cytoscape.cjs.js",
      ),
    };
    return config;
  },
};

module.exports = nextConfig;
