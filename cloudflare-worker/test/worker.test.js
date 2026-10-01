import test from "node:test";
import assert from "node:assert/strict";
import worker,{parseImage,systemPrompt,toGeminiContents,extractAnswer,selectModel,isAllowedOrigin,normalizeLevel,violatesTutorPolicy} from "../src/index.js";

test("parseImage accepts jpeg data URL",()=>{const x=parseImage("data:image/jpeg;base64,QUJD");assert.equal(x.mimeType,"image/jpeg");assert.equal(x.data,"QUJD")});
test("parseImage rejects non-image",()=>assert.throws(()=>parseImage("data:text/plain;base64,QUJD")));
test("system prompt uses selected language and level",()=>{const p=systemPrompt("python","guide");assert.match(p,/Python/);assert.match(p,/Hướng dẫn từng bước/);assert.match(p,/không phải máy giải bài/)});
test("history maps roles for Gemini",()=>{const c=toGeminiContents([{role:"user",text:"a"},{role:"model",text:"b"}],"c",null);assert.deepEqual(c.map(x=>x.role),["user","model","user"])});
test("extractAnswer joins text parts",()=>assert.equal(extractAnswer({candidates:[{content:{parts:[{text:"A"},{text:"B"}]}}]}),"AB"));
test("health endpoint works without key",async()=>{const r=await worker.fetch(new Request("https://x/health"),{GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});assert.equal(r.status,200);assert.equal((await r.json()).ok,true)});
test("POST requires secret",async()=>{const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify({message:"test"})}),{ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});assert.equal(r.status,500)});

test("POST success returns Gemini answer",async()=>{const oldFetch=globalThis.fetch;globalThis.fetch=async(url,opts)=>{assert.match(String(url),/gemini-3\.8-flash:generateContent/);assert.equal(opts.headers["x-goog-api-key"],"secret");const body=JSON.parse(opts.body);assert.equal(body.contents.at(-1).role,"user");return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Phân tích thành công"}]}}]}),{status:200,headers:{"content-type":"application/json"}})};try{const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify({message:"Bài toán",language:"python",level:"max"})}),{GEMINI_API_KEY:"secret",GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});assert.equal(r.status,200);assert.equal((await r.json()).answer,"Phân tích thành công")}finally{globalThis.fetch=oldFetch}});

test("invalid GEMINI_MODEL can never leak through health",()=>{assert.equal(selectModel("AIza-not-a-model"),"gemini-3.8-flash")});

test("falls back when primary model is overloaded",async()=>{
  const oldFetch=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async(url)=>{
    seen.push(String(url));
    if(String(url).includes("gemini-3.8-flash")) return new Response(JSON.stringify({error:{message:"high demand"}}),{status:503,headers:{"content-type":"application/json"}});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"fallback ok"}]}}]}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify({message:"test",language:"python",level:"hint"})}),{GEMINI_API_KEY:"secret",GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});
    const data=await r.json();
    assert.equal(r.status,200);
    assert.equal(data.model,"gemini-3.5-flash-lite");
    assert.equal(data.fallback,true);
    assert.ok(seen.length>=2);
  }finally{globalThis.fetch=oldFetch}
});

test("CORS accepts production origin variants",()=>{
  assert.equal(isAllowedOrigin("https://thayminhchuyentin.io.vn","https://thayminhchuyentin.io.vn/"),true);
  assert.equal(isAllowedOrigin("https://www.thayminhchuyentin.io.vn","https://thayminhchuyentin.io.vn/"),true);
  assert.equal(isAllowedOrigin("https://evil.example","https://thayminhchuyentin.io.vn/"),false);
});
test("OPTIONS returns matching production CORS origin",async()=>{
  const origin="https://thayminhchuyentin.io.vn";
  const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"OPTIONS",headers:{Origin:origin}}),{ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn/"});
  assert.equal(r.status,204);
  assert.equal(r.headers.get("access-control-allow-origin"),origin);
});

test("selectModel accepts stable Flash-Lite fallbacks",()=>{assert.equal(selectModel("gemini-3.5-flash-lite"),"gemini-3.5-flash-lite");assert.equal(selectModel("gemini-3.1-flash-lite"),"gemini-3.1-flash-lite")});

test("student levels can never request full-solution mode",()=>{
  assert.equal(normalizeLevel("hint"),"hint");
  assert.equal(normalizeLevel("guide"),"guide");
  assert.equal(normalizeLevel("detail"),"guide");
  assert.equal(normalizeLevel("max"),"guide");
});

test("guide prompt explicitly forbids full solutions",()=>{
  const p=systemPrompt("python","guide");
  assert.match(p,/TUYỆT ĐỐI KHÔNG đưa lời giải hoàn chỉnh/);
  assert.match(p,/MỘT bước mỗi lượt/);
  assert.doesNotMatch(p,/code hoàn chỉnh nhưng phải giải thích/);
});

test("policy detector catches full code but allows normal hints",()=>{
  assert.equal(violatesTutorPolicy("Gợi ý: em thử xem constraints trước."),false);
  assert.equal(violatesTutorPolicy("Đây là code hoàn chỉnh\n\`\`\`python\nprint(1)\n\`\`\`"),true);
  assert.equal(violatesTutorPolicy("#include <bits/stdc++.h>\nint main(){}"),true);
});

test("worker rewrites accidental full solution into a hint",async()=>{
  const oldFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1){
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Đây là code hoàn chỉnh:\n\`\`\`python\nprint(42)\n\`\`\`"}]}}]}),{status:200,headers:{"content-type":"application/json"}});
    }
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Gợi ý: em thử xác định dữ liệu đầu vào và tự hỏi kết quả cần phụ thuộc vào đại lượng nào. Em thử viết nhận xét đó trước nhé."}]}}]}),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify({message:"Giải luôn và cho code",language:"python",level:"guide"})}),{GEMINI_API_KEY:"secret",GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});
    const data=await r.json();
    assert.equal(r.status,200);
    assert.equal(data.rewritten,true);
    assert.equal(data.level,"guide");
    assert.equal(violatesTutorPolicy(data.answer),false);
    assert.ok(calls>=2);
  }finally{globalThis.fetch=oldFetch}
});
