const JSON_HEADERS={"content-type":"application/json; charset=utf-8"};
const PROMPT_VERSION="2026-10-03-r2";
const LEVELS={
  hint:"Chỉ một gợi ý ngắn, có thể một phản ví dụ nhỏ, rồi kết thúc bằng đúng một câu hỏi cụ thể.",
  guide:"Chỉ trình bày bước hiện tại, không liệt kê trước các bước sau; dừng lại và chờ học sinh phản hồi."
};
const LIMITS={message:24000,historyTurns:6,imageBase64:7_000_000,sessionPerMinute:8,globalPerMinute:120};
const sessionWindows=new Map();
const inFlightSessions=new Set();

function normalizeLevel(level){return level==="hint"?"hint":"guide"}
function sanitizeId(value,max=96){return String(value||"").replace(/[^A-Za-z0-9._:-]/g,"").slice(0,max)}
function detectCodeLanguage(text){
  const s=String(text||"");
  if(/#include\s*<|std::|vector\s*<|cout\s*<<|cin\s*>>|int\s+main\s*\(/.test(s))return "cpp";
  if(/(^|\n)\s*(def\s+\w+\s*\(|from\s+\w+\s+import|import\s+\w+|print\s*\(|for\s+\w+\s+in\s+range\s*\()/m.test(s))return "python";
  return "unknown";
}
function languageConflict(selected,text){
  const detected=detectCodeLanguage(text);
  if(selected==="python"&&detected==="cpp")return {selected,detected};
  if(selected==="cpp"&&detected==="python")return {selected,detected};
  return null;
}
function wantsSmallTestResult(text){
  return /\b(kết quả|đáp án)\b.{0,30}\b(test|ví dụ)|\b(test|ví dụ)\b.{0,30}\b(kết quả|ra bao nhiêu)|cho\s+(?:em\s+)?kết quả/i.test(String(text||""));
}
function violatesTutorPolicy(text){
  const s=String(text||"");
  if(s.includes(String.fromCharCode(96).repeat(3)))return true;
  if(/(^|\n)\s*(?:def\s+\w+\s*\(|class\s+\w+|#include\s*<|int\s+main\s*\(|for\s*\([^\n]+\)\s*\{|while\s*\([^\n]+\)\s*\{)/m.test(s))return true;
  if(/\b(?:code hoàn chỉnh|lời giải hoàn chỉnh|đáp án hoàn chỉnh|pseudocode đầy đủ|thuật toán đầy đủ)\b/i.test(s))return true;
  return false;
}
function normalizeOrigin(value){
  return String(value||"").trim().replace(/\/+$/,"");
}
function isAllowedOrigin(origin,configured){
  const value=normalizeOrigin(origin);
  if(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value))return true;
  const allowed=new Set([
    "https://thayminhchuyentin.io.vn",
    "https://www.thayminhchuyentin.io.vn",
    normalizeOrigin(configured)
  ].filter(Boolean));
  return allowed.has(value);
}
function cors(origin,allowed){
  const ok=isAllowedOrigin(origin,allowed);
  return {
    "access-control-allow-origin":ok?normalizeOrigin(origin):"https://thayminhchuyentin.io.vn",
    "access-control-allow-methods":"POST, OPTIONS, GET",
    "access-control-allow-headers":"Content-Type",
    "access-control-max-age":"86400",
    "vary":"Origin"
  };
}
function json(data,status=200,origin="",allowed="https://thayminhchuyentin.io.vn"){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(origin,allowed)}});
}
function parseImage(dataUrl){
  if(!dataUrl)return null;
  const m=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if(!m)throw new Error("Ảnh không hợp lệ. Chỉ hỗ trợ PNG, JPEG, WEBP hoặc GIF.");
  if(m[2].length>7_000_000)throw new Error("Ảnh quá lớn. Vui lòng dùng ảnh nhỏ hơn 5 MB.");
  return {mimeType:m[1],data:m[2]};
}
function systemPrompt(language,level){
  const lang=language==="cpp"?"C++":language==="python"?"Python":"tự nhận diện giữa Python và C++";
  const mode=normalizeLevel(level);
  return `Bạn là AI Tutor của Thầy Minh Chuyên Tin, chuyên bồi dưỡng HSG Tin học, Tin học trẻ và Olympic.
Ngôn ngữ ưu tiên: ${lang}.
Chế độ học sinh: ${LEVELS[mode]}

MỤC TIÊU CỐT LÕI: giúp học sinh TỰ TÌM RA LỜI GIẢI. Đây là chatbot gợi ý, không phải máy giải bài.

QUY TẮC BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG đưa lời giải hoàn chỉnh, code hoàn chỉnh, pseudocode hoàn chỉnh hoặc công thức đáp án cuối.
- TUYỆT ĐỐI KHÔNG tiếp tục từ gợi ý thành lời giải chỉ vì học sinh yêu cầu "giải luôn", "cho code", "em chịu rồi" hoặc tương tự. Khi đó chỉ tăng mức rõ ràng của GỢI Ý.
- Với mode hint: tối đa 1 ý gợi mở + 1-2 câu hỏi. Không nêu tên thuật toán tối ưu nếu học sinh chưa tự nhận ra.
- Với mode guide: có thể chỉ ra dạng tư duy/khái niệm và một bước tiếp theo, nhưng chỉ mở MỘT bước mỗi lượt. Dừng lại để học sinh trả lời.
- Nếu học sinh gửi code: chỉ ra tối đa 1-2 điểm đáng nghi và câu hỏi kiểm tra; không viết lại toàn bộ code đúng.
- Nếu cần test phản ví dụ, có thể đưa 1 test nhỏ nhưng không suy diễn thành lời giải đầy đủ.
- Ưu tiên hỏi về constraints, độ phức tạp mục tiêu, invariant, trạng thái, cấu trúc dữ liệu hoặc trường hợp biên.
- Không bịa dữ kiện. Nếu đề/ảnh thiếu hoặc mờ, hỏi lại phần còn thiếu.
- Trả lời ngắn gọn, thường 80-220 từ; chỉ dài hơn khi cần giải thích một khái niệm nền tảng.
- Mỗi câu trả lời nên kết thúc bằng "Em thử..." hoặc một câu hỏi cụ thể để học sinh tiếp tục suy nghĩ.
- Trình bày Markdown sạch, không thụt 4 dấu cách đầu dòng.
- Chỉ dùng code inline rất ngắn nếu cần nhắc tên biến/biểu thức; không dùng code fence.
- Công thức toán trong dòng phải dùng \\( ... \\); công thức đứng riêng phải dùng \\[ ... \\]. Không dùng dấu $ và không lồng delimiter toán. Không để lệnh LaTeX trần.`;
}
function toGeminiContents(history,message,image){
  const contents=[];
  for(const h of Array.isArray(history)?history.slice(-8):[]){
    if(!h||!h.text)continue;
    contents.push({role:h.role==="model"?"model":"user",parts:[{text:String(h.text).slice(0,12000)}]});
  }
  const parts=[{text:message||"Hãy phân tích nội dung trong ảnh và hướng dẫn giải bài."}];
  if(image)parts.push({inline_data:{mime_type:image.mimeType,data:image.data}});
  contents.push({role:"user",parts});
  return contents;
}
function extractAnswer(data){
  const parts=data?.candidates?.[0]?.content?.parts||[];
  return parts.map(p=>p.text||"").join("").trim();
}
function selectModel(value){
  const allowed=new Set(["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite","gemini-3.1-flash-lite"]);
  return allowed.has(value)?value:"gemini-3.8-flash";
}

export {parseImage,systemPrompt,toGeminiContents,extractAnswer,selectModel,isAllowedOrigin,normalizeLevel,violatesTutorPolicy};

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get("Origin")||"";
    const allowed=env.ALLOWED_ORIGIN||"https://thayminhchuyentin.io.vn";
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin,allowed)});
    if(request.method==="GET" && (url.pathname==="/"||url.pathname==="/health")){
      return json({ok:true,service:"Thầy Minh AI Tutor",model:selectModel(env.GEMINI_MODEL),geminiConfigured:Boolean(env.GEMINI_API_KEY)},200,origin,allowed);
    }
    if(request.method!=="POST" || !["/","/api/ai-tutor"].includes(url.pathname)){
      return json({error:"Not found"},404,origin,allowed);
    }
    if(origin && !isAllowedOrigin(origin,allowed)){
      return json({error:"Origin không được phép."},403,origin,allowed);
    }
    if(!env.GEMINI_API_KEY)return json({error:"Máy chủ chưa cấu hình GEMINI_API_KEY."},500,origin,allowed);
    const len=Number(request.headers.get("content-length")||0);
    if(len>8_000_000)return json({error:"Yêu cầu quá lớn."},413,origin,allowed);
    let body;
    try{body=await request.json()}catch{return json({error:"JSON không hợp lệ."},400,origin,allowed)}
    const message=String(body.message||"").trim().slice(0,30000);
    let image;
    try{image=parseImage(body.image||null)}catch(e){return json({error:e.message},400,origin,allowed)}
    if(!message&&!image)return json({error:"Hãy nhập đề bài, code hoặc gửi ảnh."},400,origin,allowed);
    const level=normalizeLevel(body.level);
    const payload={
      system_instruction:{parts:[{text:systemPrompt(body.language,level)}]},
      contents:toGeminiContents(body.history,message,image),
      generationConfig:{temperature:0.2,maxOutputTokens:level==="hint"?900:1400}
    };
    const configured=selectModel(env.GEMINI_MODEL);
    const primary=image?configured:"gemini-3.5-flash-lite";
    const fallbackOrder=image
      ? ["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-3.5-flash"]
      : ["gemini-3.1-flash-lite",configured,"gemini-3.5-flash"];
    const models=[...new Set([primary,...fallbackOrder])];
    let lastStatus=502,lastDetail="Không kết nối được Gemini. Vui lòng thử lại.";
    for(const model of models){
      for(let attempt=0;attempt<2;attempt++){
        let upstream;
        try{
          upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
            method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify(payload)
          });
        }catch{
          if(attempt===0){await new Promise(r=>setTimeout(r,300));continue}
          break;
        }
        const data=await upstream.json().catch(()=>({}));
        if(upstream.ok){
          let answer=extractAnswer(data);
          if(answer){
            let rewritten=false;
            if(violatesTutorPolicy(answer)){
              const repairPayload={
                system_instruction:{parts:[{text:"Bạn là bộ lọc sư phạm. Viết lại nội dung thành GỢI Ý cho học sinh: không code fence, không code/pseudocode hoàn chỉnh, không đáp án cuối; chỉ giữ 1 bước gợi mở, 1-2 câu hỏi và việc học sinh cần tự làm tiếp. Trả lời tiếng Việt, Markdown sạch."}]},
                contents:[{role:"user",parts:[{text:"Câu hỏi của học sinh:\n"+message+"\n\nNội dung cần viết lại:\n"+answer}]}],
                generationConfig:{temperature:0.1,maxOutputTokens:900}
              };
              try{
                const repair=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
                  method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify(repairPayload)
                });
                const repairData=await repair.json().catch(()=>({}));
                if(repair.ok){
                  const fixed=extractAnswer(repairData);
                  if(fixed&&!violatesTutorPolicy(fixed)){answer=fixed;rewritten=true}
                }
              }catch{}
            }
            if(violatesTutorPolicy(answer)){
              answer="Mình sẽ không đưa lời giải hoàn chỉnh. Em hãy bắt đầu bằng cách xác định constraints và tự hỏi: với giới hạn đó, độ phức tạp nào là chấp nhận được? Từ đó em thử nghĩ một cách đơn giản nhất trước, rồi gửi lại ý tưởng của em để mình gợi ý bước tiếp theo.";
              rewritten=true;
            }
            return json({answer,model,fallback:model!==primary,rewritten,level},200,origin,allowed);
          }
          lastStatus=502;lastDetail="Gemini không trả về nội dung.";
          break;
        }
        lastStatus=upstream.status>=400&&upstream.status<600?upstream.status:502;
        lastDetail=data?.error?.message||"Gemini API trả về lỗi.";
        if(![429,500,502,503,504].includes(upstream.status)){
          return json({error:lastDetail},lastStatus,origin,allowed);
        }
        if(attempt===0)await new Promise(r=>setTimeout(r,350));
      }
    }
    return json({error:"Các model Gemini đang bận. Vui lòng thử lại sau ít giây.",detail:lastDetail},503,origin,allowed);
  }
};