(()=>{"use strict";
const $=id=>document.getElementById(id);
const prompt=$("prompt"),image=$("image"),preview=$("preview"),chat=$("chatHistory"),status=$("status");
const send=$("send"),follow=$("follow"),followText=$("followText"),followSend=$("followSend"),clearBtn=$("clear");
let imageData=null;
let turns=[];
let sessionId=newId();
let sessionVersion=0;
let requestSeq=0;
let active=null;
let tutorState={hintStep:0,pendingQuestion:""};

function newId(){
  if(globalThis.crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID();
  return "s-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function normalizeTutorMarkdown(input){
  let text=String(input==null?"":input).replace(/\r\n?/g,"\n").trim();
  let lines=text.split("\n");
  const fence=String.fromCharCode(96).repeat(3);
  if(lines.length>=2&&lines[0].trim().startsWith(fence)&&lines[lines.length-1].trim()===fence)lines=lines.slice(1,-1);
  const nonEmpty=lines.filter(line=>line.trim());
  const heavilyIndented=nonEmpty.filter(line=>/^(?: {4}|\t)/.test(line)).length;
  if(nonEmpty.length>=3&&heavilyIndented/nonEmpty.length>=0.6){
    lines=lines.map(line=>line.startsWith("\t")?line.slice(1):line.replace(/^ {4}/,""));
  }
  return lines.join("\n").trim();
}
function repairMalformedMath(text){
  return String(text==null?"":text).split("\n").map(line=>{
    const m=line.match(/^(\s*)\$\$([\s\S]*?)\$\$(\s*)$/);
    if(!m)return line;
    const inner=m[2].trim();
    const singleDollarCount=(inner.match(/(?<!\\)\$/g)||[]).length;
    const prose=/[À-ỹ]/u.test(inner)&&/\b(?:để|tính|bằng|lập trình|ý tưởng|ta|em|với|là|nên|thì|trước khi|hãy)\b/i.test(inner);
    return singleDollarCount>=2||prose?m[1]+inner+m[3]:line;
  }).join("\n");
}
function normalizeBareLatex(text){
  return String(text==null?"":text).split("\n").map(line=>{
    const t=line.trim();
    if(!t||/(\$\$|\\\[|\\\]|\\\(|\\\))/.test(t))return line;
    const hasLatex=/\\(?:frac|dfrac|tfrac|times|cdot|dots|ldots|cdots|sqrt|sum|prod|lim|log|ln|sin|cos|tan|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|Rightarrow|rightarrow|leftarrow|text|mathrm|mathbf|mathbb|left|right|begin|end)\b/.test(t);
    const looksFormula=/=/.test(t)||/^[A-Za-z]\s*[=<>]/.test(t)||/^\\(?:frac|dfrac|tfrac|sqrt|sum|prod|lim)\b/.test(t);
    const proseWords=(t.match(/[A-Za-zÀ-ỹ]+/gu)||[]).length;
    if(hasLatex&&looksFormula&&!(proseWords>=6&&/[À-ỹ]/u.test(t))){
      const pad=(line.match(/^\s*/)||[""])[0];
      return pad+"\\["+t+"\\]";
    }
    return line;
  }).join("\n");
}
function renderMath(target){
  if(!window.renderMathInElement)return;
  renderMathInElement(target,{
    delimiters:[
      {left:"\\[",right:"\\]",display:true},
      {left:"\\(",right:"\\)",display:false},
      {left:"$$",right:"$$",display:true},
      {left:"$",right:"$",display:false}
    ],
    throwOnError:false,
    strict:"ignore",
    ignoredTags:["script","noscript","style","textarea","pre","code"]
  });
}
function renderRich(target,text){
  const raw=String(text==null?"":text);
  try{
    if(window.marked&&window.DOMPurify){
      marked.setOptions({gfm:true,breaks:true});
      const cleaned=normalizeBareLatex(repairMalformedMath(normalizeTutorMarkdown(raw)));
      target.innerHTML=DOMPurify.sanitize(marked.parse(cleaned),{USE_PROFILES:{html:true}});
      renderMath(target);
      return;
    }
  }catch(e){console.warn("Render fallback",e)}
  target.textContent=raw;
}
function structuredMarkdown(response,fallbackText){
  if(!response||typeof response!=="object")return String(fallbackText||"");
  const parts=[];
  if(response.observation)parts.push(String(response.observation));
  if(response.hint)parts.push("**Gợi ý:** "+response.hint);
  if(response.check_test)parts.push("**Test nhỏ:** "+response.check_test);
  if(response.needs_clarification&&response.clarification_question)parts.push("**Cần làm rõ:** "+response.clarification_question);
  else if(response.next_question)parts.push("**Câu hỏi:** "+response.next_question);
  return parts.join("\n\n")||String(fallbackText||"");
}
function appendTurn(role,text,meta={}){
  if(chat.querySelector(".empty"))chat.innerHTML="";
  const wrap=document.createElement("div");
  wrap.className="turn "+(role==="user"?"turnUser":"turnAssistant")+(meta.degraded?" turnDegraded":"");
  const label=document.createElement("div");
  label.className="turnLabel";
  label.textContent=role==="user"?"Em":"Trợ giảng AI";
  const bubble=document.createElement("div");
  bubble.className="turnBubble";
  if(role==="assistant")renderRich(bubble,text);else bubble.textContent=text;
  wrap.append(label,bubble);
  if(meta.model||meta.note){
    const m=document.createElement("div");
    m.className="turnMeta";
    m.textContent=[meta.note,meta.model&&meta.model!=="none"?"Model: "+meta.model:""].filter(Boolean).join(" · ");
    wrap.append(m);
  }
  chat.append(wrap);
  chat.scrollTop=chat.scrollHeight;
}
function apiHistory(){
  return turns.slice(-6).map(t=>({role:t.role==="assistant"?"model":"user",text:t.text}));
}
function setBusy(flag){
  send.disabled=flag;
  followSend.disabled=flag;
  followText.disabled=flag;
  document.querySelectorAll(".chip").forEach(b=>b.disabled=flag);
}
function friendlyError(data,statusCode){
  const code=data&&data.code;
  if(code==="DAILY_QUOTA_EXHAUSTED")return "Hạn mức Gemini trong ngày đã hết. Bài của em vẫn được giữ nguyên.";
  if(code==="RATE_LIMITED")return "Em gửi hơi nhanh hoặc hệ thống đang đông. Hãy chờ một chút rồi thử lại.";
  if(code==="REQUEST_IN_PROGRESS")return "Phiên này đang xử lý một yêu cầu. Hãy chờ phản hồi hiện tại.";
  if(code==="AI_TIMEOUT")return "AI phản hồi quá chậm. Hãy thử lại sau ít giây.";
  if(statusCode===503)return "Gemini đang bận. Hãy thử lại sau ít giây.";
  return data&&data.error?data.error:"Không thể gọi AI.";
}
async function requestTutor(payload,controller){
  const timer=setTimeout(()=>controller.abort(),35000);
  try{
    return await fetch("https://thayminhchuyentin.vanminhk-27.workers.dev/api/ai-tutor",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
  }finally{clearTimeout(timer)}
}
function updateTutorState(response){
  if(!response||typeof response!=="object")return;
  tutorState.hintStep+=1;
  tutorState.pendingQuestion=response.needs_clarification?String(response.clarification_question||""):String(response.next_question||"");
}
function resetSession(){
  if(active&&active.controller)active.controller.abort();
  active=null;
  sessionVersion+=1;
  sessionId=newId();
  requestSeq=0;
  turns=[];
  tutorState={hintStep:0,pendingQuestion:""};
  imageData=null;
  prompt.value="";
  image.value="";
  preview.removeAttribute("src");
  preview.style.display="none";
  followText.value="";
  chat.innerHTML='<span class="empty">Phiên mới đã bắt đầu. Hãy gửi đề bài hoặc code; lịch sử cũ đã được xóa.</span>';
  status.textContent="Đã tạo phiên bài mới.";
  setBusy(false);
}
async function ask(message,kind){
  const text=String(message||"").trim();
  if(!text&&!imageData){status.textContent="Hãy nhập đề bài, code hoặc chọn ảnh.";return}
  if(active){status.textContent="AI đang xử lý yêu cầu hiện tại.";return}

  const version=sessionVersion;
  const requestId=sessionId+"-"+(++requestSeq);
  const historyBefore=apiHistory();
  turns.push({role:"user",text});
  appendTurn("user",text);

  const controller=new AbortController();
  active={requestId,controller,version};
  setBusy(true);
  status.textContent="Trợ giảng AI đang suy nghĩ…";

  const payload={
    requestId,
    sessionId,
    message:text,
    language:$("language").value,
    level:$("level").value,
    image:kind==="main"?imageData:null,
    history:historyBefore,
    state:{hintStep:tutorState.hintStep,pendingQuestion:tutorState.pendingQuestion}
  };

  try{
    const res=await requestTutor(payload,controller);
    const data=await res.json().catch(()=>({}));
    if(version!==sessionVersion||!active||active.requestId!==requestId)return;

    if(!res.ok){
      const msg=friendlyError(data,res.status);
      if(data.fallback){
        const fallbackText=structuredMarkdown(data.fallback,"");
        appendTurn("assistant",fallbackText,{degraded:true,note:msg});
        turns.push({role:"assistant",text:fallbackText});
        updateTutorState(data.fallback);
        status.textContent=msg;
      }else{
        status.textContent=msg;
        const err=document.createElement("div");
        err.className="turn turnAssistant turnDegraded";
        const bubble=document.createElement("div");
        bubble.className="turnBubble";
        bubble.textContent=msg;
        err.append(bubble);
        chat.append(err);
        chat.scrollTop=chat.scrollHeight;
      }
      return;
    }

    const out=structuredMarkdown(data.response,data.answer||data.text||"");
    appendTurn("assistant",out,{model:data.model,note:data.fallback?"Đã chuyển model dự phòng":""});
    turns.push({role:"assistant",text:out});
    updateTutorState(data.response);
    status.textContent="Đã nhận gợi ý.";
  }catch(e){
    if(e&&e.name==="AbortError"){
      if(version===sessionVersion)status.textContent="Yêu cầu đã được hủy hoặc quá thời gian chờ.";
    }else if(version===sessionVersion){
      status.textContent="Không kết nối được máy chủ AI. Hãy kiểm tra mạng và thử lại.";
    }
  }finally{
    if(active&&active.requestId===requestId)active=null;
    if(version===sessionVersion)setBusy(false);
  }
}
function setImage(file){
  if(!file||!file.type.startsWith("image/"))return;
  if(file.size>5*1024*1024){status.textContent="Ảnh tối đa 5 MB.";return}
  const r=new FileReader();
  r.onload=()=>{imageData=r.result;preview.src=imageData;preview.style.display="block";status.textContent="Đã nhận ảnh."};
  r.readAsDataURL(file);
}
function insertFormulaIntoPrompt(latex){
  const value=String(latex||"").trim();
  if(!value)return false;
  const wrapped="\\("+value+"\\)";
  const start=prompt.selectionStart==null?prompt.value.length:prompt.selectionStart;
  const end=prompt.selectionEnd==null?start:prompt.selectionEnd;
  const before=prompt.value.slice(0,start),after=prompt.value.slice(end);
  const leftSpace=before&&!/\s$/.test(before)?" ":"";
  const rightSpace=after&&!/^\s/.test(after)?" ":"";
  prompt.value=before+leftSpace+wrapped+rightSpace+after;
  const caret=(before+leftSpace+wrapped+rightSpace).length;
  prompt.focus();prompt.setSelectionRange(caret,caret);
  return true;
}
function setupMathEditor(){
  const dialog=$("mathDialog"),field=$("mathField"),open=$("openMath"),close=$("closeMath"),insert=$("insertMath"),clear=$("clearMath"),latexPreview=$("mathLatexPreview");
  if(!dialog||!field||!open)return;
  const sync=()=>{if(latexPreview)latexPreview.textContent=field.value||""};
  open.addEventListener("click",()=>{if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");setTimeout(()=>field.focus(),30);sync()});
  if(close)close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
  if(clear)clear.addEventListener("click",()=>{field.value="";field.focus();sync()});
  field.addEventListener("input",sync);
  document.querySelectorAll(".mathQuick [data-latex]").forEach(btn=>btn.addEventListener("click",()=>{
    const latex=btn.dataset.latex||"";
    if(typeof field.insert==="function")field.insert(latex,{selectionMode:"placeholder",focus:true});else field.value=(field.value||"")+latex;
    sync();
  }));
  if(insert)insert.addEventListener("click",()=>{if(insertFormulaIntoPrompt(field.value)){dialog.close();status.textContent="Đã chèn công thức vào đề bài."}});
}

setupMathEditor();
image.addEventListener("change",e=>setImage(e.target.files[0]));
document.addEventListener("paste",e=>{const files=e.clipboardData&&e.clipboardData.files?[...e.clipboardData.files]:[];const file=files.find(x=>x.type.startsWith("image/"));if(file)setImage(file)});
document.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{prompt.value=(prompt.value?prompt.value+"\n\n":"")+b.dataset.q;prompt.focus()}));
clearBtn.addEventListener("click",resetSession);
send.addEventListener("click",()=>ask(prompt.value.trim(),"main"));
follow.addEventListener("submit",e=>{e.preventDefault();const q=followText.value.trim();if(!q)return;followText.value="";ask(q,"follow")});
})();