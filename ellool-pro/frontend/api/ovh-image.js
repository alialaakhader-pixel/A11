// Anonymous OVHcloud SDXL image generation proxy.
// This endpoint intentionally sends no API key or payment credentials.
// OVHcloud documents the model as Free and anonymous traffic at 2 requests/minute per IP/model.
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'الطلب غير مدعوم.' });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 5000) {
    return res.status(400).json({ error: 'اكتب وصفًا للصورة لا يتجاوز 5000 حرف.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 270000);

  try {
    const upstream = await fetch(
      'https://stable-diffusion-xl.endpoints.kepler.ai.cloud.ovh.net/api/text2image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/octet-stream'
        },
        // No Authorization header: use the provider's documented anonymous quota.
        body: JSON.stringify({
          prompt,
          negative_prompt: 'low quality, blurry, distorted, malformed, extra fingers, watermark, unreadable text'
        }),
        signal: controller.signal
      }
    );

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 700);
      if (upstream.status === 429) {
        res.setHeader('Retry-After', upstream.headers.get('retry-after') || '35');
        return res.status(429).json({ error: 'وصلنا للحد المجاني مؤقتًا. انتظر نصف دقيقة ثم جرّب مرة أخرى.' });
      }
      return res.status(upstream.status === 401 || upstream.status === 402 ? 503 : 502).json({
        error: 'خدمة الصور المجانية غير متاحة حاليًا. جرّب بعد قليل.',
        providerStatus: upstream.status,
        detail
      });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
      return res.status(502).json({ error: 'حجم الصورة الناتجة غير صالح.' });
    }

    let mime = upstream.headers.get('content-type') || '';
    if (!mime.startsWith('image/')) {
      if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = 'image/jpeg';
      else if (bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') mime = 'image/png';
      else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
      else return res.status(502).json({ error: 'الخدمة لم تُرجع ملف صورة صالحًا.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Image-Engine', 'OVHcloud-SDXL-Free');
    return res.status(200).json({
      image: `data:${mime};base64,${bytes.toString('base64')}`,
      width: 1024,
      height: 1024,
      model: 'stable-diffusion-xl-base-v10'
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('OVHcloud image generation failed:', error);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'التوليد استغرق وقتًا أطول من المتوقع. جرّب مرة أخرى.' : 'تعذر الاتصال بمحرك الصور المجاني الآن.'
    });
  } finally {
    clearTimeout(timer);
  }
}
