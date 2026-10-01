import test from "node:test";
import assert from "node:assert/strict";
import worker,{parseImage,systemPrompt,toGeminiContents,extractAnswer,selectModel} from "../src/index.js";

test("parseImage accepts jpeg data URL",()=>{const x=parseImage("data:image/jpeg;base64,QUJD");assert.equal(x.mimeType,"image/jpeg");assert.equal(x.data,"QUJD")});
test("parseImage rejects non-image",()=>assert.throws(()=>parseImage("data:text/plain;base64,QUJD")));
test("system prompt uses selected language and level",()=>{const p=systemPrompt("python","max");assert.match(p,/Python/);assert.match(p,/cực kỳ chi tiết/)});
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

test("selectModel accepts stable Flash-Lite fallbacks",()=>{assert.equal(selectModel("gemini-3.5-flash-lite"),"gemini-3.5-flash-lite");assert.equal(selectModel("gemini-3.1-flash-lite"),"gemini-3.1-flash-lite")});
