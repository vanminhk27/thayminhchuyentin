const elements = {
  serverState: document.querySelector("#serverState"),
  problemList: document.querySelector("#problemList"),
  problemNumber: document.querySelector("#problemNumber"),
  problemTitle: document.querySelector("#problemTitle"),
  difficulty: document.querySelector("#difficulty"),
  timeLimit: document.querySelector("#timeLimit"),
  memoryLimit: document.querySelector("#memoryLimit"),
  statement: document.querySelector("#statement"),
  inputDescription: document.querySelector("#inputDescription"),
  outputDescription: document.querySelector("#outputDescription"),
  sampleInput: document.querySelector("#sampleInput"),
  sampleOutput: document.querySelector("#sampleOutput"),
  sourceCode: document.querySelector("#sourceCode"),
  resetButton: document.querySelector("#resetButton"),
  submitButton: document.querySelector("#submitButton"),
  saveState: document.querySelector("#saveState"),
  resultCard: document.querySelector("#resultCard"),
  resultTitle: document.querySelector("#resultTitle"),
  verdict: document.querySelector("#verdict"),
  resultMessage: document.querySelector("#resultMessage"),
  progress: document.querySelector("#progress"),
  progressBar: document.querySelector("#progressBar"),
  resultDetails: document.querySelector("#resultDetails")
};

let problems = [];
let activeProblem = null;
let saveTimer;

function storageKey(problemId) {
  return `thayminh-judge-cpp17-${problemId}`;
}

function verdictClass(status) {
  if (status === "Accepted") return "accepted";
  if (["Wrong Answer", "Compilation Error", "Runtime Error", "Time Limit Exceeded", "Output Limit Exceeded"].includes(status)) return "rejected";
  return "neutral";
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
  ].join("\n");
}

function setServerState(ready, text) {
  elements.serverState.classList.toggle("ready", ready);
  elements.serverState.classList.toggle("error", !ready);
  elements.serverState.lastElementChild.textContent = text;
  elements.submitButton.disabled = !ready;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json();
    setServerState(response.ok && data.ready, data.ready ? "Máy chấm đang hoạt động" : "Docker chưa sẵn sàng");
  } catch {
    setServerState(false, "Không kết nối được máy chấm");
  }
}

function renderProblemList() {
  elements.problemList.innerHTML = "";
  for (const problem of problems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "problem-item";
    button.dataset.problemId = problem.id;
    button.innerHTML = `<span class="problem-id">#${problem.id}</span><span><strong>${problem.title}</strong><small>${problem.difficulty}</small></span>`;
    button.addEventListener("click", () => selectProblem(problem.id));
    elements.problemList.append(button);
  }
}

function selectProblem(problemId) {
  activeProblem = problems.find((problem) => problem.id === problemId);
  if (!activeProblem) return;

  document.querySelectorAll(".problem-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.problemId === problemId);
  });
  elements.problemNumber.textContent = `BÀI #${activeProblem.id}`;
  elements.problemTitle.textContent = activeProblem.title;
  elements.difficulty.textContent = activeProblem.difficulty;
  elements.timeLimit.textContent = `${activeProblem.timeLimitMs} ms`;
  elements.memoryLimit.textContent = `${activeProblem.memoryLimitMb} MB`;
  elements.statement.textContent = activeProblem.statement;
  elements.inputDescription.textContent = activeProblem.input;
  elements.outputDescription.textContent = activeProblem.output;
  elements.sampleInput.textContent = activeProblem.samples[0]?.input || "";
  elements.sampleOutput.textContent = activeProblem.samples[0]?.output || "";
  elements.sourceCode.value = localStorage.getItem(storageKey(problemId)) || activeProblem.starterCode;
  elements.saveState.textContent = localStorage.getItem(storageKey(problemId)) ? "Đã khôi phục mã nguồn đã lưu" : "Đang dùng mã nguồn mẫu";
  resetResult();
}

function resetResult() {
  elements.resultTitle.textContent = "Chưa có bài nộp";
  elements.verdict.textContent = "SẴN SÀNG";
  elements.verdict.className = "verdict neutral";
  elements.resultMessage.textContent = "Nhập mã nguồn và bấm “Nộp bài chấm test”.";
  elements.progress.hidden = true;
  elements.resultDetails.hidden = true;
  elements.resultDetails.textContent = "";
}

async function submitCode() {
  if (!activeProblem || !elements.sourceCode.value.trim()) return;
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Đang chấm...";
  elements.resultTitle.textContent = `Đang chấm bài #${activeProblem.id}`;
  elements.verdict.textContent = "ĐANG CHẤM";
  elements.verdict.className = "verdict judging";
  elements.resultMessage.textContent = "Hệ thống đang biên dịch và chạy các test. Vui lòng không đóng trang.";
  elements.progress.hidden = false;
  elements.progressBar.style.width = "35%";
  elements.resultDetails.hidden = true;
  localStorage.setItem(storageKey(activeProblem.id), elements.sourceCode.value);

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: activeProblem.id,
        language: "cpp17",
        sourceCode: elements.sourceCode.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không thể chấm bài.");

    const result = data.result;
    const passed = result.passedTests || 0;
    const total = result.totalTests || activeProblem.samples.length;
    elements.progressBar.style.width = `${Math.round((passed / Math.max(total, 1)) * 100)}%`;
    elements.resultTitle.textContent = result.status === "Accepted" ? "Bài làm chính xác" : "Bài làm chưa đạt";
    elements.verdict.textContent = result.status.toUpperCase();
    elements.verdict.className = `verdict ${verdictClass(result.status)}`;
    elements.resultMessage.textContent = `${result.message} Đã qua ${passed}/${total} test.`;
    const details = formatDetails(result);
    if (details) {
      elements.resultDetails.textContent = details;
      elements.resultDetails.hidden = false;
    }
  } catch (error) {
    elements.progress.hidden = true;
    elements.resultTitle.textContent = "Không thể chấm bài";
    elements.verdict.textContent = "LỖI HỆ THỐNG";
    elements.verdict.className = "verdict rejected";
    elements.resultMessage.textContent = error.message;
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "▶ Nộp bài chấm test";
  }
}

elements.sourceCode.addEventListener("input", () => {
  if (!activeProblem) return;
  elements.saveState.textContent = "Đang lưu...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(storageKey(activeProblem.id), elements.sourceCode.value);
    elements.saveState.textContent = "Đã tự động lưu trên trình duyệt";
  }, 350);
});

elements.resetButton.addEventListener("click", () => {
  if (!activeProblem || !confirm("Khôi phục mã nguồn mẫu của bài này?")) return;
  localStorage.removeItem(storageKey(activeProblem.id));
  elements.sourceCode.value = activeProblem.starterCode;
  elements.saveState.textContent = "Đã khôi phục mã nguồn mẫu";
  resetResult();
});

elements.submitButton.addEventListener("click", submitCode);

async function init() {
  await checkHealth();
  try {
    const response = await fetch("/api/problems");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không tải được bài tập.");
    problems = data.problems;
    renderProblemList();
    selectProblem(problems[0]?.id);
  } catch (error) {
    elements.problemTitle.textContent = "Không tải được danh sách bài tập";
    elements.statement.textContent = error.message;
  }
}

init();
