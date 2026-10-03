import {readFileSync} from "node:fs";

const suite=JSON.parse(readFileSync(new URL("../test/regression-cases.json",import.meta.url),"utf8"));
const endpoint=process.env.AI_TUTOR_URL;
if(!endpoint)throw new Error("Set AI_TUTOR_URL to a preview/staging /api/ai-tutor endpoint.");
const requested=(process.env.CASE_IDS||"").split(",").map(x=>x.trim()).filter(Boolean);
const selected=suite.cases.filter(c=>c.kind==="content"&&(!requested.length||requested.includes(c.id)));
const sessions=new Map();
const results=[];

for(const c of selected){
  const sessionId=c.followUpOf?(sessions.get(c.followUpOf)||("reg-"+c.followUpOf.toLowerCase())):("reg-"+c.id.toLowerCase());
  sessions.set(c.id,sessionId);
  const history=[];
  if(c.followUpOf){
    const prev=results.find(r=>r.id===c.followUpOf);
    const prevCase=suite.cases.find(x=>x.id===c.followUpOf);
    if(prev&&prevCase){
      history.push({role:"user",text:prevCase.input.replace(/\\n/g,"\n")});
      history.push({role:"model",text:prev.answer||""});
    }
  }
  const body={
    requestId:c.id+"-"+Date.now(),
    sessionId,
    message:c.input.replace(/\\n/g,"\n"),
    language:c.language,
    level:c.level,
    history,
    state:{hintStep:c.followUpOf?1:0,pendingQuestion:""}
  };
  const started=Date.now();
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","Origin":"https://thayminhchuyentin.io.vn"},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  const answer=String(data.answer||"");
  const forbidden=/```|\bcode hoàn chỉnh\b|(^|\n)\s*(?:def\s+\w+\s*\(|#include\s*<|int\s+main\s*\()/im;
  results.push({
    id:c.id,status:r.status,ms:Date.now()-started,model:data.model||null,promptVersion:data.promptVersion||null,
    answer,policyLeak:forbidden.test(answer),response:data.response||null,error:data.error||null
  });
}

console.log(JSON.stringify({ran:results.length,results},null,2));
if(results.some(r=>r.status!==200||r.policyLeak))process.exitCode=1;
