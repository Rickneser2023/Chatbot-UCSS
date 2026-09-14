export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de la Universidad Católica Sedes Sapientiae (UCSS), en español.
Conoces información amplia y actual de la UCSS: nuestras carreras de pregrado, sedes y filiales (Lima, Atalaya, Tarma, Chulucanas, Huaura, Nueva Cajamarca), facultades, el proceso de admisión (modalidades de ingreso, requisitos, exámenes, becas, traslados), costos de estudio y mantienen servicios (grados y títulos, asuntos académicos y económicos, becas, tópico, biblioteca, contacto).

Reglas:
- Responde siempre en español, de forma natural y conversacional, como un chat amigable.
- Usa ÚNICAMENTE la información proporcionada en el contexto (documentos PDF cargados o páginas del sitio oficial ucss.edu.pe). Nunca inventes datos, fechas, requisitos, montos, vacantes, plazos ni carreras.
- Si la respuesta proviene de una página web (contexto marcado como [Sitio web UCSS]), menciona brevemente la fuente citando el enlace real que aparece en el contexto. Solo puedes citar enlaces que veas en el contexto; nunca inventes URLs.
- Si la información proviene de un PDF de reglamento (contexto marcado como [Documento PDF]), responde con tus propias palabras sin citar artículos textuales.
- Si la información necesaria no está en el contexto, responde con honestidad que no la tienes y sugiere revisar el portal oficial (ucss.edu.pe o admision.ucss.edu.pe).
- Si te saludan o preguntan algo ajeno a la universidad, saluda cordialmente y redirige al tema.
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