const JSON_HEADERS={"content-type":"application/json; charset=utf-8"};
const LEVELS={
  hint:"Chỉ gợi ý nhẹ. Không đưa code hoàn chỉnh trừ khi người học yêu cầu rõ ràng.",
  guide:"Hướng dẫn từng bước bằng câu hỏi và gợi ý, sau đó mới nêu thuật toán.",
  detail:"Phân tích chi tiết: đề bài, constraints, brute force, tối ưu, độ phức tạp, pseudocode và lỗi thường gặp.",
  max:"Giải cực kỳ chi tiết: phân tích đề, Input/Output, constraints, dạng bài, brute force, vì sao chưa tốt, thuật toán tối ưu, chứng minh, độ phức tạp, pseudocode, code hoàn chỉnh, giải thích code, test mẫu, edge cases và lỗi thường gặp."
};

function cors(origin,allowed){
  const ok=origin===allowed || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin||"");
  return {"access-control-allow-origin":ok?origin:allowed,"access-control-allow-methods":"POST, OPTIONS, GET","access-control-allow-headers":"Content-Type","vary":"Origin"};
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
  return `Bạn là AI Tutor của Thầy Minh Chuyên Tin, chuyên bồi dưỡng HSG Tin học, Tin học trẻ và Olympic.
Ngôn ngữ ưu tiên: ${lang}.
Mức hỗ trợ: ${LEVELS[level]||LEVELS.max}

Nguyên tắc:
- Trả lời bằng tiếng Việt rõ ràng, chính xác, phù hợp học sinh.
- Khi có đề bài: xác định Input, Output, constraints, dạng bài và độ phức tạp mục tiêu trước khi chốt thuật toán.
- Luôn cân nhắc brute force trước, rồi giải thích cách tối ưu.
- Khi có code: tìm lỗi logic, WA, TLE, RE, overflow, indexing, boundary, nhiều test, recursion depth và edge cases.
- Nếu nghi ngờ lời giải sai, hãy tạo test phản ví dụ.
- Với code Python, chú ý hiệu năng I/O, độ phức tạp, recursion và kiểu dữ liệu.
- Với C++, mặc định C++17; chú ý long long, iterator/index và UB.
- Không bịa dữ kiện đề bài. Nếu ảnh/đề thiếu hoặc mờ, nêu rõ phần chưa đọc được.
- Với mức chi tiết cao nhất, có thể đưa lời giải và code hoàn chỉnh nhưng phải giải thích tư duy, chứng minh và kiểm thử.
- Trình bày có tiêu đề ngắn, dùng Markdown; code đặt trong code fence đúng ngôn ngữ.`;
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
  const allowed=new Set(["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite"]);
  return allowed.has(value)?value:"gemini-3.8-flash";
}

export {parseImage,systemPrompt,toGeminiContents,extractAnswer,selectModel};

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
    if(origin && origin!==allowed && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){
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
    const payload={
      system_instruction:{parts:[{text:systemPrompt(body.language,body.level)}]},
      contents:toGeminiContents(body.history,message,image),
      generationConfig:{temperature:0.35,maxOutputTokens:8192}
    };
    const model=selectModel(env.GEMINI_MODEL);
    let upstream;
    try{
      upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify(payload)
      });
    }catch{
      return json({error:"Không kết nối được Gemini. Vui lòng thử lại."},502,origin,allowed);
    }
    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok){
      const detail=data?.error?.message||"Gemini API trả về lỗi.";
      return json({error:detail},upstream.status>=400&&upstream.status<600?upstream.status:502,origin,allowed);
    }
    const answer=extractAnswer(data);
    if(!answer)return json({error:"Gemini không trả về nội dung."},502,origin,allowed);
    return json({answer,model},200,origin,allowed);
  }
};