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

test("new conversation starts a new session and aborts stale request",()=>{
  assert.match(js,/sessionVersion\+=1/);
  assert.match(js,/const c=makeConversation\(\)/);
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

test("conversation history persists in localStorage",()=>{
  assert.match(js,/tmct_ai_tutor_conversations_v1/);
  assert.match(js,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(js,/localStorage\.getItem\(STORAGE_KEY/);
  assert.match(js,/saveCurrentConversation/);
  assert.match(js,/restoreConversation/);
});

test("problem code language and hint level are restored",()=>{
  assert.match(js,/c\.prompt=String\(prompt\.value/);
  assert.match(js,/c\.language=language\.value/);
  assert.match(js,/c\.level=level\.value/);
  assert.match(js,/prompt\.value=c\.prompt/);
  assert.match(js,/language\.value=c\.language/);
  assert.match(js,/level\.value=c\.level/);
});

test("new chat preserves old conversations instead of clearing storage",()=>{
  assert.match(js,/function createNewConversation/);
  assert.match(js,/saveCurrentConversation\(false\)/);
  assert.doesNotMatch(js,/localStorage\.clear\(/);
  assert.doesNotMatch(js,/removeItem\(STORAGE_KEY\)/);
});

test("conversation sidebar is present and supports delete/open",()=>{
  assert.match(html,/id="conversationList"/);
  assert.match(html,/id="newChat"/);
  assert.match(html,/Lịch sử/);
  assert.match(js,/conversationOpen/);
  assert.match(js,/conversationDelete/);
  assert.match(js,/deleteConversation/);
});

test("images are not persisted in browser history",()=>{
  const saveStart=js.indexOf("function saveCurrentConversation");
  const saveEnd=js.indexOf("function scheduleSave",saveStart);
  const saveSrc=js.slice(saveStart,saveEnd);
  assert.doesNotMatch(saveSrc,/imageData/);
  assert.match(js,/Ảnh chỉ dùng cho phiên hiện tại và không lưu/);
});

test("stored history is bounded to protect browser quota",()=>{
  assert.match(js,/MAX_CONVERSATIONS=24/);
  assert.match(js,/MAX_STORED_TURNS=40/);
  assert.match(js,/slice\(-MAX_STORED_TURNS\)/);
});


test("programming modulo notation is normalized before KaTeX",()=>{
  const start=js.indexOf("function normalizeProgrammingMath");
  const end=js.indexOf("function normalizeBareLatex",start);
  assert.ok(start>=0&&end>start);
  const fn=(0,eval)("("+js.slice(start,end).trim()+")");
  const raw="UCLN của ( a ) và ( b ) cũng là UCLN của ( b ) và ( a \\\\pmod b ).";
  const fixed=fn(raw);
  assert.match(fixed,/\\\\\(a\\\\\)/);
  assert.match(fixed,/\\\\\(b\\\\\)/);
  assert.match(fixed,/`a % b`/);
  assert.doesNotMatch(fixed,/\\\\pmod/);
});
