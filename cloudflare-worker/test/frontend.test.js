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
