const MODEL="@cf/meta/llama-3.1-8b-instruct-fp8-fast";
const FALLBACK_MODEL="@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const IMAGE_MODEL="@cf/black-forest-labs/flux-2-klein-4b";
const FAST_IMAGE_MODEL="@cf/black-forest-labs/flux-1-schnell";
const hits=new Map();
const isAllowedOrigin=value=>{if(!value)return false;try{const u=new URL(value);if(u.protocol!=="https:")return false;const host=u.hostname.toLowerCase();return host==="ellool-ai-studio.vercel.app"||(host.startsWith("ellool-ai-studio-")&&host.endsWith("-ellool.vercel.app"))}catch{return false}};
const cors=o=>({"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"});
const json=(d,s,h={})=>new Response(JSON.stringify(d),{status:s,headers:{...h,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const messageOf=r=>{const v=r?.choices?.[0]?.message?.content??r?.response??r?.result?.response??"";if(typeof v==="string")return v.trim();if(Array.isArray(v))return v.map(x=>typeof x==="string"?x:(x?.text||"")).join("").trim();return ""};
export default{async fetch(req,env){const origin=req.headers.get("Origin")||"",allowed=isAllowedOrigin(origin),h=allowed?cors(origin):{},u=new URL(req.url);
if(req.method==="GET"&&u.pathname==="/health")return json({ok:true,service:"ELLOOL AI",engine:"Cloudflare Workers AI",model:MODEL,fallback:FALLBACK_MODEL,image_model:IMAGE_MODEL,fast_image_model:FAST_IMAGE_MODEL,fast_image_enabled:env.ENABLE_FLUX1_SCHNELL==="true"},200,h);
if(!allowed)return json({error:{message:"عنوان الموقع غير مسموح. افتح النسخة الرسمية من ELLOOL."}},403,{"Vary":"Origin"});
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
const isVision=req.method==="POST"&&u.pathname==="/v1/vision",isImage=req.method==="POST"&&u.pathname==="/v1/images/generations",isChat=req.method==="POST"&&["/v1/chat/completions","/chat/completions"].includes(u.pathname);
if(!isImage&&!isChat&&!isVision)return json({error:{message:"المسار غير موجود."}},404,h);
const ip=req.headers.get("CF-Connecting-IP")||"unknown",now=Date.now(),recent=(hits.get(ip)||[]).filter(t=>now-t<60000);
if(recent.length>=(isImage?8:isVision?6:15))return json({error:{message:"وصلت للحد المؤقت للطلبات. انتظر دقيقة ثم حاول مرة أخرى."}},429,h);
recent.push(now);hits.set(ip,recent);if(hits.size>2000)for(const[k,v]of hits)if(!v.length||now-v[v.length-1]>120000)hits.delete(k);
let b;try{const raw=await req.text();if(raw.length>((isImage||isVision)?7000000:90000))return json({error:{message:"حجم الطلب أكبر من الحد المسموح."}},413,h);b=JSON.parse(raw)}catch{return json({error:{message:"صيغة الطلب غير صالحة."}},400,h)}
if(isVision){
 const vm=Array.isArray(b.messages)?b.messages.slice(0,4):[];
 const hasImg=vm.some(m=>Array.isArray(m?.content)&&m.content.some(p=>p?.type==="image_url"&&typeof p?.image_url?.url==="string"&&p.image_url.url.startsWith("data:image/")));
 if(!hasImg)return json({error:{message:"أرسل صورة المسألة."}},400,h);
 const vmax=Math.max(64,Math.min(Number(b.max_tokens)||600,900));
 const VMODELS=["@cf/meta/llama-3.2-11b-vision-instruct","@cf/meta/llama-4-scout-17b-16e-instruct"];
 for(const vmodel of VMODELS){
  try{
   let out;
   try{out=await env.AI.run(vmodel,{messages:vm,max_tokens:vmax,temperature:0.1})}
   catch(e1){if(/agree|license/i.test(String(e1?.message||e1))){await env.AI.run(vmodel,{prompt:"agree"});out=await env.AI.run(vmodel,{messages:vm,max_tokens:vmax,temperature:0.1})}else throw e1}
   const text=typeof out==="string"?out:(out?.response||out?.choices?.[0]?.message?.content||"");
   if(text)return json({choices:[{message:{role:"assistant",content:String(text)}}],model:vmodel},200,h);
  }catch(e){console.error("ELLOOL_VISION_FAILED",vmodel,String(e?.message||e).slice(0,400))}
 }
 return json({error:{message:"تعذر قراءة الصورة الآن."}},503,h);
}
if(isImage){
 const prompt=typeof b.prompt==="string"?b.prompt.trim():"";
 if(!prompt||prompt.length>2048)return json({error:{message:"اكتب وصفاً للصورة لا يتجاوز 2048 حرفاً."}},400,h);
 const requestedEngine=b.engine==="schnell"?"schnell":"flux2";
 if(requestedEngine==="schnell"&&env.ENABLE_FLUX1_SCHNELL!=="true")return json({error:{code:"FEATURE_DISABLED",message:"محرك FLUX.1 schnell جاهز برمجياً لكنه متوقف حتى يتم التأكد من أن حساب Cloudflare على الخطة المجانية فقط."}},503,h);
 if(requestedEngine==="schnell"&&b.imageData)return json({error:{message:"FLUX.1 schnell يدعم التوليد النصي فقط. استخدم FLUX.2 Klein لتعديل الصور المرجعية."}},400,h);
 const width=Math.max(256,Math.min(1920,Math.round((Number(b.width)||1024)/64)*64));
 const height=Math.max(256,Math.min(1920,Math.round((Number(b.height)||768)/64)*64));
 try{
  let result;
  if(requestedEngine==="schnell"){
   const steps=Math.max(4,Math.min(8,Math.round(Number(b.steps)||4)));
   result=await env.AI.run(FAST_IMAGE_MODEL,{prompt,steps});
  }else{
  const form=new FormData();form.append("prompt",prompt);form.append("width",String(width));form.append("height",String(height));
  const guidance=Number(b.guidance);
  if(Number.isFinite(guidance))form.append("guidance",String(Math.max(1,Math.min(10,guidance))));
  const seed=Number(b.seed);
  if(Number.isInteger(seed)&&seed>=0&&seed<=2147483647&&String(b.seed).trim()!=="")form.append("seed",String(seed));
  if(typeof b.imageData==="string"&&b.imageData){
   const match=b.imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match)return json({error:{message:"صيغة الصورة المرجعية غير مدعومة. استخدم PNG أو JPG أو WebP."}},400,h);
   if(match[2].length>6500000)return json({error:{message:"الصورة المرجعية كبيرة جداً؛ اختر صورة أصغر من 5MB."}},413,h);
   const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   form.append("input_image_0",new Blob([bytes],{type:match[1]}),"reference");
  }
  const wrapped=new Response(form);
  result=await env.AI.run(IMAGE_MODEL,{multipart:{body:wrapped.body,contentType:wrapped.headers.get("content-type")}});
  }
  if(!result?.image)return json({error:{message:"محرك الصور لم يُرجع صورة. جرّب وصفاً أبسط."}},502,h);
  const encoded=String(result.image||"").replace(/^data:image\/(?:png|jpeg|webp);base64,/i,"");
  if(!encoded||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return json({error:{message:"محرك الصور أعاد ملفاً غير صالح. أعد المحاولة."}},502,h);
  let mime="image/png";
  try{const head=atob(encoded.slice(0,48));if(head.charCodeAt(0)===0xff&&head.charCodeAt(1)===0xd8&&head.charCodeAt(2)===0xff)mime="image/jpeg";else if(head.startsWith("RIFF")&&head.slice(8,12)==="WEBP")mime="image/webp"}catch{}
  return json({image:"data:"+mime+";base64,"+encoded,model:IMAGE_MODEL,width,height,edited:!!b.imageData},200,h);
 }catch(e){const raw=String(e?.message||e||"");console.error("ELLOOL_IMAGE_GENERATION_FAILED",raw.slice(0,1200));const low=raw.toLowerCase();const quota=/quota|limit.?exceed|exceeded|billing|payment|required credits|insufficient credits|429/.test(low);return json({error:{code:quota?"AI_QUOTA_EXHAUSTED":"IMAGE_PROVIDER_ERROR",message:quota?"وصل محرك الصور إلى حد الاستخدام أو انتهت الحصة المتاحة في Cloudflare. لا يمكن تجاوز حد المزود من داخل الموقع؛ جرّب بعد تجدد الحصة أو اربط مزود صور آخر.":"تعذر توليد الصورة من Cloudflare حالياً. السبب التقني: "+raw.replace(/https?:\/\/\S+/g,"[provider]").slice(0,240)}},quota?429:503,h)}
}
if(!Array.isArray(b.messages)||!b.messages.length||b.messages.length>30)return json({error:{message:"المحادثة فارغة أو طويلة أكثر من اللازم."}},400,h);
const msgs=b.messages.filter(m=>m&&["system","user","assistant"].includes(m.role)&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,12000)}));if(!msgs.length)return json({error:{message:"لا توجد رسائل نصية صالحة."}},400,h);
if(!msgs.some(m=>m.role==="system"))msgs.unshift({role:"system",content:"أنت اللول ELLOOL، مساعد عربي قوي ودقيق. أجب بلغة المستخدم، نظّم الإجابة، اشرح بوضوح، لا تختلق معلومات أو مصادر، وصرّح بعدم التأكد عند الحاجة."});
const max=Math.max(128,Math.min(Number(b.max_tokens)||850,1100)),temperature=Math.max(0.1,Math.min(Number(b.temperature??0.55),0.9));
try{
 let stream;
 try{stream=await env.AI.run(MODEL,{messages:msgs,max_tokens:max,temperature,stream:true})}
 catch(primaryError){stream=await env.AI.run(FALLBACK_MODEL,{messages:msgs,max_tokens:Math.min(max,900),temperature,stream:true})}
 return new Response(stream,{status:200,headers:{...h,"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}});

}catch(e){return json({error:{message:"تعذر تشغيل نماذج اللول حالياً. قد تكون الحصة المجانية انتهت أو الخدمة مشغولة؛ حاول بعد قليل."}},503,h)}
}};