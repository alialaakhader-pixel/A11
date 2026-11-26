// Free fallback image engine: AI Horde (community-powered, anonymous key, no cost).
// Slower than OVH (queue), so it is only used when the primary free engine is rate-limited.
export const config = { maxDuration: 300 };

const BLOCK = /\b(nude|naked|nsfw|porn|sex|sexual|erotic|explicit|gore|child ?abuse|loli|shota)\b|عاري|عارية|إباحي|اباحي|جنس|جنسي|فاضح/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'الطلب غير مدعوم.' }); }
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 1500) return res.status(400).json({ error: 'اكتب وصفًا للصورة لا يتجاوز 1500 حرف.' });
  if (BLOCK.test(prompt)) return res.status(400).json({ error: 'الوصف غير مناسب. الاستوديو لا ينشئ محتوى غير لائق.' });
  const headers = { apikey: '0000000000', 'Content-Type': 'application/json', 'Client-Agent': 'ellool-ai-studio:1.1:ellool' };
  const base = 'https://aihorde.net/api/v2';
  try {
    const sub = await fetch(`${base}/generate/async`, { method: 'POST', headers, body: JSON.stringify({
      prompt: prompt + ' ### low quality, blurry, deformed, watermark, text, nsfw, nudity',
      nsfw: false, censor_nsfw: true, trusted_workers: false, slow_workers: true, r2: false,
      params: { width: 512, height: 512, steps: 25, n: 1, sampler_name: 'k_euler_a', cfg_scale: 7 },
    }) });
    const job = await sub.json();
    if (!sub.ok || !job.id) return res.status(502).json({ error: 'خدمة الصور الاحتياطية غير متاحة الآن.' });
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000));
      const st = await (await fetch(`${base}/generate/check/${job.id}`, { headers })).json();
      if (st.faulted) break;
      if (st.done) {
        const out = await (await fetch(`${base}/generate/status/${job.id}`, { headers })).json();
        const g = out.generations?.[0];
        if (!g || g.censored) return res.status(422).json({ error: 'تم رفض الصورة بواسطة مرشح الأمان. جرّب وصفًا آخر.' });
        let img = g.img;
        if (typeof img === 'string' && /^https?:/.test(img)) { const b = Buffer.from(await (await fetch(img)).arrayBuffer()); img = b.toString('base64'); }
        return res.status(200).json({ image: `data:image/webp;base64,${img}`, width: 512, height: 512, model: g.model || 'ai-horde' });
      }
    }
    fetch(`${base}/generate/status/${job.id}`, { method: 'DELETE', headers }).catch(() => {});
    return res.status(504).json({ error: 'الطابور مزدحم الآن. جرّب بعد دقيقة.' });
  } catch (e) {
    console.error('horde failed', e);
    return res.status(502).json({ error: 'تعذر الاتصال بمحرك الصور الاحتياطي.' });
  }
}
