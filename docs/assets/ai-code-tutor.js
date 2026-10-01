(()=>{"use strict";
const $=id=>document.getElementById(id),prompt=$("prompt"),image=$("image"),preview=$("preview"),answer=$("answer"),status=$("status");
let imageData=null,history=[];
function normalizeBareLatex(text){
  const parts=String(text??"").split(/(```[\\s\\S]*?```)/g);
  return parts.map((part,i)=>{
    if(i%2===1)return part;
    return part.split("\n").map(line=>{
      const t=line.trim();
      if(!t)return line;
      if(/(\$\$|\\\\\[|\\\\\]|\\\\\(|\\\\\))/.test(t))return line;
      const hasLatex=/\\\\(?:frac|dfrac|tfrac|times|cdot|dots|ldots|cdots|sqrt|sum|prod|lim|log|ln|sin|cos|tan|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|text|mathrm|mathbf|mathbb|left|right|begin|end)\\b/.test(t);
      const looksFormula=/^[A-Za-z0-9_{}()[\\]+\\-*/=<>.,:;\\\\^\\s]+$/.test(t);
      if(hasLatex&&looksFormula){
        const pad=(line.match(/^\\s*/)||[""])[0];
        return pad+"$"+t+"$";
      }
      return line;
    }).join("\n");
  }).join("");
}
function renderAnswer(text){
  try{
    if(window.marked&&window.DOMPurify){
      marked.setOptions({gfm:true,breaks:true});
      text=normalizeBareLatex(text);
      answer.innerHTML=DOMPurify.sanitize(marked.parse(text),{USE_PROFILES:{html:true}});
      if(window.renderMathInElement){
        renderMathInElement(answer,{
          delimiters:[
            {left:"$",right:"$",display:true},
            {left:"\\[",right:"\\]",display:true},
            {left:"\\(",right:"\\)",display:false},
            {left:"$",right:"$",display:false}
          ],
          throwOnError:false,
          strict:"ignore",
          ignoredTags:["script","noscript","style","textarea","pre","code"]
        });
      }
      return;
    }
  }catch(e){console.warn("Render answer fallback:",e)}
  answer.textContent=text;
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
function setImage(file){if(!file||!file.type.startsWith("image/"))return;if(file.size>5*1024*1024){status.textContent="Ảnh tối đa 5 MB.";return}const r=new FileReader();r.onload=()=>{imageData=r.result;preview.src=imageData;preview.style.display="block";status.textContent="Đã nhận ảnh."};r.readAsDataURL(file)}
image.addEventListener("change",e=>setImage(e.target.files[0]));
document.addEventListener("paste",e=>{const f=[...e.clipboardData.files].find(x=>x.type.startsWith("image/"));if(f)setImage(f)});
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{prompt.value=(prompt.value?prompt.value+"\n\n":"")+b.dataset.q;prompt.focus()});
$("clear").onclick=()=>{prompt.value="";image.value="";imageData=null;preview.style.display="none";answer.innerHTML='<span class="empty">Hãy gửi đề bài hoặc code để bắt đầu.</span>';history=[];status.textContent=""};
async function ask(extra=""){const text=[prompt.value.trim(),extra.trim()].filter(Boolean).join("\n\n");if(!text&&!imageData){status.textContent="Hãy nhập đề bài, code hoặc chọn ảnh.";return}
const formatRule="\n\nQUY TẮC ĐỊNH DẠNG TOÁN: Mọi công thức LaTeX phải đặt trong \\( ... \\) nếu nằm cùng dòng văn bản, hoặc \\[ ... \\] nếu là công thức riêng một dòng. Không được viết lệnh LaTeX trần như \\frac, \\times, \\dots bên ngoài delimiter. Code phải đặt trong khối Markdown ba dấu backtick.";
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