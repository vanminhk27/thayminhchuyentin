(()=>{"use strict";
const $=id=>document.getElementById(id),prompt=$("prompt"),image=$("image"),preview=$("preview"),answer=$("answer"),status=$("status");
let imageData=null,history=[];
function setImage(file){if(!file||!file.type.startsWith("image/"))return;if(file.size>5*1024*1024){status.textContent="Ảnh tối đa 5 MB.";return}const r=new FileReader();r.onload=()=>{imageData=r.result;preview.src=imageData;preview.style.display="block";status.textContent="Đã nhận ảnh."};r.readAsDataURL(file)}
image.addEventListener("change",e=>setImage(e.target.files[0]));
document.addEventListener("paste",e=>{const f=[...e.clipboardData.files].find(x=>x.type.startsWith("image/"));if(f)setImage(f)});
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{prompt.value=(prompt.value?prompt.value+"\n\n":"")+b.dataset.q;prompt.focus()});
$("clear").onclick=()=>{prompt.value="";image.value="";imageData=null;preview.style.display="none";answer.innerHTML='<span class="empty">Hãy gửi đề bài hoặc code để bắt đầu.</span>';history=[];status.textContent=""};
async function ask(extra=""){const text=[prompt.value.trim(),extra.trim()].filter(Boolean).join("\n\n");if(!text&&!imageData){status.textContent="Hãy nhập đề bài, code hoặc chọn ảnh.";return}
const payload={message:text,language:$("language").value,level:$("level").value,image:imageData,history:history.slice(-8)};
$("send").disabled=true;status.textContent="AI đang phân tích…";answer.textContent="Đang suy nghĩ…";
try{const res=await fetch("/api/ai-tutor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"API chưa được cấu hình trên máy chủ.");const out=data.answer||data.text||"AI không trả về nội dung.";answer.textContent=out;history.push({role:"user",text},{role:"model",text:out});status.textContent="Đã phân tích xong."}catch(e){answer.textContent="Chưa kết nối được AI Tutor. "+e.message;status.textContent="Không thể gọi AI."}finally{$("send").disabled=false}}
$("send").onclick=()=>ask();
$("follow").addEventListener("submit",e=>{e.preventDefault();const q=$("followText").value.trim();if(!q)return;$("followText").value="";ask(q)});
})();