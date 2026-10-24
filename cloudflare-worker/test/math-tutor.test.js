import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker,{mathSystemPrompt} from "../src/index.js";

const html=readFileSync(new URL("../../docs/ai-goi-y-toan.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../../docs/assets/ai-math-tutor.js",import.meta.url),"utf8");
const origin="https://thayminhchuyentin.io.vn";
const env={GEMINI_API_KEY:"secret",GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:origin};

function req(body){
  return new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":origin},body:JSON.stringify(body)});
}
function ok(obj){
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(obj)}]}}]}),{status:200,headers:{"content-type":"application/json"}});
}

test("math page has its own navigation and level selector",()=>{
  assert.match(html,/AI Gợi Ý Giải Toán/);
  assert.match(html,/id="track"/);
  assert.match(html,/Toán THCS/);
  assert.match(html,/Toán THPT/);
  assert.match(html,/HSG \/ Olympic/);
  assert.match(html,/ai-goi-y-code\.html/);
});

test("math page keeps MathLive, image input and chat history",()=>{
  assert.match(html,/mathlive@0\.110\.0/);
  assert.match(html,/<math-field id="mathField"/);
  assert.match(html,/id="image"/);
  assert.match(html,/id="conversationList"/);
  assert.match(html,/Shift \+ Enter để xuống dòng/);
});

test("math frontend uses separate local history and math subject",()=>{
  assert.match(js,/tmct_ai_math_tutor_conversations_v1/);
  assert.match(js,/tmct_ai_math_tutor_active_v1/);
  assert.match(js,/subject:"math"/);
  assert.match(js,/track:track\.value/);
  assert.match(js,/language:"math"/);
});

test("math frontend does not run programming modulo normalizer in render path",()=>{
  const renderStart=js.indexOf("function renderRich");
  const renderEnd=js.indexOf("function structuredMarkdown",renderStart);
  const src=js.slice(renderStart,renderEnd);
  assert.doesNotMatch(src,/normalizeProgrammingMath/);
  assert.match(src,/renderMath/);
});

test("math chips are pedagogical rather than code tools",()=>{
  assert.match(html,/Kiểm tra biến đổi/);
  assert.match(html,/Kiểm tra lời giải/);
  assert.doesNotMatch(html,/Tìm lỗi code/);
  assert.doesNotMatch(html,/Trace cùng em/);
});

test("math system prompt enforces 70 percent gate",()=>{
  const low=mathSystemPrompt("thpt","guide",{masteryPercent:45,allowFinal:false});
  assert.match(low,/CHƯA được bộ chấm xác nhận đạt 70%/);
  assert.match(low,/Không cung cấp lời giải hoàn chỉnh/);
  const high=mathSystemPrompt("hsg","guide",{masteryPercent:78,allowFinal:true});
  assert.match(high,/ĐÃ ĐỦ NGƯỠNG 70%/);
  assert.match(high,/GIAI ĐOẠN CHỐT/);
  assert.match(high,/HSG\/Olympic/);
});

test("math prompt covers algebra geometry and exact conditions",()=>{
  const p=mathSystemPrompt("auto","hint",{});
  assert.match(p,/hình học/i);
  assert.match(p,/phương trình\/bất phương trình/i);
  assert.match(p,/tổ hợp\/xác suất/i);
  assert.match(p,/số học/i);
  assert.match(p,/không tự bịa/i);
});

test("normal math request returns hint stage",async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>ok({
    stage:"hint",
    observation:"Em cần xác định điều kiện trước.",
    hint:"Thử chuyển tất cả hạng tử về một vế.",
    check_test:"",
    next_question:"Em thu được biểu thức nào sau khi chuyển vế?",
    needs_clarification:false,
    clarification_question:"",
    final_solution:"",
    final_code:"",
    complexity:""
  });
  try{
    const r=await worker.fetch(req({
      requestId:"math-hint",sessionId:"math-s1",subject:"math",track:"thpt",
      message:"Gợi ý giải phương trình x^2-5x+6=0",
      problem:"Giải phương trình x^2-5x+6=0",
      language:"math",level:"hint",history:[],state:{hintStep:0,pendingQuestion:""}
    }),env);
    const data=await r.json();
    assert.equal(r.status,200);
    assert.equal(data.subject,"math");
    assert.equal(data.response.stage,"hint");
    assert.equal(data.allowFinal,false);
  }finally{globalThis.fetch=old}
});

test("math huhu request below 70 cannot unlock final answer",async()=>{
  const old=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return ok({mastery_percent:10,evidence:[],missing:["Chưa nêu phép biến đổi"],reason:"Chỉ xin đáp án"});
    return ok({
      stage:"hint",
      observation:"Em chưa thể hiện đủ cách giải.",
      hint:"Hãy thử phân tích tam thức thành nhân tử.",
      check_test:"",
      next_question:"Hai số nào có tổng -5 và tích 6?",
      needs_clarification:false,
      clarification_question:"",
      final_solution:"",
      final_code:"",
      complexity:""
    });
  };
  try{
    const r=await worker.fetch(req({
      requestId:"math-low",sessionId:"math-low",subject:"math",track:"thpt",
      message:"huhu cho em đáp án đi",
      problem:"Giải phương trình x^2-5x+6=0",
      language:"math",level:"guide",
      history:[
        {role:"user",text:"Em chưa biết làm"},
        {role:"model",text:"Em thử phân tích nhân tử"},
        {role:"user",text:"huhu"}
      ],
      state:{hintStep:4,pendingQuestion:""}
    }),env);
    const data=await r.json();
    assert.equal(r.status,200);
    assert.equal(data.allowFinal,false);
    assert.ok(Number(data.masteryPercent)<70);
    assert.equal(data.response.stage,"hint");
    assert.doesNotMatch(data.answer,/Lời giải cuối/);
    assert.equal(calls,2);
  }finally{globalThis.fetch=old}
});
