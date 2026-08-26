import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DOCKER_IMAGE = process.env.JUDGE_DOCKER_IMAGE || "gcc:14-bookworm";
const MAX_OUTPUT_BYTES = 64 * 1024;
const COMPILE_TIMEOUT_MS = 15_000;

function normalizeOutput(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function limitText(value) {
  if (Buffer.byteLength(value) <= MAX_OUTPUT_BYTES) return value;
  return `${value.slice(0, MAX_OUTPUT_BYTES)}\n[Đã cắt bớt kết quả vì vượt giới hạn]`;
}

function runProcess(command, args, { cwd, input = "", timeoutMs, env, onTimeout } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    let stdout = "";
    let stderr = "";
    let outputExceeded = false;
    let timedOut = false;

    const collect = (target, chunk) => {
      const next = target + chunk.toString("utf8");
      if (Buffer.byteLength(next) > MAX_OUTPUT_BYTES) outputExceeded = true;
      return limitText(next);
    };

    child.stdout.on("data", (chunk) => { stdout = collect(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = collect(stderr, chunk); });
    child.on("error", reject);

    const timer = setTimeout(() => {
      timedOut = true;
      if (onTimeout) onTimeout();
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut, outputExceeded });
    });

    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function removeDockerContainer(name) {
  const cleanup = spawn("docker", ["rm", "-f", name], { stdio: "ignore" });
  cleanup.on("error", () => {});
  cleanup.unref();
}

function baseDockerArgs(name, memoryLimitMb) {
  return [
    "run", "--rm", "--name", name,
    "--network", "none",
    "--memory", `${memoryLimitMb}m`,
    "--memory-swap", `${memoryLimitMb}m`,
    "--cpus", "1",
    "--pids-limit", "128",
    "--security-opt", "no-new-privileges",
    "--cap-drop", "ALL"
  ];
}

async function compileWithDocker(workDir, memoryLimitMb) {
  const name = `thayminh-compile-${randomUUID().slice(0, 8)}`;
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  const args = [
    ...baseDockerArgs(name, Math.max(memoryLimitMb, 256)),
    "--user", `${uid}:${gid}`,
    "-v", `${workDir}:/workspace`,
    "-w", "/workspace",
    DOCKER_IMAGE,
    "g++", "-std=c++17", "-O2", "-pipe", "-Wall", "-Wextra",
    "main.cpp", "-o", "main"
  ];
  return runProcess("docker", args, {
    timeoutMs: COMPILE_TIMEOUT_MS,
    onTimeout: () => removeDockerContainer(name)
  });
}

async function runWithDocker(workDir, test, problem) {
  const name = `thayminh-run-${randomUUID().slice(0, 8)}`;
  const args = [
    ...baseDockerArgs(name, problem.memoryLimitMb),
    "--read-only",
    "--user", "65534:65534",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
    "-v", `${workDir}:/workspace:ro`,
    "-w", "/workspace",
    DOCKER_IMAGE,
    "/workspace/main"
  ];
  return runProcess("docker", args, {
    input: test.input,
    timeoutMs: problem.timeLimitMs,
    onTimeout: () => removeDockerContainer(name)
  });
}

async function compileOnHost(workDir) {
  return runProcess(
    "g++",
    ["-std=c++17", "-O2", "-pipe", "-Wall", "-Wextra", "main.cpp", "-o", "main"],
    { cwd: workDir, timeoutMs: COMPILE_TIMEOUT_MS }
  );
}

async function runOnHost(workDir, test, problem) {
  return runProcess(join(workDir, "main"), [], {
    cwd: workDir,
    input: test.input,
    timeoutMs: problem.timeLimitMs
  });
}

function failureDetails(test, index, run) {
  if (test.hidden) {
    return { test: index + 1, hidden: true, message: `Chưa đúng ở test ẩn số ${index + 1}.` };
  }
  return {
    test: index + 1,
    hidden: false,
    input: test.input,
    expected: test.expected,
    actual: run.stdout,
    stderr: run.stderr
  };
}

export async function judgeSubmission(problem, sourceCode, runner = process.env.JUDGE_RUNNER || "docker") {
  const startedAt = Date.now();
  const workDir = await mkdtemp(join(tmpdir(), "thayminh-judge-"));
  const compile = runner === "host" ? compileOnHost : compileWithDocker;
  const execute = runner === "host" ? runOnHost : runWithDocker;

  try {
    await writeFile(join(workDir, "main.cpp"), sourceCode, { encoding: "utf8", mode: 0o600 });
    const compilation = await compile(workDir, problem.memoryLimitMb);

    if (compilation.timedOut) {
      return { status: "Compilation Error", message: "Quá thời gian biên dịch.", compileOutput: compilation.stderr };
    }
    if (compilation.code !== 0) {
      return { status: "Compilation Error", message: "Chương trình biên dịch không thành công.", compileOutput: compilation.stderr };
    }
    await chmod(join(workDir, "main"), 0o755);

    for (let index = 0; index < problem.tests.length; index += 1) {
      const test = problem.tests[index];
      const run = await execute(workDir, test, problem);

      if (run.timedOut) {
        return {
          status: "Time Limit Exceeded",
          message: `Chương trình chạy quá ${problem.timeLimitMs} ms.`,
          failedTest: failureDetails(test, index, run),
          passedTests: index,
          totalTests: problem.tests.length
        };
      }
      if (run.outputExceeded) {
        return {
          status: "Output Limit Exceeded",
          message: "Chương trình in ra quá nhiều dữ liệu.",
          failedTest: failureDetails(test, index, run),
          passedTests: index,
          totalTests: problem.tests.length
        };
      }
      if (run.code !== 0) {
        return {
          status: "Runtime Error",
          message: "Chương trình kết thúc bất thường.",
          failedTest: failureDetails(test, index, run),
          runtimeOutput: run.stderr,
          passedTests: index,
          totalTests: problem.tests.length
        };
      }
      if (normalizeOutput(run.stdout) !== normalizeOutput(test.expected)) {
        return {
          status: "Wrong Answer",
          message: "Kết quả chưa chính xác.",
          failedTest: failureDetails(test, index, run),
          passedTests: index,
          totalTests: problem.tests.length
        };
      }
    }

    return {
      status: "Accepted",
      message: "Chúc mừng! Bài làm đã vượt qua toàn bộ test.",
      passedTests: problem.tests.length,
      totalTests: problem.tests.length,
      durationMs: Date.now() - startedAt
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function checkRunner(runner = process.env.JUDGE_RUNNER || "docker") {
  const command = runner === "host" ? "g++" : "docker";
  const args = runner === "host" ? ["--version"] : ["info", "--format", "{{.ServerVersion}}"];
  try {
    const result = await runProcess(command, args, { timeoutMs: 5000 });
    return { ready: result.code === 0, runner, detail: (result.stdout || result.stderr).trim() };
  } catch (error) {
    return { ready: false, runner, detail: error.message };
  }
}
