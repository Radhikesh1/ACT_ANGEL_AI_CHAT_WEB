import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import https from "https";
import http from "http";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

// ── Routes served by the local Python backend ─────────────────────────────────
// Everything else goes to the Node / production backend.
const PYTHON_PREFIXES = ["/api/assistants", "/api/numbers", "/api/plivo", "/api/auth", "/api/admin"];

function selectTarget(url: string, pythonUrl: string, nodeUrl: string): string {
  return PYTHON_PREFIXES.some((p) => url.startsWith(p)) ? pythonUrl : nodeUrl;
}

// Strip cookie attributes that prevent the browser setting a cookie
// received from a remote host (actangels.com) while running on localhost.
function rewriteSetCookie(value: string | string[]): string | string[] {
  const fix = (c: string) =>
    c
      .replace(/;\s*Domain=[^;,]*/gi, "")   // remove Domain= directive
      .replace(/;\s*Secure(?=\s*[;,]|$)/gi, "") // remove Secure flag
      .replace(/SameSite=Strict/gi, "SameSite=Lax"); // relax SameSite for localhost
  return Array.isArray(value) ? value.map(fix) : fix(value);
}

function proxyRequest(
  fullUrl: string,
  method: string,
  reqHeaders: Record<string, string>,
  body?: Buffer,
): Promise<{ status: number; headers: Record<string, string | string[]>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(fullUrl);
    const port = targetUrl.port
      ? Number(targetUrl.port)
      : targetUrl.protocol === "https:"
      ? 443
      : 80;
    const useHttps = targetUrl.protocol === "https:";

    const options = {
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method,
      headers: reqHeaders,
      family: 4,
      rejectUnauthorized: false,
    };

    const req = (useHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 502,
          headers: res.headers as Record<string, string | string[]>,
          body: Buffer.concat(chunks),
        }),
      );
      res.on("error", reject);
    });

    req.on("error", reject);
    if (body?.length) req.write(body);
    req.end();
  });
}

function smartApiProxy(pythonTarget: string, nodeTarget: string): Plugin {
  return {
    name: "smart-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith("/api")) return next();

        const target = selectTarget(req.url, pythonTarget, nodeTarget);

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

          const targetUrl = new URL(target);
          const reqHeaders: Record<string, string> = {
            host: targetUrl.host,
            // Replace origin/referer so the remote API doesn't reject the request
            // as coming from an unknown origin (localhost).
            origin: targetUrl.origin,
            referer: targetUrl.origin + "/",
          };
          for (const [key, value] of Object.entries(req.headers)) {
            if (["host", "connection", "origin", "referer"].includes(key)) continue;
            reqHeaders[key] = Array.isArray(value) ? value.join(", ") : (value as string);
          }

          const result = await proxyRequest(
            `${target}${req.url}`,
            req.method ?? "GET",
            reqHeaders,
            body,
          );

          res.statusCode = result.status;
          for (const [key, value] of Object.entries(result.headers)) {
            if (key === "transfer-encoding") continue;
            // Rewrite Set-Cookie so cookies from actangels.com work on localhost
            if (key === "set-cookie") {
              res.setHeader(key, rewriteSetCookie(value));
            } else {
              res.setHeader(key, value);
            }
          }
          res.end(result.body);
        } catch (e) {
          console.error("[smart-api-proxy] error:", e);
          res.statusCode = 502;
          res.end("Bad Gateway");
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const pythonTarget =
    env.PYTHON_API_URL ?? env.PUBLIC_API_URL ?? "http://localhost:8000";
  const nodeTarget = env.NODE_API_URL ?? "https://actangels.com";

  return {
    plugins: [react(), tailwindcss(), smartApiProxy(pythonTarget, nodeTarget)],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      host: true,
    },
    preview: {
      port: 3000,
      host: true,
    },
  };
});
