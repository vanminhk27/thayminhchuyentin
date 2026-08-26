import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { checkRunner, judgeSubmission } from "./judge.js";
import { getProblem, problems, toPublicProblem } from "./problems.js";
import { SubmissionQueue } from "./queue.js";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(currentDir, "../public");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const runner = process.env.JUDGE_RUNNER || "docker";
const queue = new SubmissionQueue(Number.parseInt(process.env.JUDGE_CONCURRENCY || "2", 10));
const maxSourceBytes = 100 * 1024;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://vanminhk27.github.io";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function setCommonHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self' https://*.app.github.dev"
  );
  if (req.headers.origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    let size = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxSourceBytes + 8 * 1024) {
        reject(Object.assign(new Error("Dữ liệu gửi lên quá lớn."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(raw || "{}"));
      } catch {
        reject(Object.assign(new Error("Dữ liệu JSON không hợp lệ."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600"
    });
    res.end();
    return true;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    const runtime = await checkRunner(runner);
    json(res, runtime.ready ? 200 : 503, {
      service: "Thầy Minh Online Judge",
      ready: runtime.ready,
      runner: runtime.runner,
      runnerDetail: runtime.detail,
      queue: queue.status
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/problems") {
    json(res, 200, { problems: problems.map(toPublicProblem) });
    return true;
  }

  if (req.method === "GET" && pathname.startsWith("/api/problems/")) {
    const problemId = decodeURIComponent(pathname.slice("/api/problems/".length));
    const problem = getProblem(problemId);
    if (!problem) json(res, 404, { error: "Không tìm thấy bài tập." });
    else json(res, 200, { problem: toPublicProblem(problem) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/submissions") {
    const body = await readJsonBody(req);
    const problem = getProblem(String(body.problemId || ""));
    const sourceCode = typeof body.sourceCode === "string" ? body.sourceCode : "";
    const language = body.language || "cpp17";

    if (!problem) {
      json(res, 400, { error: "Bài tập không hợp lệ." });
      return true;
    }
    if (language !== "cpp17") {
      json(res, 400, { error: "Bản thử nghiệm hiện chỉ hỗ trợ C++17." });
      return true;
    }
    if (!sourceCode.trim()) {
      json(res, 400, { error: "Vui lòng nhập mã nguồn trước khi nộp." });
      return true;
    }
    if (Buffer.byteLength(sourceCode) > maxSourceBytes) {
      json(res, 413, { error: "Mã nguồn vượt giới hạn 100 KB." });
      return true;
    }

    const submissionId = randomUUID();
    const queuedAt = new Date().toISOString();
    const result = await queue.add(() => judgeSubmission(problem, sourceCode, runner));
    json(res, 200, { submissionId, problemId: problem.id, language, queuedAt, result });
    return true;
  }

  return false;
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const safeRelativePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = resolve(join(publicDir, safeRelativePath));
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
    json(res, 403, { error: "Đường dẫn không hợp lệ." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, "index.html");
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=300"
    });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") json(res, 404, { error: "Không tìm thấy trang." });
    else throw error;
  }
}

const server = http.createServer(async (req, res) => {
  setCommonHeaders(req, res);
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, requestUrl.pathname);
      if (!handled) json(res, 404, { error: "API không tồn tại." });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "Phương thức không được hỗ trợ." });
      return;
    }
    await serveStatic(res, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, error.statusCode || 500, { error: error.message || "Lỗi máy chủ." });
    else res.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Thầy Minh Online Judge đang chạy tại http://localhost:${port}`);
  console.log(`Runner: ${runner}; hàng đợi đồng thời: ${queue.concurrency}`);
  if (runner === "host") console.warn("CẢNH BÁO: host runner chỉ dùng để kiểm thử nội bộ, không được mở công khai.");
});

function shutdown(signal) {
  console.log(`Đang dừng máy chấm (${signal})...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
