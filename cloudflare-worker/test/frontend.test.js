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
  assert.doesNotMatch(html,/Giải cực kỳ chi tiết/);
});

test("UI wording is hint-first",()=>{
  assert.match(html,/Nhận gợi ý từ AI/);
  assert.match(html,/AI sẽ chỉ gợi ý từng bước/);
  assert.match(js,/Đây là chatbot GỢI Ý/);
  assert.match(js,/Không đưa lời giải\/code\/pseudocode hoàn chỉnh/);
});

test("Markdown and math render stack is present",()=>{
  const marked=html.indexOf("marked.min.js");
  const purify=html.indexOf("purify.min.js");
  const katex=html.indexOf("katex.min.js");
  const app=html.indexOf("assets/ai-code-tutor.js");
  assert.ok(marked>=0&&purify>=0&&katex>=0&&app>=0);
  assert.ok(marked<app&&purify<app&&katex<app);
  assert.match(js,/left:"\$\$".*right:"\$\$"/s);
  assert.match(js,/left:"\$".*right:"\$"/s);
  assert.match(js,/renderMathInElement/);
});

test("successful answers use rich renderer, not raw text",()=>{
  assert.match(js,/renderAnswer\(out\)/);
  assert.doesNotMatch(js,/answer\.textContent=out/);
  assert.match(js,/normalizeTutorMarkdown/);
  assert.match(js,/normalizeBareLatex/);
});

test("frontend targets secured Worker endpoint",()=>{
  assert.match(js,/https:\/\/thayminhchuyentin\.vanminhk-27\.workers\.dev\/api\/ai-tutor/);
});

test("repairs nested display and inline math from tutor output",()=>{
  const start=js.indexOf("function repairMalformedMath");
  const end=js.indexOf("function normalizeBareLatex",start);
  assert.ok(start>=0&&end>start);
  const fnSource=js.slice(start,end).trim();
  const repair=(0,eval)("("+fnSource+")");
  const bad="$$Để tính tích $P = 1 \\times 2 \\times 3 \\times \\dots \\times n$ bằng lập trình, ý tưởng cơ bản là dùng biến tích lũy.$$";
  const fixed=repair(bad);
  assert.equal(fixed,"Để tính tích $P = 1 \\times 2 \\times 3 \\times \\dots \\times n$ bằng lập trình, ý tưởng cơ bản là dùng biến tích lũy.");
  assert.doesNotMatch(fixed,/^\$\$/);
  assert.match(fixed,/\$P = 1 \\times 2/);
});

test("frontend prompt forbids nested math delimiters",()=>{
  assert.match(js,/công thức trong dòng phải dùng/);
  assert.match(js,/Không lồng các delimiter toán vào nhau/);
  assert.match(js,/repairMalformedMath/);
});

test("visual math editor is wired",()=>{
  assert.match(html,/id="openMath"/);
  assert.match(html,/id="mathDialog"/);
  assert.match(html,/<math-field id="mathField"/);
  assert.match(html,/mathlive@0\.110\.0/);
  assert.match(html,/data-latex="\\frac\{#\?\}\{#\?\}"/);
  assert.match(js,/setupMathEditor\(\)/);
  assert.match(js,/insertFormulaIntoPrompt/);
});

test("MathLive loads before tutor application",()=>{
  const mathlive=html.indexOf("mathlive@0.110.0");
  const app=html.indexOf("assets/ai-code-tutor.js");
  assert.ok(mathlive>=0&&app>=0&&mathlive<app);
});

test("formula insertion uses safe inline math delimiters",()=>{
  const start=js.indexOf("function insertFormulaIntoPrompt");
  const end=js.indexOf("function setupMathEditor",start);
  assert.ok(start>=0&&end>start);
  const src=js.slice(start,end);
  assert.match(src,/const wrapped="\\\\\("/);
  assert.match(src,/\+"\\\\\)"|value\+"\\\\\)"/);
});
