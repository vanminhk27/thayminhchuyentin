import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../../docs/ai-goi-y-code.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../../docs/assets/ai-code-tutor.js",import.meta.url),"utf8");

test("student UI exposes hint modes only",()=>{
  assert.match(html,/value="hint" selected>Gợi ý nhẹ/);
  assert.match(html,/value="guide">Hướng dẫn từng bước/);
  assert.doesNotMatch(html,/value="detail"/);
  assert.doesNotMatch(html,/value="max"/);
});

test("history is visible instead of replacing one answer box",()=>{
  assert.match(html,/id="chatHistory"/);
  assert.match(html,/Lịch sử trao đổi với Trợ giảng AI/);
  assert.match(js,/appendTurn/);
  assert.match(js,/turns\.push/);
  assert.doesNotMatch(html,/id="answer"/);
});

test("reset starts a new session and aborts stale request",()=>{
  assert.match(js,/sessionVersion\+=1/);
  assert.match(js,/sessionId=newId\(\)/);
  assert.match(js,/active&&active\.controller/);
  assert.match(js,/active\.controller\.abort\(\)/);
  assert.match(js,/version!==sessionVersion/);
});

test("frontend prevents duplicate in-flight actions",()=>{
  assert.match(js,/if\(active\)/);
  assert.match(js,/setBusy\(true\)/);
  assert.match(js,/send\.disabled=flag/);
  assert.match(js,/followSend\.disabled=flag/);
});

test("request carries session request id and compact history",()=>{
  assert.match(js,/requestId/);
  assert.match(js,/sessionId/);
  assert.match(js,/history:historyBefore/);
  assert.match(js,/turns\.slice\(-6\)/);
  assert.match(js,/state:\{hintStep:tutorState\.hintStep,pendingQuestion:tutorState\.pendingQuestion\}/);
});

test("structured tutor response is rendered by field",()=>{
  assert.match(js,/response\.observation/);
  assert.match(js,/response\.hint/);
  assert.match(js,/response\.check_test/);
  assert.match(js,/response\.next_question/);
  assert.match(js,/response\.needs_clarification/);
});

test("quota and timeout errors have distinct messages",()=>{
  assert.match(js,/DAILY_QUOTA_EXHAUSTED/);
  assert.match(js,/RATE_LIMITED/);
  assert.match(js,/REQUEST_IN_PROGRESS/);
  assert.match(js,/AI_TIMEOUT/);
  assert.match(js,/data\.fallback/);
});

test("privacy notice is visible",()=>{
  assert.match(html,/Không gửi API key, mật khẩu hoặc thông tin cá nhân/);
  assert.match(html,/được gửi tới Gemini/);
});

test("Markdown math and sanitization stack is present",()=>{
  const marked=html.indexOf("marked.min.js");
  const purify=html.indexOf("purify.min.js");
  const katex=html.indexOf("katex.min.js");
  const app=html.indexOf("assets/ai-code-tutor.js");
  assert.ok(marked>=0&&purify>=0&&katex>=0&&app>=0);
  assert.ok(marked<app&&purify<app&&katex<app);
  assert.match(js,/DOMPurify\.sanitize/);
  assert.match(js,/renderMathInElement/);
  assert.match(js,/repairMalformedMath/);
});

test("math editor remains wired",()=>{
  assert.match(html,/id="openMath"/);
  assert.match(html,/id="mathDialog"/);
  assert.match(html,/<math-field id="mathField"/);
  assert.match(html,/mathlive@0\.110\.0/);
  assert.ok(html.includes('data-latex="\\frac{#?}{#?}"'));
  assert.match(js,/setupMathEditor\(\)/);
  assert.match(js,/insertFormulaIntoPrompt/);
});

test("formula insertion uses safe inline delimiters",()=>{
  const start=js.indexOf("function insertFormulaIntoPrompt");
  const end=js.indexOf("function setupMathEditor",start);
  assert.ok(start>=0&&end>start);
  const src=js.slice(start,end);
  assert.match(src,/const wrapped="\\\\\("/);
  assert.match(src,/\+"\\\\\)"/);
});

test("long code can scroll without breaking mobile width",()=>{
  assert.match(html,/overflow-x:auto/);
  assert.match(html,/white-space:pre/);
  assert.match(html,/@media\(max-width:850px\)/);
  assert.match(html,/grid-template-columns:1fr/);
});

test("frontend targets secured Worker endpoint",()=>{
  assert.match(js,/https:\/\/thayminhchuyentin\.vanminhk-27\.workers\.dev\/api\/ai-tutor/);
});

test("main prompt is not mutated with hidden user-level system rules",()=>{
  assert.doesNotMatch(js,/QUY TẮC:/);
  assert.doesNotMatch(js,/formatRule/);
});

test("follow-up sends only follow-up text, not entire original prompt again",()=>{
  assert.match(js,/ask\(q,"follow"\)/);
  assert.match(js,/message:text/);
  assert.match(js,/image:kind==="main"\?imageData:null/);
});
