// Vercel serverless proxy for Gemini. The API key stays server-side.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: {
        message: "لسه مفتاح Gemini مش متضبط على Vercel. أضف GEMINI_API_KEY في Environment Variables ثم أعد النشر. لا تضع المفتاح داخل الموقع أو ترسله في المحادثة."
      }
    });
  }

  try {
    const body = req.body || {};
    const model = String(body.model || "gemini-2.5-flash-lite");
    if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
      return res.status(400).json({ error: { message: "اسم نموذج Gemini غير صالح." } });
    }
    const input = Array.isArray(body.messages) ? body.messages : [];
    if (!input.length || input.length > 40) {
      return res.status(400).json({ error: { message: "المحادثة فارغة أو أطول من الحد المسموح." } });
    }

    let systemText = "";
    const contents = [];
    for (const item of input) {
      const role = item?.role;
      const text = typeof item?.content === "string" ? item.content.slice(0, 12000) : "";
      if (!text) continue;
      if (role === "system") {
        systemText += (systemText ? "\n\n" : "") + text;
        continue;
      }
      contents.push({
        role: role === "assistant" || role === "model" ? "model" : "user",
        parts: [{ text }]
      });
    }
    if (!contents.length) {
      return res.status(400).json({ error: { message: "لا توجد رسالة صالحة لإرسالها." } });
    }

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent";
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: Math.min(Math.max(Number(body.max_tokens) || 1200, 128), 4096),
          temperature: 0.7
        }
      })
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = payload?.error?.message || "تعذر الاتصال بخدمة Gemini.";
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
        error: { message: "Gemini: " + message }
      });
    }

    const answer = (payload?.candidates?.[0]?.content?.parts || [])
      .map(part => typeof part.text === "string" ? part.text : "")
      .join("");
    if (!answer.trim()) {
      return res.status(502).json({ error: { message: "النموذج لم يرجع نصاً. جرّب رسالة أخرى بعد قليل." } });
    }

    // Adapt the completed Gemini response to the OpenAI-compatible SSE format
    // already consumed by the frontend's streaming reader.
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write("data: " + JSON.stringify({ choices: [{ delta: { content: answer } }] }) + "\n\n");
    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (error) {
    return res.status(500).json({
      error: { message: error?.message || "حدث خطأ غير متوقع في خادم المحادثة." }
    });
  }
}
