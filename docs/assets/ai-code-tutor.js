(()=>{"use strict";
const $=id=>document.getElementById(id);
const prompt=$("prompt"),image=$("image"),preview=$("preview"),chat=$("chatHistory"),status=$("status");
const send=$("send"),follow=$("follow"),followText=$("followText"),followSend=$("followSend"),clearBtn=$("clear");
const language=$("language"),level=$("level"),conversationList=$("conversationList"),newChatBtn=$("newChat");
const STORAGE_KEY="tmct_ai_tutor_conversations_v1";
const ACTIVE_KEY="tmct_ai_tutor_active_v1";
const MAX_CONVERSATIONS=24;
const MAX_STORED_TURNS=40;
let imageData=null;
let turns=[];
let conversations=[];
let sessionId="";
let sessionVersion=0;
let requestSeq=0;
let active=null;
let saveTimer=null;
let tutorState={hintStep:0,pendingQuestion:""};

function newId(){
  if(globalThis.crypto&&typeof crypto.randomUUID==="function")return crypto.randomUUID();
  return "s-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function cloneTurns(list){
  return (Array.isArray(list)?list:[]).slice(-MAX_STORED_TURNS).map(t=>({
    role:t&&t.role==="assistant"?"assistant":"user",
    text:String(t&&t.text||"").slice(0,12000),
    model:String(t&&t.model||"").slice(0,80),
    note:String(t&&t.note||"").slice(0,180),
    degraded:Boolean(t&&t.degraded)
  }));
}
function makeConversation(id=newId()){
  const now=Date.now();
  return {id,title:"Cuộc trò chuyện mới",createdAt:now,updatedAt:now,prompt:"",language:"python",level:"hint",turns:[],tutorState:{hintStep:0,pendingQuestion:""}};
}
function conversationTitle(source){
  const text=String(source||"").replace(/\s+/g," ").trim();
  if(!text)return "Cuộc trò chuyện mới";
  return text.length>42?text.slice(0,42).trim()+"…":text;
}
function loadStoredConversations(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):[];
    if(!Array.isArray(parsed))return [];
    return parsed.filter(x=>x&&x.id).slice(0,MAX_CONVERSATIONS).map(x=>({
      id:String(x.id),
      title:String(x.title||"Cuộc trò chuyện mới").slice(0,80),
      createdAt:Number(x.createdAt)||Date.now(),
      updatedAt:Number(x.updatedAt)||Date.now(),
      prompt:String(x.prompt||"").slice(0,30000),
      language:["python","cpp","auto"].includes(x.language)?x.language:"python",
      level:x.level==="guide"?"guide":"hint",
      turns:cloneTurns(x.turns),
      tutorState:{
        hintStep:Math.max(0,Number(x.tutorState&&x.tutorState.hintStep)||0),
        pendingQuestion:String(x.tutorState&&x.tutorState.pendingQuestion||"").slice(0,700)
      }
    }));
  }catch{return []}
}
function writeStoredConversations(){
  conversations.sort((a,b)=>b.updatedAt-a.updatedAt);
  if(conversations.length>MAX_CONVERSATIONS)conversations=conversations.slice(0,MAX_CONVERSATIONS);
  let snapshot=conversations;
  for(let attempt=0;attempt<5;attempt++){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot));
      localStorage.setItem(ACTIVE_KEY,sessionId);
      conversations=snapshot;
      return true;
    }catch{
      if(snapshot.length<=1)break;
      const current=snapshot.find(x=>x.id===sessionId);
      const others=snapshot.filter(x=>x.id!==sessionId).slice(0,Math.max(1,snapshot.length-2));
      snapshot=current?[current,...others]:others;
    }
  }
  status.textContent="Bộ nhớ trình duyệt đã đầy; cuộc trò chuyện hiện tại vẫn dùng được nhưng có thể chưa lưu hết.";
  return false;
}
function currentConversation(){
  return conversations.find(x=>x.id===sessionId)||null;
}
function saveCurrentConversation(touch=true){
  if(!sessionId)return;
  let c=currentConversation();
  if(!c){c=makeConversation(sessionId);conversations.unshift(c)}
  c.prompt=String(prompt.value||"").slice(0,30000);
  c.language=language.value;
  c.level=level.value;
  c.turns=cloneTurns(turns);
  c.tutorState={hintStep:tutorState.hintStep,pendingQuestion:tutorState.pendingQuestion};
  if(c.title==="Cuộc trò chuyện mới"){
    const firstUser=turns.find(t=>t.role==="user"&&t.text);
    c.title=conversationTitle(c.prompt||firstUser&&firstUser.text);
  }
  if(touch)c.updatedAt=Date.now();
  writeStoredConversations();
  renderConversationList();
}
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveCurrentConversation(true),250);
}
function timeLabel(ts){
  const d=new Date(ts);
  const today=new Date();
  const same=d.toDateString()===today.toDateString();
  return same?d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"});
}
function renderConversationList(){
  if(!conversationList)return;
  conversationList.innerHTML="";
  const sorted=[...conversations].sort((a,b)=>b.updatedAt-a.updatedAt);
  if(!sorted.length){
    const empty=document.createElement("div");empty.className="historyEmpty";empty.textContent="Chưa có cuộc trò chuyện.";conversationList.append(empty);return;
  }
  for(const c of sorted){
    const row=document.createElement("div");
    row.className="conversationItem"+(c.id===sessionId?" active":"");
    const open=document.createElement("button");
    open.type="button";open.className="conversationOpen";
    const name=document.createElement("span");name.className="conversationName";name.textContent=c.title;
    const time=document.createElement("span");time.className="conversationTime";time.textContent=timeLabel(c.updatedAt);
    open.append(name,time);
    open.addEventListener("click",()=>restoreConversation(c.id));
    const del=document.createElement("button");
    del.type="button";del.className="conversationDelete";del.setAttribute("aria-label","Xóa cuộc trò chuyện");del.textContent="×";
    del.addEventListener("click",e=>{e.stopPropagation();deleteConversation(c.id)});
    row.append(open,del);conversationList.append(row);
  }
}
function clearTransientMedia(){
  imageData=null;image.value="";preview.removeAttribute("src");preview.style.display="none";
}
function renderConversationTurns(){
  chat.innerHTML="";
  if(!turns.length){
    chat.innerHTML='<span class="empty">Hãy gửi đề bài hoặc code. Mỗi lượt AI chỉ mở thêm một bước và giữ lại lịch sử để em theo dõi mạch suy nghĩ.</span>';
    return;
  }
  for(const t of turns)appendTurn(t.role,t.text,{model:t.model,note:t.note,degraded:t.degraded},false);
}
function restoreConversation(id){
  if(active&&active.controller)active.controller.abort();
  active=null;sessionVersion+=1;requestSeq=0;clearTransientMedia();
  const c=conversations.find(x=>x.id===id);
  if(!c)return createNewConversation();
  sessionId=c.id;
  prompt.value=c.prompt||"";
  language.value=c.language||"python";
  level.value=c.level||"hint";
  turns=cloneTurns(c.turns);
  tutorState={hintStep:c.tutorState&&c.tutorState.hintStep||0,pendingQuestion:c.tutorState&&c.tutorState.pendingQuestion||""};
  followText.value="";
  renderConversationTurns();renderConversationList();writeStoredConversations();setBusy(false);
  status.textContent="Đã mở lại cuộc trò chuyện.";
}
function removeBlankCurrent(){
  const c=currentConversation();
  if(c&&c.title==="Cuộc trò chuyện mới"&&!c.prompt.trim()&&!c.turns.length)conversations=conversations.filter(x=>x.id!==c.id);
}
function createNewConversation(){
  if(sessionId)saveCurrentConversation(false);
  if(active&&active.controller)active.controller.abort();
  active=null;sessionVersion+=1;removeBlankCurrent();clearTransientMedia();
  const c=makeConversation();conversations.unshift(c);sessionId=c.id;requestSeq=0;turns=[];tutorState={hintStep:0,pendingQuestion:""};
  prompt.value="";language.value="python";level.value="hint";followText.value="";
  chat.innerHTML='<span class="empty">Cuộc trò chuyện mới. Hãy dán đề bài/code hoặc đặt câu hỏi để bắt đầu.</span>';
  status.textContent="Đã tạo cuộc trò chuyện mới.";setBusy(false);writeStoredConversations();renderConversationList();prompt.focus();
}
function deleteConversation(id){
  if(active&&id===sessionId&&active.controller)active.controller.abort();
  conversations=conversations.filter(x=>x.id!==id);
  if(id===sessionId){
    const next=[...conversations].sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    if(next)return restoreConversation(next.id);
    sessionId="";
    return createNewConversation();
  }
  writeStoredConversations();renderConversationList();
}

function normalizeTutorMarkdown(input){
  let text=String(input==null?"":input).replace(/\r\n?/g,"\n").trim();
  let lines=text.split("\n");
  const fence=String.fromCharCode(96).repeat(3);
  if(lines.length>=2&&lines[0].trim().startsWith(fence)&&lines[lines.length-1].trim()===fence)lines=lines.slice(1,-1);
  const nonEmpty=lines.filter(line=>line.trim());
  const heavilyIndented=nonEmpty.filter(line=>/^(?: {4}|\t)/.test(line)).length;
  if(nonEmpty.length>=3&&heavilyIndented/nonEmpty.length>=0.6)lines=lines.map(line=>line.startsWith("\t")?line.slice(1):line.replace(/^ {4}/,""));
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
      const pad=(line.match(/^\s*/)||[""])[0];return pad+"\\["+t+"\\]";
    }
    return line;
  }).join("\n");
}
function renderMath(target){
  if(!window.renderMathInElement)return;
  renderMathInElement(target,{delimiters:[{left:"\\[",right:"\\]",display:true},{left:"\\(",right:"\\)",display:false},{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false,strict:"ignore",ignoredTags:["script","noscript","style","textarea","pre","code"]});
}
function renderRich(target,text){
  const raw=String(text==null?"":text);
  try{
    if(window.marked&&window.DOMPurify){
      marked.setOptions({gfm:true,breaks:true});
      const cleaned=normalizeBareLatex(repairMalformedMath(normalizeTutorMarkdown(raw)));
      target.innerHTML=DOMPurify.sanitize(marked.parse(cleaned),{USE_PROFILES:{html:true}});renderMath(target);return;
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
function appendTurn(role,text,meta={},scroll=true){
  if(chat.querySelector(".empty"))chat.innerHTML="";
  const wrap=document.createElement("div");
  wrap.className="turn "+(role==="user"?"turnUser":"turnAssistant")+(meta.degraded?" turnDegraded":"");
  const label=document.createElement("div");label.className="turnLabel";label.textContent=role==="user"?"Em":"Trợ giảng AI";
  const bubble=document.createElement("div");bubble.className="turnBubble";
  if(role==="assistant")renderRich(bubble,text);else bubble.textContent=text;
  wrap.append(label,bubble);
  if(meta.model||meta.note){
    const m=document.createElement("div");m.className="turnMeta";m.textContent=[meta.note,meta.model&&meta.model!=="none"?"Model: "+meta.model:""].filter(Boolean).join(" · ");wrap.append(m);
  }
  chat.append(wrap);if(scroll)chat.scrollTop=chat.scrollHeight;
}
function apiHistory(){return turns.slice(-6).map(t=>({role:t.role==="assistant"?"model":"user",text:t.text}))}
function setBusy(flag){
  send.disabled=flag;followSend.disabled=flag;followText.disabled=flag;
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
  try{return await fetch("https://thayminhchuyentin.vanminhk-27.workers.dev/api/ai-tutor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:controller.signal})}
  finally{clearTimeout(timer)}
}
function updateTutorState(response){
  if(!response||typeof response!=="object")return;
  tutorState.hintStep+=1;
  tutorState.pendingQuestion=response.needs_clarification?String(response.clarification_question||""):String(response.next_question||"");
}
async function ask(message,kind){
  const text=String(message||"").trim();
  if(!text&&!imageData){status.textContent="Hãy nhập đề bài, code hoặc chọn ảnh.";return}
  if(active){status.textContent="AI đang xử lý yêu cầu hiện tại.";return}
  saveCurrentConversation(false);

  const version=sessionVersion;
  const requestId=sessionId+"-"+Date.now()+"-"+(++requestSeq);
  const historyBefore=apiHistory();
  const userTurn={role:"user",text};
  turns.push(userTurn);appendTurn("user",text);saveCurrentConversation(true);

  const controller=new AbortController();
  active={requestId,controller,version};setBusy(true);status.textContent="Trợ giảng AI đang suy nghĩ…";
  const payload={requestId,sessionId,message:text,language:language.value,level:level.value,image:kind==="main"?imageData:null,history:historyBefore,state:{hintStep:tutorState.hintStep,pendingQuestion:tutorState.pendingQuestion}};

  try{
    const res=await requestTutor(payload,controller);
    const data=await res.json().catch(()=>({}));
    if(version!==sessionVersion||!active||active.requestId!==requestId)return;
    if(!res.ok){
      const msg=friendlyError(data,res.status);
      if(data.fallback){
        const fallbackText=structuredMarkdown(data.fallback,"");
        const turn={role:"assistant",text:fallbackText,degraded:true,note:msg,model:""};
        appendTurn("assistant",fallbackText,turn);turns.push(turn);updateTutorState(data.fallback);saveCurrentConversation(true);status.textContent=msg;
      }else status.textContent=msg;
      return;
    }
    const out=structuredMarkdown(data.response,data.answer||data.text||"");
    const turn={role:"assistant",text:out,model:data.model||"",note:data.fallback?"Đã chuyển model dự phòng":"",degraded:false};
    appendTurn("assistant",out,turn);turns.push(turn);updateTutorState(data.response);saveCurrentConversation(true);status.textContent="Đã nhận gợi ý.";
  }catch(e){
    if(e&&e.name==="AbortError"){if(version===sessionVersion)status.textContent="Yêu cầu đã được hủy hoặc quá thời gian chờ."}
    else if(version===sessionVersion)status.textContent="Không kết nối được máy chủ AI. Hãy kiểm tra mạng và thử lại.";
  }finally{
    if(active&&active.requestId===requestId)active=null;
    if(version===sessionVersion)setBusy(false);
  }
}
function setImage(file){
  if(!file||!file.type.startsWith("image/"))return;
  if(file.size>5*1024*1024){status.textContent="Ảnh tối đa 5 MB.";return}
  const r=new FileReader();r.onload=()=>{imageData=r.result;preview.src=imageData;preview.style.display="block";status.textContent="Đã nhận ảnh. Ảnh chỉ dùng cho phiên hiện tại và không lưu trong lịch sử trình duyệt."};r.readAsDataURL(file);
}
function insertFormulaIntoPrompt(latex){
  const value=String(latex||"").trim();if(!value)return false;
  const wrapped="\\("+value+"\\)";
  const start=prompt.selectionStart==null?prompt.value.length:prompt.selectionStart,end=prompt.selectionEnd==null?start:prompt.selectionEnd;
  const before=prompt.value.slice(0,start),after=prompt.value.slice(end),leftSpace=before&&!/\s$/.test(before)?" ":"",rightSpace=after&&!/^\s/.test(after)?" ":"";
  prompt.value=before+leftSpace+wrapped+rightSpace+after;
  const caret=(before+leftSpace+wrapped+rightSpace).length;prompt.focus();prompt.setSelectionRange(caret,caret);scheduleSave();return true;
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
  document.querySelectorAll(".mathQuick [data-latex]").forEach(btn=>btn.addEventListener("click",()=>{const latex=btn.dataset.latex||"";if(typeof field.insert==="function")field.insert(latex,{selectionMode:"placeholder",focus:true});else field.value=(field.value||"")+latex;sync()}));
  if(insert)insert.addEventListener("click",()=>{if(insertFormulaIntoPrompt(field.value)){dialog.close();status.textContent="Đã chèn công thức vào đề bài."}});
}
function initConversations(){
  conversations=loadStoredConversations();
  const wanted=(()=>{try{return localStorage.getItem(ACTIVE_KEY)||""}catch{return ""}})();
  if(conversations.length){
    const selected=conversations.find(x=>x.id===wanted)||[...conversations].sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    restoreConversation(selected.id);
  }else createNewConversation();
}

setupMathEditor();
image.addEventListener("change",e=>setImage(e.target.files[0]));
document.addEventListener("paste",e=>{const files=e.clipboardData&&e.clipboardData.files?[...e.clipboardData.files]:[];const file=files.find(x=>x.type.startsWith("image/"));if(file)setImage(file)});
prompt.addEventListener("input",scheduleSave);
language.addEventListener("change",()=>saveCurrentConversation(true));
level.addEventListener("change",()=>saveCurrentConversation(true));
document.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{prompt.value=(prompt.value?prompt.value+"\n\n":"")+b.dataset.q;prompt.focus();scheduleSave()}));
clearBtn.addEventListener("click",createNewConversation);
newChatBtn.addEventListener("click",createNewConversation);
send.addEventListener("click",()=>ask(prompt.value.trim(),"main"));
follow.addEventListener("submit",e=>{e.preventDefault();const q=followText.value.trim();if(!q)return;followText.value="";ask(q,"follow")});
window.addEventListener("beforeunload",()=>saveCurrentConversation(false));
initConversations();
})();