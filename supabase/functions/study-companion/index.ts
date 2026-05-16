import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type StudyRequest = {
  question?: string;
  studentSolution?: string;
  subject?: string;
  level?: string;
  mode?: string;
  imageDataUrl?: string;
  questionImageDataUrl?: string;
  solutionImageDataUrl?: string;
  preferredLanguage?: "bangla" | "english" | "mixed";
  requestType?: "question" | "step_marking";
};

type StepMarkingStep = {
  step: string;
  status: "correct" | "partial" | "wrong";
  feedback: string;
};

const criticalLanguagePrefix = {
  bangla: "CRITICAL INSTRUCTION: তুমি অবশ্যই সম্পূর্ণ বাংলায় উত্তর দেবে। কোনো ইংরেজি শব্দ ব্যবহার করবে না।",
  english: "CRITICAL INSTRUCTION: You MUST respond ENTIRELY in English. Do not use any Bangla/Bengali words whatsoever. Every single word of your response must be in English only.",
  mixed: "CRITICAL INSTRUCTION: Respond in a mix of Bangla and English. Use Bangla for explanations but keep technical terms, equations and examples in English.",
};

const languageInstructions = {
  bangla: "সম্পূর্ণ বাংলা ভাষায় উত্তর দাও। কোনো English ব্যবহার করবে না।",
  english: "Answer completely in English only. Do not use any Bangla. All explanations, steps, summaries, and labels must be in English.",
  mixed: "Respond in a mix of Bangla and English. Use Bangla for explanations, English for technical terms and equations.",
};

const systemPrompt = `You are Poralekha AI — a highly accurate academic tutor for SSC and HSC students in Bangladesh. You follow the NCTB (National Curriculum and Textbook Board) curriculum strictly.

STRICT RULES you must always follow:
- Never guess. If you are not fully certain about an answer, say "আমি নিশ্চিত নই, তবে..." and clearly flag it.
- Never make up facts, formulas, dates, or definitions. Only use what is in the NCTB syllabus.
- Always show step-by-step working for Math, Physics, and Chemistry problems. Never skip steps.
- For definition questions, give the exact textbook definition first, then explain in simple words.
- For essay or Bangla literature questions, always mention the author, book name, and chapter before answering.
- If the student's question is vague or incomplete, ask one clarifying question before answering. Do not assume.
- Never answer questions that are outside SSC/HSC academic subjects. Politely redirect: "এই প্রশ্নটি আমার বিষয়ের বাইরে। পড়ালেখা সম্পর্কিত প্রশ্ন করো।"
- Always end every answer with a short 2-line summary of the key point.

Preserve mathematical symbols, equations, fractions, exponents, roots, inequalities, variables, units, and chemical formulas accurately.

CRITICAL FORMATTING RULES for math, physics, and chemistry:
- For inline math (within a sentence), wrap in single dollar signs: $x^2 + 2x + 1$
- For block math (centered, on its own line), wrap in double dollar signs: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$
- Use proper LaTeX syntax: \\frac{a}{b} for fractions, \\sqrt{x} for square roots, \\int for integrals, ^{} for superscripts, _{} for subscripts.
- Greek letters: \\alpha, \\beta, \\theta, \\pi, \\Delta, etc.
- Multiplication: use \\times or \\cdot. Units inside math: \\text{ N}, \\text{ kg}, \\text{ m/s}^2.
- Vectors: \\vec{F}. Implications: \\Rightarrow.
- Never write math as plain text like x^2, sqrt(x), or 1/2. ALWAYS use LaTeX delimiters.
- This rule applies equally to step-by-step marking: every step text, feedback, and full solution must use $...$ or $$...$$ for math.`;

const buildPrompt = (subject: string, question: string, language: string, level: string, mode: string) => `
Subject: ${subject}
Student's Question: ${question}
Curriculum: Bangladesh NCTB SSC/HSC
Level: ${level}
Mode: ${mode}
Answer Language: ${language}

Answer this question accurately following NCTB curriculum only.
Show all steps if it is a math or science problem.
If unsure, say so clearly.
`;

async function callAI(apiKey: string, messages: unknown[]) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      max_tokens: 4000,
      temperature: 0.3,
      messages,
    }),
  });
}

async function getConfidence(apiKey: string, question: string, answer: string) {
  try {
    const response = await callAI(apiKey, [
      { role: "system", content: "Rate factual accuracy for Bangladesh SSC/HSC academic answers. Reply with ONLY one word: High, Medium, or Low." },
      { role: "user", content: `Rate the factual accuracy of this answer for an SSC/HSC Bangladesh student on a scale of 1 to 3 only. Reply with ONLY one word: "High", "Medium", or "Low". Question: ${question}. Answer: ${answer}` },
    ]);
    if (!response.ok) return "Medium";
    const data = await response.json();
    const rating = String(data.choices?.[0]?.message?.content ?? "Medium").trim();
    return ["High", "Medium", "Low"].includes(rating) ? rating : "Medium";
  } catch (_) {
    return "Medium";
  }
}

function extractJsonObject(content: string) {
  const cleaned = content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function getStepMarking(apiKey: string, question: string, studentSolution: string, subject: string, level: string, questionImageDataUrl = "", solutionImageDataUrl = "") {
  const stepMarkingPrompt = `
You are a strict but helpful SSC/HSC board examiner in Bangladesh following NCTB marking scheme.

The student has submitted their solution to a problem step by step.
Your job is to evaluate EACH step individually.

For every step the student wrote, respond with:
- ✅ সঠিক — if the step is completely correct
- ⚠️ আংশিক সঠিক — if the step is partially correct, explain what is missing
- ❌ ভুল — if the step is wrong, explain exactly why it is wrong and show the correct working for that step

After checking all steps:
- Give a total score out of 10 following board exam marking style
- Write a 2 line overall feedback in Bangla
- Show the complete correct solution at the end for comparison

Be encouraging but never hide mistakes. A student must know exactly where they went wrong.

CRITICAL MATH FORMATTING: In every "step", "feedback", "overallFeedback", and "correctSolution" string, wrap inline math in $...$ and block math in $$...$$. Use LaTeX (\\frac, \\sqrt, \\times, ^{}, _{}, \\vec{}, \\text{}). Never write math as plain text like x^2, sqrt(x), or F=ma — write $x^2$, $\\sqrt{x}$, $F = ma$.

Student's Question: ${question || "Provided as an uploaded image"}
Student's Solution (each line is one step):
${studentSolution || "Provided as an uploaded image"}
`;

  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: `Subject: ${subject}\nLevel: ${level}` },
  ];

  if (question.trim()) userContent.push({ type: "text", text: `Student's Question (typed): ${question}` });
  if (questionImageDataUrl.startsWith("data:image/")) {
    userContent.push({ type: "image_url", image_url: { url: questionImageDataUrl } });
    userContent.push({ type: "text", text: "The image above is the question the student needs to solve. Read it carefully before marking." });
  }
  if (studentSolution.trim()) userContent.push({ type: "text", text: `Student's Solution (typed):\n${studentSolution}` });
  if (solutionImageDataUrl.startsWith("data:image/")) {
    userContent.push({ type: "image_url", image_url: { url: solutionImageDataUrl } });
    userContent.push({ type: "text", text: "The image above is the student's handwritten solution. Read each step from the image carefully and mark each step." });
  }
  userContent.push({ type: "text", text: "Now check each step of the student's solution individually following NCTB SSC/HSC marking scheme. Mark each step as correct, partially correct, or wrong with explanation in Bangla." });

  const messages = [
    { role: "system", content: `${stepMarkingPrompt}\nReturn ONLY valid JSON with this shape: {"steps":[{"step":"original student step","status":"correct|partial|wrong","feedback":"Bangla feedback with ✅/⚠️/❌ label"}],"score":7,"overallFeedback":"two Bangla lines","correctSolution":"complete correct solution in Bangla with LaTeX math where needed"}` },
    { role: "user", content: userContent },
  ];

  let response = await callAI(apiKey, messages);
  if (!response.ok) response = await callAI(apiKey, messages);
  if (!response.ok) throw new Error("AI marking failed");
  const data = await response.json();
  let content = String(data.choices?.[0]?.message?.content ?? "");
  if (!content.trim()) {
    const retryResponse = await callAI(apiKey, messages);
    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      content = String(retryData.choices?.[0]?.message?.content ?? "");
    }
  }
  const parsed = extractJsonObject(content);
  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  return {
    steps: steps.map((item: StepMarkingStep) => ({
      step: String(item.step ?? ""),
      status: ["correct", "partial", "wrong"].includes(item.status) ? item.status : "partial",
      feedback: String(item.feedback ?? "⚠️ আংশিক সঠিক — আরও বিস্তারিত দরকার।"),
    })),
    score: Math.max(0, Math.min(10, Number.parseInt(String(parsed.score ?? 0), 10) || 0)),
    overallFeedback: String(parsed.overallFeedback ?? "ভালো চেষ্টা। ভুল ধাপগুলো ঠিক করে আবার অনুশীলন করো।"),
    correctSolution: String(parsed.correctSolution ?? "সম্পূর্ণ সঠিক সমাধান তৈরি করা যায়নি।"),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, studentSolution = "", subject = "সাধারণ", level = "SSC", mode = "ব্যাখ্যা", imageDataUrl, questionImageDataUrl = "", solutionImageDataUrl = "", preferredLanguage: rawLang, requestType = "question" } = await req.json() as StudyRequest;
    const preferredLanguage: "bangla" | "english" | "mixed" = (rawLang === "english" || rawLang === "mixed") ? rawLang : "bangla";
    console.log("Answer language received:", preferredLanguage, "| raw value:", rawLang);
    const languageInstruction = languageInstructions[preferredLanguage];
    const criticalPrefix = criticalLanguagePrefix[preferredLanguage];

    const trimmedQuestion = question?.trim() ?? "";
    const hasQuestion = Boolean(trimmedQuestion && trimmedQuestion.length >= 5 && trimmedQuestion.length <= 1000);
    const hasImage = Boolean(imageDataUrl?.startsWith("data:image/"));

    if (requestType !== "step_marking" && !hasQuestion) {
      return new Response(JSON.stringify({ error: trimmedQuestion.length > 1000 ? "প্রশ্নটি অনেক বড়। ১০০০ অক্ষরের মধ্যে রাখুন।" : "প্রশ্নটি অনেক ছোট। আরেকটু বিস্তারিত লিখুন।" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI key is not configured");

    if (requestType === "step_marking") {
      const trimmedSolution = studentSolution.trim();
      const hasStepQuestion = Boolean(trimmedQuestion || questionImageDataUrl.startsWith("data:image/"));
      const hasStepSolution = Boolean(trimmedSolution || solutionImageDataUrl.startsWith("data:image/"));
      if (!hasStepQuestion || !hasStepSolution) {
        return new Response(JSON.stringify({ error: !hasStepQuestion ? "প্রশ্ন লিখুন অথবা প্রশ্নের ছবি আপলোড করুন।" : "সমাধান লিখুন অথবা সমাধানের ছবি আপলোড করুন।" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const marking = await getStepMarking(LOVABLE_API_KEY, trimmedQuestion, trimmedSolution, subject, level, questionImageDataUrl, solutionImageDataUrl);
      return new Response(JSON.stringify({ marking }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = buildPrompt(subject, trimmedQuestion, preferredLanguage, level, mode);
    const messages = [
      { role: "system", content: `${criticalPrefix}\n\n${systemPrompt}\n\n${languageInstruction}` },
      {
        role: "user",
        content: hasImage ? [
          { type: "text", text: `${userPrompt}\nScreenshot দেখে problem statement শনাক্ত করো, তারপর markdown-এ ধাপে ধাপে সমাধান দাও। কোনো লেখা অস্পষ্ট হলে একটি clarifying question করো।` },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ] : userPrompt,
      },
    ];

    let response = await callAI(LOVABLE_API_KEY, messages);
    if (!response.ok) response = await callAI(LOVABLE_API_KEY, messages);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "অনেক বেশি অনুরোধ হয়েছে, একটু পরে চেষ্টা করুন।" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage credit শেষ হয়েছে। Workspace usage settings দেখুন।" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const details = await response.text();
      console.error("AI gateway error", response.status, details);
      return new Response(JSON.stringify({ error: "AI উত্তর তৈরি করতে সমস্যা হয়েছে।" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let answer = data.choices?.[0]?.message?.content ?? "";
    if (!answer.trim()) {
      const retryResponse = await callAI(LOVABLE_API_KEY, messages);
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        answer = retryData.choices?.[0]?.message?.content ?? "";
      }
    }
    if (!answer.trim()) answer = "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করো।";
    const confidence = await getConfidence(LOVABLE_API_KEY, trimmedQuestion, answer);

    return new Response(JSON.stringify({ answer, confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("study-companion error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
