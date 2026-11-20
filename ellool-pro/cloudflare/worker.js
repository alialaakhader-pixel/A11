const MODEL="@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const IMAGE_MODEL="@cf/black-forest-labs/flux-1-schnell";
const ALLOWED=new Set(["https://ellool-ai-studio.vercel.app","https://ellool-ai-studio-git-main-ellool.vercel.app","https://ellool-ai-studio-7c612xzoe-ellool.vercel.app"]);
const hits=new Map();
const cors=o=>({"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"});
const json=(d,s,h)=>new Response(JSON.stringify(d),{status:s,headers:{...h,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export default{async fetch(req,env){
const origin=req.headers.get("Origin")||"";if(!ALLOWED.has(origin))return json({error:{message:"Origin غير مسموح."}},403,{"Vary":"Origin"});
const h=cors(origin);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
const u=new URL(req.url);if(req.method==="GET"&&u.pathname==="/health")return json({ok:true,service:"ELLOOL AI",engine:"Cloudflare Workers AI",model:MODEL,image_model:IMAGE_MODEL,privacy:"No conversation storage"},200,h);
const isImage=req.method==="POST"&&u.pathname==="/v1/images/generations";
const isChat=req.method==="POST"&&["/v1/chat/completions","/chat/completions"].includes(u.pathname);
if(!isImage&&!isChat)return json({error:{message:"المسار غير موجود."}},404,h);
const ip=req.headers.get("CF-Connecting-IP")||"unknown",now=Date.now(),recent=(hits.get(ip)||[]).filter(t=>now-t<60000);
if(recent.length>=(isImage?4:12))return json({error:{message:"تم الوصول للحد المؤقت؛ حاول بعد دقيقة."}},429,h);
recent.push(now);hits.set(ip,recent);if(hits.size>2000)for(const[k,v]of hits)if(!v.length||now-v[v.length-1]>120000)hits.delete(k);
let b;try{const raw=await req.text();if(raw.length>(isImage?12000:90000))return json({error:{message:"حجم الطلب أكبر من الحد المسموح."}},413,h);b=JSON.parse(raw)}catch{return json({error:{message:"صيغة الطلب غير صالحة."}},400,h)}
if(isImage){
const prompt=typeof b.prompt==="string"?b.prompt.trim():"";
if(!prompt||prompt.length>2048)return json({error:{message:"اكتب وصفاً للصورة لا يتجاوز 2048 حرفاً."}},400,h);
try{const result=await env.AI.run(IMAGE_MODEL,{prompt,steps:Math.max(4,Math.min(Number(b.steps)||4,8))});if(!result?.image)return json({error:{message:"محرك الصور لم يُرجع صورة."}},502,h);return json({image:"data:image/jpeg;base64,"+result.image,model:IMAGE_MODEL},200,h)}
catch(e){return json({error:{message:"تعذر توليد الصورة حالياً. قد تكون الحصة اليومية انتهت أو الخدمة مشغولة."}},503,h)}
}
if(!Array.isArray(b.messages)||!b.messages.length||b.messages.length>30)return json({error:{message:"المحادثة فارغة أو طويلة أكثر من اللازم."}},400,h);
const msgs=b.messages.filter(m=>m&&["system","user","assistant"].includes(m.role)&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,18000)}));if(!msgs.length)return json({error:{message:"لا توجد رسائل نصية صالحة."}},400,h);
if(!msgs.some(m=>m.role==="system"))msgs.unshift({role:"system",content:"أنت اللول ELLOOL، مساعد ذكاء اصطناعي عربي، دقيق وعملي. أجب بلغة المستخدم، وكن واضحاً وصريحاً، ولا تختلق معلومات أو قدرات أو مصادر. عند عدم التأكد وضّح ذلك."});
const max=Math.max(64,Math.min(Number(b.max_tokens)||900,1200));
try{const r=await env.AI.run(MODEL,{messages:msgs,max_tokens:max,temperature:Math.max(0,Math.min(Number(b.temperature??.65),1))});const content=r?.choices?.[0]?.message?.content??r?.response??"";if(typeof content!=="string"||!content.trim())return json({error:{message:"النموذج لم يُرجع نصاً؛ حاول تقليل طول الطلب."}},502,h);
const id=r.id||"ellool-"+Date.now(),enc=new TextEncoder(),stream=new ReadableStream({start(c){c.enqueue(enc.encode("data: "+JSON.stringify({id,object:"chat.completion.chunk",choices:[{index:0,delta:{role:"assistant"},finish_reason:null}]})+"\n\n"));c.enqueue(enc.encode("data: "+JSON.stringify({id,object:"chat.completion.chunk",choices:[{index:0,delta:{content},finish_reason:null}]})+"\n\n"));c.enqueue(enc.encode("data: [DONE]\n\n"));c.close()}});return new Response(stream,{status:200,headers:{...h,"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}})
}catch(e){return json({error:{message:"تعذر تشغيل نموذج اللول حالياً. قد تكون الحصة المجانية اليومية انتهت أو الخدمة مشغولة."}},503,h)}
}};