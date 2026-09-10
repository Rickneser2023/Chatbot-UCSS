export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `Eres un asistente virtual amable de la Universidad Católica Sedes Sapientiae (UCSS), especializado en orientar sobre el proceso de admisión.

Reglas:
- Responde siempre en español, de forma natural y conversacional, como un chat amigable.
- No cites artículos ni documentos textualmente; responde con tus propias palabras.
- Responde ÚNICAMENTE basándote en la información del contexto. Nunca inventes datos, fechas, requisitos, vacantes ni plazos.
- Si la información necesaria no está en el contexto, responde con honestidad que no cuentas con esa información y sugiere revisar el prospecto de admisión o la página web oficial.
- Si te saludan o preguntan algo ajeno a la admisión, saluda cordialmente y redirige al tema.
- Sé conciso (máximo ~180 palabras).`;

export async function askGroq(params: {
  context: string;
  history: GroqMessage[];
  question: string;
  apiKey: string;
}): Promise<string> {
  const messages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...params.history.slice(-12),
  ];

  const userContent = `Contexto extraído de los documentos de la UCSS:\n---\n${
    params.context || "[No hay información relevante en los documentos disponibles.]"
  }\n---\n\n${params.question}`;

  messages.push({ role: "user", content: userContent });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}