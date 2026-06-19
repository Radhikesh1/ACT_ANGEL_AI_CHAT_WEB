import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import https from "https";
import http from "http";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

function fetchProxy(prefix: string, target: string): Plugin {
  const targetUrl = new URL(target);
  const port = targetUrl.port ? Number(targetUrl.port) : targetUrl.protocol === "https:" ? 443 : 80;
  const useHttps = targetUrl.protocol === "https:";

  function proxyRequest(
    url: string,
    method: string,
    reqHeaders: Record<string, string>,
    body?: Buffer,
  ): Promise<{ status: number; headers: Record<string, string | string[]>; body: Buffer }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = {
        hostname: targetUrl.hostname,
        port,
        path: parsed.pathname + parsed.search,
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

  return {
    name: "fetch-proxy",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith(prefix)) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

          const reqHeaders: Record<string, string> = { host: targetUrl.host };
          for (const [key, value] of Object.entries(req.headers)) {
            if (key === "host" || key === "connection") continue;
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
            res.setHeader(key, value);
          }
          res.end(result.body);
        } catch (e) {
          console.error("[fetch-proxy] error:", e);
          res.statusCode = 502;
          res.end("Bad Gateway");
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.PUBLIC_API_URL ?? "https://actangels.com";

  return {
    plugins: [react(), tailwindcss(), fetchProxy("/api", apiTarget)],
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
