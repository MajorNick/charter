import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const host = "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const rootDir = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(rootDir, "dist");
const indexPath = join(distDir, "index.html");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const sendFile = (response, filePath) => {
  const contentType = contentTypes[extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    const candidatePath = resolve(distDir, normalize(relativePath));

    if (!candidatePath.startsWith(distDir)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    if (existsSync(candidatePath)) {
      const fileStat = await stat(candidatePath);
      if (fileStat.isFile()) {
        sendFile(response, candidatePath);
        return;
      }
    }

    sendFile(response, indexPath);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Serving frontend from ${distDir} on http://${host}:${port}`);
});
