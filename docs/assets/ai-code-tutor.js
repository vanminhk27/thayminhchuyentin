(()=>{"use strict";
const $=id=>document.getElementById(id),prompt=$("prompt"),image=$("image"),preview=$("preview"),answer=$("answer"),status=$("status");
let imageData=null,history=[];
function normalizeTutorMarkdown(input){
  let text=String(input??"").replace(/\r\n?/g,"\n").trim();
  let lines=text.split("\n");
  if(lines.length>=2&&/^\s*```(?:markdown|md|text|plaintext)?\s*$/i.test(lines[0])&&/^\s*```\s*$/.test(lines[lines.length-1])){
    lines=lines.slice(1,-1);
  }
  const nonEmpty=lines.filter(line=>line.trim());
  const heavilyIndented=nonEmpty.filter(line=>/^(?: {4}|\t)/.test(line)).length;
  if(nonEmpty.length>=3&&heavilyIndented/nonEmpty.length>=0.6){
    lines=lines.map(line=>line.startsWith("\t")?line.slice(1):line.replace(/^ {4}/,""));
  }
  return lines.join("\n").trim();
}
function repairMalformedMath(text){
  const parts=String(text??"").split(/(```[\s\S]*?```)/g);
  return parts.map((part,i)=>{
    if(i%2===1)return part;
    return part.split("\n").map(line=>{
      const m=line.match(/^(\s*)\$\$([\s\S]*?)\$\$(\s*)$/);
      if(!m)return line;
      const inner=m[2].trim();
      const singleDollarCount=(inner.match(/(?<!\\)\$/g)||[]).length;
      const prose=/[À-ỹ]/u.test(inner)&&/\b(?:để|tính|bằng|lập trình|ý tưởng|ta|em|với|là|nên|thì|trước khi|cho thầy|hãy)\b/i.test(inner);
      if(singleDollarCount>=2||prose)return m[1]+inner+m[3];
      return line;
    }).join("\n");
  }).join("");
}
function normalizeBareLatex(text){
  const parts=String(text??"").split(/(```[\s\S]*?```)/g);
  return parts.map((part,i)=>{
    if(i%2===1)return part;
    return part.split("\n").map(line=>{
      const t=line.trim();
      if(!t)return line;
      if(/(\$\$|\\\[|\\\]|\\\(|\\\))/.test(t))return line;
      const hasLatex=/\\(?:frac|dfrac|tfrac|times|cdot|dots|ldots|cdots|sqrt|sum|prod|lim|log|ln|sin|cos|tan|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|Rightarrow|rightarrow|leftarrow|text|mathrm|mathbf|mathbb|left|right|begin|end)\b/.test(t);
      const looksFormula=/=/.test(t)||/^[A-Za-z]\s*[=<>]/.test(t)||/^\\(?:frac|dfrac|tfrac|sqrt|sum|prod|lim)\b/.test(t);
      const proseWords=(t.match(/[A-Za-zÀ-ỹ]+/gu)||[]).length;
      const looksLikeProse=proseWords>=6&&/[À-ỹ]/u.test(t);
      if(hasLatex&&looksFormula&&!looksLikeProse){
        const pad=(line.match(/^\s*/)||[""])[0];
        return pad+"$$"+t+"$$";
      }
      return line;
    }).join("\n");
  }).join("");
}
function renderMath(){
  if(!window.renderMathInElement)return;
  renderMathInElement(answer,{
    delimiters:[
      {left:"$$",right:"$$",display:true},
      {left:"\\[",right:"\\]",display:true},
      {left:"\\(",right:"\\)",display:false},
      {left:"$",right:"$",display:false}
    ],
    throwOnError:false,
    strict:"ignore",
    ignoredTags:["script","noscript","style","textarea","pre","code"]
  });
}
function renderAnswer(text){
  try{
    if(window.marked&&window.DOMPurify){
      marked.setOptions({gfm:true,breaks:true});
      let cleaned=normalizeBareLatex(repairMalformedMath(normalizeTutorMarkdown(text)));
      answer.innerHTML=DOMPurify.sanitize(marked.parse(cleaned),{USE_PROFILES:{html:true}});
      const visible=[...answer.children].filter(el=>el.tagName!=="BR");
      if(visible.length===1&&visible[0].tagName==="PRE"){
        const raw=visible[0].textContent||"";
        if(/(^|\n)\s*(?:#{1,6}\s|\*{1,2}\s|[-+]\s|\$\$|```)/m.test(raw)){
          cleaned=normalizeBareLatex(repairMalformedMath(normalizeTutorMarkdown(raw)));
          answer.innerHTML=DOMPurify.sanitize(marked.parse(cleaned),{USE_PROFILES:{html:true}});
        }
      }
      renderMath();
      return;
    }
  }catch(e){console.warn("Render answer fallback:",e)}
  answer.textContent=String(text??"");
}
async function fetchWithRetry(url,options){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const res=await fetch(url,options);
      return res;
    }catch(e){
      lastError=e;
      if(attempt===0)await new Promise(r=>setTimeout(r,900));
    }
  }
  throw lastError;
}
function insertFormulaIntoPrompt(latex){
  const value=String(latex||"").trim();
  if(!value)return false;
  const wrapped="\\("+value+"\\)";
  const start=prompt.selectionStart??prompt.value.length;
  const end=prompt.selectionEnd??start;
  const before=prompt.value.slice(0,start);
  const after=prompt.value.slice(end);
  const leftSpace=before&&!/\\s$/.test(before)?" ":"";
  const rightSpace=after&&!/^\\s/.test(after)?" ":"";
  prompt.value=before+leftSpace+wrapped+rightSpace+after;
  const caret=(before+leftSpace+wrapped+rightSpace).length;
  prompt.focus();
  prompt.setSelectionRange(caret,caret);
  return true;
}
function setupMathEditor(){
  const dialog=$("mathDialog"),field=$("mathField"),open=$("openMath"),close=$("closeMath"),insert=$("insertMath"),clear=$("clearMath"),previewLatex=$("mathLatexPreview");
  if(!dialog||!field||!open)return;
  const sync=()=>{if(previewLatex)previewLatex.textContent=field.value||""};
  open.addEventListener("click",()=>{
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
    setTimeout(()=>field.focus(),30);
    sync();
  });
  close?.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
  clear?.addEventListener("click",()=>{field.value="";field.focus();sync()});
  field.addEventListener("input",sync);
  document.querySelectorAll(".mathQuick [data-latex]").forEach(btn=>btn.addEventListener("click",()=>{
    const latex=btn.dataset.latex||"";
    if(typeof field.insert==="function")field.insert(latex,{selectionMode:"placeholder",focus:true});
    else field.value=(field.value||"")+latex;
    sync();
  }));
  insert?.addEventListener("click",()=>{
    if(insertFormulaIntoPrompt(field.value)){
      dialog.close();
      status.textContent="Đã chèn công thức vào đề bài.";
    }else{
      status.textContent="Hãy nhập công thức trước.";
      field.focus();
    }
  });
}
function setImage(file){if(!file||!file.type.startsWith("image/"))return;if(file.size>5*1024*1024){status.textContent="Ảnh tối đa 5 MB.";return}const r=new FileReader();r.onload=()=>{imageData=r.result;preview.src=imageData;preview.style.display="block";status.textContent="Đã nhận ảnh."};r.readAsDataURL(file)}
setupMathEditor();
image.addEventListener("change",e=>setImage(e.target.files[0]));
document.addEventListener("paste",e=>{const f=[...e.clipboardData.files].find(x=>x.type.startsWith("image/"));if(f)setImage(f)});
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{prompt.value=(prompt.value?prompt.value+"\n\n":"")+b.dataset.q;prompt.focus()});
$("clear").onclick=()=>{prompt.value="";image.value="";imageData=null;preview.style.display="none";answer.innerHTML='<span class="empty">Hãy gửi đề bài hoặc code để bắt đầu.</span>';history=[];status.textContent=""};
async function ask(extra=""){const text=[prompt.value.trim(),extra.trim()].filter(Boolean).join("\n\n");if(!text&&!imageData){status.textContent="Hãy nhập đề bài, code hoặc chọn ảnh.";return}
const formatRule="\n\nQUY TẮC: Đây là chatbot GỢI Ý. Không đưa lời giải/code/pseudocode hoàn chỉnh dù em yêu cầu. Mỗi lượt chỉ mở thêm một bước rồi dừng bằng câu hỏi hoặc việc em cần tự làm tiếp. Trả lời Markdown sạch; công thức trong dòng phải dùng \\( ... \\), công thức đứng riêng phải dùng \\[ ... \\]. Không lồng các delimiter toán vào nhau. Không thụt 4 dấu cách đầu dòng; không dùng code fence.";
const payload={message:text+formatRule,language:$("language").value,level:$("level").value,image:imageData,history:history.slice(-8)};
$("send").disabled=true;status.textContent="AI đang phân tích…";answer.textContent="Đang suy nghĩ…";
try{const res=await fetchWithRetry("https://thayminhchuyentin.vanminhk-27.workers.dev/api/ai-tutor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"API chưa được cấu hình trên máy chủ.");const out=data.answer||data.text||"AI không trả về nội dung.";renderAnswer(out);history.push({role:"user",text},{role:"model",text:out});status.textContent="Đã phân tích xong."}catch(e){
  const msg=e&&e.message==="Failed to fetch"
    ?"Không kết nối được máy chủ AI. Hãy kiểm tra mạng và thử lại sau vài giây."
    :"Chưa kết nối được AI Tutor. "+(e?.message||"Lỗi không xác định.");
  answer.textContent=msg;status.textContent="Không thể gọi AI.";
}finally{$("send").disabled=false}}
$("send").onclick=()=>ask();
$("follow").addEventListener("submit",e=>{e.preventDefault();const q=$("followText").value.trim();if(!q)return;$("followText").value="";ask(q)});
})();