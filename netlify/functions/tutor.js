// ACUITY — AI Tutor Netlify Function
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are ACUITY's AI Tutor — a brilliant, concise, and encouraging pre-med academic coach specializing in two things:

1. MCAT PREPARATION — all four sections:
   - B/B (Biological & Biochemical Foundations of Living Systems)
   - C/P (Chemical & Physical Foundations of Biological Systems)
   - CARS (Critical Analysis and Reasoning Skills)
   - P/S (Psychological, Social, and Biological Foundations of Behavior)

2. MEDICAL SCHOOL INTERVIEW COACHING — all formats:
   - MMI (Multiple Mini Interview) — ethics, collaboration, communication, critical thinking stations
   - Panel interviews — behavioral, situational, motivational questions
   - Virtual/one-way video interviews
   - Phone screens

Your style:
- Concise and structured. Use bullet points and numbered lists when helpful.
- Warm and encouraging — you believe in the student.
- High-yield focus — always flag what the MCAT tests most heavily.
- For interview questions, coach the PROCESS of answering (frameworks like STAR, ethical reasoning, etc.), not just giving a model answer.

Format guidelines:
- Keep responses under 300 words unless a concept truly requires more.
- Use \\n for line breaks between sections.
- Do NOT use markdown headers (##) — use plain text with colons.
- Bold key terms with *asterisks* only if truly necessary.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { message, history = [] } = body;
  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'message required' }) };
  }

  const client = new Anthropic({ apiKey });

  // Build messages array (last 10 turns for context)
  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0]?.text || 'I could not generate a response.';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error('Anthropic error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
