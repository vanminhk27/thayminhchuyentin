import test from "node:test";
import assert from "node:assert/strict";
import worker,{parseImage,systemPrompt,toGeminiContents,extractAnswer} from "../src/index.js";

test("parseImage accepts jpeg data URL",()=>{const x=parseImage("data:image/jpeg;base64,QUJD");assert.equal(x.mimeType,"image/jpeg");assert.equal(x.data,"QUJD")});
test("parseImage rejects non-image",()=>assert.throws(()=>parseImage("data:text/plain;base64,QUJD")));
test("system prompt uses selected language and level",()=>{const p=systemPrompt("python","max");assert.match(p,/Python/);assert.match(p,/cực kỳ chi tiết/)});
test("history maps roles for Gemini",()=>{const c=toGeminiContents([{role:"user",text:"a"},{role:"model",text:"b"}],"c",null);assert.deepEqual(c.map(x=>x.role),["user","model","user"])});
test("extractAnswer joins text parts",()=>assert.equal(extractAnswer({candidates:[{content:{parts:[{text:"A"},{text:"B"}]}}]}),"AB"));
test("health endpoint works without key",async()=>{const r=await worker.fetch(new Request("https://x/health"),{GEMINI_MODEL:"gemini-3.8-flash",ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});assert.equal(r.status,200);assert.equal((await r.json()).ok,true)});
test("POST requires secret",async()=>{const r=await worker.fetch(new Request("https://x/api/ai-tutor",{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify({message:"test"})}),{ALLOWED_ORIGIN:"https://thayminhchuyentin.io.vn"});assert.equal(r.status,500)});
