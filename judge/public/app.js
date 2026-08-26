const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  serverState: $("#serverState"),
  contestTimer: $("#contestTimer"),
  breadcrumbCurrent: $("#breadcrumbCurrent"),
  problemList: $("#problemList"),
  problemCode: $("#problemCode"),
  problemTitle: $("#problemTitle"),
  timeLimit: $("#timeLimit"),
  memoryLimit: $("#memoryLimit"),
  statement: $("#statement"),
  inputDescription: $("#inputDescription"),
  outputDescription: $("#outputDescription"),
  sampleInput: $("#sampleInput"),
  sampleOutput: $("#sampleOutput"),
  sourceCode: $("#sourceCode"),
  language: $("#language"),
  resetButton: $("#resetButton"),
  submitButton: $("#submitButton"),
  saveState: $("#saveState"),
  resultCard: $("#resultCard"),
  resultTitle: $("#resultTitle"),
  verdict: $("#verdict"),
  resultMessage: $("#resultMessage"),
  resultDetails: $("#resultDetails"),
  submissionRows: $("#submissionRows"),
  submissionEmpty: $("#submissionEmpty"),
  latestSubmission: $("#latestSubmission"),
  solvedCount: $("#solvedCount"),
  contestScore: $("#contestScore"),
  contestSolved: $("#contestSolved"),
  contestProgress: $("#contestProgress"),
  totalScoreTop: $("#totalScoreTop"),
  rankingTotal: $("#rankingTotal"),
  rankCells: [$("#rankA"), $("#rankB"), $("#rankC")],
  toast: $("#toast")
};

const HISTORY_KEY = "thayminh-judge-submissions-v2";
const CONTEST_START_KEY = "thayminh-judge-contest-start";
const CONTEST_DURATION_MS = 3 * 60 * 60 * 1000;
const viewNames = {
  contest: "Thông tin kỳ thi",
  problems: "Bài tập",
  submissions: "Bài nộp của tôi",
  ranking: "Bảng xếp hạng"
};

let problems = [];
let activeProblem = null;
let serverReady = false;
let saveTimer;
let toastTimer;

function codeStorageKey(problemId) {
  return `thayminh-judge-cpp17-${problemId}`;
}

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

function problemLetter(problemId) {
  const index = problems.findIndex((problem) => problem.id === problemId);
  return String.fromCharCode(65 + Math.max(index, 0));
}

function statusClass(status) {
  return status === "Accepted" ? "accepted" : "rejected";
}

function problemState(problemId, history = readHistory()) {
  const submissions = history.filter((item) => item.problemId === problemId);
  if (submissions.some((item) => item.status === "Accepted")) return "accepted";
  return submissions.length ? "attempted" : "untouched";
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(timestamp));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function showView(viewName, { scroll = true } = {}) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.dataset.view === viewName));
  $$(".main-nav [data-view-link]").forEach((button) => button.classList.toggle("active", button.dataset.viewLink === viewName));
  elements.breadcrumbCurrent.textContent = viewNames[viewName] || "Phòng thi";
  if (viewName === "submissions") renderHistory();
  if (viewName === "ranking" || viewName === "contest") updateProgress();
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function setServerState(ready, message) {
  serverReady = ready;
  elements.serverState.classList.toggle("ready", ready);
  elements.serverState.classList.toggle("error", !ready);
  elements.serverState.querySelector("span").textContent = message;
  elements.submitButton.disabled = !ready;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json();
    setServerState(response.ok && data.ready, data.ready ? "Máy chấm sẵn sàng" : "Docker chưa sẵn sàng");
  } catch {
    setServerState(false, "Mất kết nối máy chấm");
  }
}

function renderProblemList() {
  const history = readHistory();
  elements.problemList.textContent = "";
  problems.forEach((problem, index) => {
    const state = problemState(problem.id, history);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `problem-item ${state}`;
    button.classList.toggle("active", activeProblem?.id === problem.id);
    button.dataset.problemId = problem.id;

    const letter = document.createElement("span");
    letter.className = "problem-letter";
    letter.textContent = String.fromCharCode(65 + index);
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = problem.title;
    const meta = document.createElement("small");
    meta.textContent = `TM${problem.id} · 100 điểm`;
    copy.append(title, meta);
    const status = document.createElement("i");
    status.className = "problem-status";
    status.setAttribute("aria-label", state === "accepted" ? "Đã đúng" : state === "attempted" ? "Đã nộp" : "Chưa làm");
    button.append(letter, copy, status);
    button.addEventListener("click", () => selectProblem(problem.id));
    elements.problemList.append(button);
  });
}

function resetResult() {
  elements.resultCard.className = "judge-result";
  elements.verdict.className = "verdict neutral";
  elements.verdict.textContent = "CHƯA NỘP";
  elements.resultTitle.textContent = "Chưa có kết quả chấm";
  elements.resultMessage.textContent = "Sau khi nộp, kết quả sẽ hiển thị tại đây và trong mục Bài nộp.";
  elements.resultDetails.hidden = true;
  elements.resultDetails.textContent = "";
}

function selectProblem(problemId) {
  activeProblem = problems.find((problem) => problem.id === problemId);
  if (!activeProblem) return;
  const letter = problemLetter(problemId);
  elements.problemCode.textContent = `Bài ${letter} · TM${activeProblem.id}`;
  elements.problemTitle.textContent = activeProblem.title;
  elements.timeLimit.textContent = `${activeProblem.timeLimitMs} ms`;
  elements.memoryLimit.textContent = `${activeProblem.memoryLimitMb} MB`;
  elements.statement.textContent = activeProblem.statement;
  elements.inputDescription.textContent = activeProblem.input;
  elements.outputDescription.textContent = activeProblem.output;
  elements.sampleInput.textContent = activeProblem.samples[0]?.input || "";
  elements.sampleOutput.textContent = activeProblem.samples[0]?.output || "";

  const savedCode = localStorage.getItem(codeStorageKey(problemId));
  elements.sourceCode.value = savedCode || activeProblem.starterCode;
  elements.saveState.textContent = savedCode ? "Đã khôi phục mã nguồn đã lưu" : "Đang dùng mã nguồn mẫu";
  resetResult();
  renderProblemList();
  showView("problems", { scroll: false });
}

function formatDetails(result) {
  if (result.compileOutput) return result.compileOutput;
  if (result.runtimeOutput) return result.runtimeOutput;
  if (!result.failedTest) return "";
  if (result.failedTest.hidden) return result.failedTest.message;
  return [
    `Test: ${result.failedTest.test}`,
    `Input:\n${result.failedTest.input}`,
    `Kết quả đúng:\n${result.failedTest.expected}`,
    `Kết quả của em:\n${result.failedTest.actual || "(không có dữ liệu)"}`
  ].join("\n\n");
}

function renderJudgeResult(result) {
  const accepted = result.status === "Accepted";
  const passed = result.passedTests || 0;
  const total = result.totalTests || 0;
  elements.resultCard.className = `judge-result ${accepted ? "accepted" : "rejected"}`;
  elements.verdict.className = `verdict ${statusClass(result.status)}`;
  elements.verdict.textContent = result.status.toUpperCase();
  elements.resultTitle.textContent = accepted ? "Bài làm chính xác" : "Bài làm chưa đạt";
  elements.resultMessage.textContent = total ? `${result.message} Đã qua ${passed}/${total} test.` : result.message;
  const details = formatDetails(result);
  elements.resultDetails.textContent = details;
  elements.resultDetails.hidden = !details;
}

function saveSubmission(apiResponse) {
  const result = apiResponse.result;
  const history = readHistory();
  history.unshift({
    id: apiResponse.submissionId.slice(0, 8),
    createdAt: Date.now(),
    problemId: activeProblem.id,
    problemTitle: activeProblem.title,
    language: "GNU C++17",
    status: result.status,
    passedTests: result.passedTests || 0,
    totalTests: result.totalTests || 0,
    score: result.status === "Accepted" ? 100 : 0
  });
  writeHistory(history);
  renderHistory();
  renderProblemList();
  updateProgress();
  renderLatestSubmission();
}

async function submitCode() {
  if (!activeProblem || !elements.sourceCode.value.trim() || !serverReady) return;
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Đang chấm...";
  elements.resultCard.className = "judge-result";
  elements.verdict.className = "verdict judging";
  elements.verdict.textContent = "ĐANG CHẤM";
  elements.resultTitle.textContent = `Đang chấm bài ${problemLetter(activeProblem.id)}`;
  elements.resultMessage.textContent = "Hệ thống đang biên dịch và chạy bộ test. Vui lòng chờ.";
  elements.resultDetails.hidden = true;
  localStorage.setItem(codeStorageKey(activeProblem.id), elements.sourceCode.value);

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: activeProblem.id, language: "cpp17", sourceCode: elements.sourceCode.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không thể chấm bài.");
    renderJudgeResult(data.result);
    saveSubmission(data);
    showToast(data.result.status === "Accepted" ? "Chúc mừng! Bài làm đã được chấp nhận." : `Kết quả: ${data.result.status}`);
  } catch (error) {
    elements.resultCard.className = "judge-result rejected";
    elements.verdict.className = "verdict rejected";
    elements.verdict.textContent = "LỖI HỆ THỐNG";
    elements.resultTitle.textContent = "Không thể chấm bài";
    elements.resultMessage.textContent = error.message;
  } finally {
    elements.submitButton.disabled = !serverReady;
    elements.submitButton.textContent = "Nộp bài";
  }
}

function renderHistory() {
  const history = readHistory();
  elements.submissionRows.textContent = "";
  elements.submissionEmpty.hidden = history.length > 0;
  history.forEach((item) => {
    const row = document.createElement("tr");
    const values = [
      `#${item.id}`,
      formatTime(item.createdAt),
      `${problemLetter(item.problemId)}. ${item.problemTitle}`,
      item.language,
      item.status,
      item.totalTests ? `${item.passedTests}/${item.totalTests}` : "—",
      String(item.score)
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 2) cell.className = "submission-problem";
      if (index === 4) cell.className = `submission-verdict ${statusClass(item.status)}`;
      row.append(cell);
    });
    elements.submissionRows.append(row);
  });
}

function renderLatestSubmission() {
  const latest = readHistory()[0];
  elements.latestSubmission.textContent = "";
  if (!latest) {
    const empty = document.createElement("p");
    empty.textContent = "Chưa có bài nộp.";
    elements.latestSubmission.append(empty);
    return;
  }
  const box = document.createElement("div");
  box.className = "latest-result";
  const title = document.createElement("strong");
  title.textContent = `${problemLetter(latest.problemId)}. ${latest.problemTitle}`;
  const verdict = document.createElement("span");
  verdict.className = `submission-verdict ${statusClass(latest.status)}`;
  verdict.textContent = latest.status;
  const time = document.createElement("small");
  time.textContent = formatTime(latest.createdAt);
  box.append(title, verdict, time);
  elements.latestSubmission.append(box);
}

function updateProgress() {
  const history = readHistory();
  const acceptedIds = new Set(history.filter((item) => item.status === "Accepted").map((item) => item.problemId));
  const score = acceptedIds.size * 100;
  elements.solvedCount.textContent = `${acceptedIds.size}/${problems.length || 3} AC`;
  elements.contestScore.textContent = score;
  elements.contestSolved.textContent = `Đã giải ${acceptedIds.size}/${problems.length || 3} bài`;
  elements.contestProgress.style.width = `${(acceptedIds.size / Math.max(problems.length, 3)) * 100}%`;
  elements.totalScoreTop.textContent = `${score} / 300`;
  elements.rankingTotal.textContent = score;
  elements.rankCells.forEach((cell, index) => {
    const problem = problems[index];
    if (!problem) return;
    const state = problemState(problem.id, history);
    cell.textContent = state === "accepted" ? "100" : state === "attempted" ? "0" : "—";
    cell.className = state === "accepted" ? "submission-verdict accepted" : state === "attempted" ? "submission-verdict rejected" : "";
  });
}

function startTimer() {
  let startedAt = Number(localStorage.getItem(CONTEST_START_KEY));
  const now = Date.now();
  if (!startedAt || now - startedAt >= CONTEST_DURATION_MS) {
    startedAt = now;
    localStorage.setItem(CONTEST_START_KEY, String(startedAt));
  }
  const tick = () => {
    const remaining = Math.max(0, CONTEST_DURATION_MS - (Date.now() - startedAt));
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    elements.contestTimer.textContent = `${hours}:${minutes}:${seconds}`;
  };
  tick();
  setInterval(tick, 1000);
}

elements.sourceCode.addEventListener("input", () => {
  if (!activeProblem) return;
  elements.saveState.textContent = "Đang lưu mã nguồn...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(codeStorageKey(activeProblem.id), elements.sourceCode.value);
    elements.saveState.textContent = "Đã tự động lưu trên trình duyệt";
  }, 350);
});

elements.resetButton.addEventListener("click", () => {
  if (!activeProblem || !confirm("Khôi phục mã nguồn mẫu của bài này?")) return;
  localStorage.removeItem(codeStorageKey(activeProblem.id));
  elements.sourceCode.value = activeProblem.starterCode;
  elements.saveState.textContent = "Đã khôi phục mã nguồn mẫu";
  resetResult();
});

elements.submitButton.addEventListener("click", submitCode);

$$('[data-view-link]').forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    showView(control.dataset.viewLink);
  });
});

$$('[data-scroll-target]').forEach((control) => {
  control.addEventListener("click", () => {
    $$(".problem-tabs [data-scroll-target]").forEach((button) => button.classList.toggle("active", button === control));
    document.getElementById(control.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

async function init() {
  startTimer();
  renderHistory();
  renderLatestSubmission();
  await checkHealth();
  try {
    const response = await fetch("/api/problems", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được danh sách bài.");
    problems = data.problems;
    activeProblem = problems[0] || null;
    renderProblemList();
    if (activeProblem) selectProblem(activeProblem.id);
    updateProgress();
  } catch (error) {
    elements.problemTitle.textContent = "Không tải được đề bài";
    elements.statement.textContent = error.message;
  }
}

init();
