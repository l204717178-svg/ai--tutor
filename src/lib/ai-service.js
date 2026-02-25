import { GoogleGenerativeAI } from "@google/generative-ai";
import useFileStore from "../store/useFileStore";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const baseUrl = "http://127.0.0.1:8045";
const MODEL_NAME = "gemini-3-flash";

if (!API_KEY) {
    console.warn("VITE_GEMINI_API_KEY is missing. AI features will fail.");
}

/**
 * Helper to call the AI proxy via REST
 */
async function callAI(payload, modelOverride = MODEL_NAME) {
    const url = `${baseUrl}/v1beta/models/${modelOverride}:generateContent?key=${API_KEY}`;

    // Ensure every content has a role, mandatory for some proxy/model combinations
    const safePayload = {
        contents: payload.contents.map(c => ({
            role: c.role || "user",
            parts: c.parts
        }))
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload)
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error("AI Proxy Error:", responseText);
        throw new Error(`Proxy Error ${response.status}: ${responseText}`);
    }

    try {
        const data = JSON.parse(responseText);
        if (data.error) throw new Error(data.error.message);

        // Track Token Usage
        if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
            useFileStore.getState().addTokensUsed(data.usageMetadata.totalTokenCount);
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
        throw new Error(`Parse Error: ${e.message}`);
    }
}

export const listAvailableModels = async () => {
    if (!API_KEY) return "No API Key configured.";
    try {
        const response = await fetch(`${baseUrl}/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        if (data.error) {
            return `API Error: ${data.error.message}`;
        }
        return data.models ? data.models.map(m => m.name).join(", ") : "No models found.";
    } catch (e) {
        return `Network Error: ${e.message}`;
    }
}

export const generateStudyPlan = async (pdfText) => {
    if (!pdfText) return null;

    const prompt = `
    You are an expert academic mentor. Based on the following course material, generate a structured "Study Plan" (Knowledge Points Checklist).
    
    Format the output as a valid JSON object with the following structure:
    {
      "title": "Study Plan Title",
      "summary": "Brief overview of the material (2-3 sentences)",
      "modules": [
        {
          "title": "Module Title",
          "topics": [
            "Topic 1: Description",
            "Topic 2: Description"
          ]
        }
      ]
    }
    
    Do not wrap the JSON in markdown code blocks. Just return the raw JSON string.

    Course Material Content:
    ${pdfText.substring(0, 30000)}
    `;

    try {
        const text = await callAI({
            contents: [{ parts: [{ text: prompt }] }]
        });
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Error generating study plan:", error);
        throw error;
    }
};

export const translateToChinese = async (text, options = {}) => {
    if (!text || !text.trim()) return "";

    const chunks = splitTextIntoChunks(text, 1500);
    const outputs = [];

    for (const chunk of chunks) {
        if (options.isCancelled && options.isCancelled()) {
            throw new Error('Translation cancelled')
        }
        if (options.waitIfPaused) {
            await options.waitIfPaused()
        }
        const prompt = `
You are a professional translator for academic slides.
Translate the following content into Simplified Chinese.
Requirements:
1. Keep formulas, symbols, and variable names unchanged.
2. Preserve list markers like "-", "•", "1.", "(a)" and keep line order.
3. Do not reorder lines or add explanations. Return only the translated text.
4. Keep headings short and accurate; do not append extra words.

Content:
${chunk}
        `;

        try {
            const translatedText = await callAI({
                contents: [{ parts: [{ text: prompt }] }]
            });
            outputs.push(translatedText.trim());
        } catch (error) {
            throw new Error(`Translate API Error: ${error.message}`);
        }
    }

    return outputs.join('\n');
};

export const chatWithMentor = async (message, history, context) => {
    const systemPrompt = `You are a professional academic tutor. Your goal is to help students understand complex materials.
        
When responding:
1. Use **structured Markdown** (Headings, Bold, Lists, Tables).
2. For formulas, use Markdown code blocks or clear symbols.
3. If explaining technical terms, provide the Chinese translation in parentheses.
4. Keep the tone encouraging and professional.
5. If the user asks for a summary, use a table or a step-by-step list.

Context of the document:
${context ? context.substring(0, 30000) : "No document context."}`;

    const contents = [
        {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUnderstood?` }],
        },
        {
            role: "model",
            parts: [{ text: "Understood. I will provide structured, readable academic assistance using Markdown. What would you like to discuss from the materials?" }],
        },
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        })),
        {
            role: "user",
            parts: [{ text: message }]
        }
    ];

    try {
        return await callAI({ contents });
    } catch (error) {
        console.error("Chat error:", error);
        throw error;
    }
};

export const analyzeAssignment = async (pdfText) => {
    if (!pdfText) throw new Error("No document text provided.");

    const expectedSubparts = extractExpectedSubparts(pdfText);
    const prompt = (snippet) => `
You are an expert bilingual (English and Simplified Chinese) Academic Teaching Assistant. Your primary task is to solve engineering, physics, and robotics homework problems and present the solutions in a strictly structured, step-by-step format.

**Strict Formatting Rules:**
For every homework problem provided by the user, you MUST use the following exact markdown template. Do not deviate from this structure.

### 📝 Q[Number]. [English Topic] | [Chinese Topic]

> **题目：** [Complete Chinese Translation of the Question]

For each sub-question (a, b, c, etc.), follow this structure:

#### 🔹 ([Letter]) [English Sub-topic] | [Chinese Sub-topic]

**English Answer:**
[Step 1 logical explanation and math formulation]
[Step 2 intermediate calculation or final answer]

**中文答案：**
[Step 1 logical explanation and math formulation in Chinese]
[Step 2 intermediate calculation or final answer in Chinese]

---

**Core Directives:**
1. Step-by-Step Logic: Break down the solution into clear, distinct steps. Use paragraph breaks to separate steps.
2. Symmetry: The logical steps and derivations in the \`English Answer\` MUST perfectly match the structure of the \`中文答案\`.
3. Math Formatting: Use standard LaTeX formatting for all mathematical equations, variables, and units (e.g., $v=15\\ m/s$, $a_{max}=6\\ m/s^2$).
4. Semantic Markdown: ALWAYS use the markdown headings (\`###\`, \`####\`), blockquotes (\`>\`), and bold text (\`**\`) EXACTLY as shown in the template to ensure beautiful UI rendering.
5. Tone: Academic, precise, objective, and highly structured.
6. Coverage: You MUST answer ALL sub-questions that appear in the assignment text. If a sub-question is missing data, still include it and state "Insufficient information from the prompt" in both languages.
7. Order: Preserve the original order of sub-questions (a, b, c, ...).
8. Do NOT include the original English question text anywhere. Only provide the complete Chinese translation in the question block.

---
Here is the assignment file content to analyze and solve:
${snippet}
    `;

    try {
        const primary = await callAIWithRetry((limit) => callAI({
            contents: [{ parts: [{ text: prompt(pdfText.substring(0, limit)) }] }]
        }));
        const completed = await ensureAllSubpartsAnswered(primary, expectedSubparts, pdfText);
        return completed;
    } catch (error) {
        console.error("Error analyzing assignment:", error);
        throw error;
    }
};

function extractExpectedSubparts(text) {
    if (!text) return [];
    const matches = text.match(/\b\(([a-g])\)|\b([a-g])\)/gi) || [];
    const letters = new Set();
    for (const m of matches) {
        const letter = (m.match(/[a-g]/i) || [])[0];
        if (letter) letters.add(letter.toLowerCase());
    }
    return Array.from(letters).sort();
}

function extractAnsweredSubparts(text) {
    if (!text) return [];
    const matches = text.match(/####\s*🔹\s*\(([a-g])\)/gi) || [];
    const letters = new Set();
    for (const m of matches) {
        const letter = (m.match(/[a-g]/i) || [])[0];
        if (letter) letters.add(letter.toLowerCase());
    }
    return Array.from(letters).sort();
}

async function ensureAllSubpartsAnswered(primaryText, expectedSubparts, pdfText) {
    if (!expectedSubparts.length) return primaryText;
    const answered = extractAnsweredSubparts(primaryText);
    const missing = expectedSubparts.filter(l => !answered.includes(l));
    if (missing.length === 0) return primaryText;

    const followUpPrompt = (snippet) => `
You are continuing the same assignment. The previous answer missed these sub-questions: ${missing.map(l => `(${l})`).join(", ")}.

Please output ONLY the missing sub-question sections using the exact template below. Do not repeat any other sub-questions.

Template:
#### 🔹 ([Letter]) [English Sub-topic] | [Chinese Sub-topic]

**English Answer:**
[Step 1 ...]
[Step 2 ...]

**中文答案：**
[步骤 1 ...]
[步骤 2 ...]

---

Assignment content for reference:
${snippet}
    `;

    const followUpText = await callAIWithRetry((limit) => callAI({
        contents: [{ parts: [{ text: followUpPrompt(pdfText.substring(0, limit)) }] }]
    }));

    return `${primaryText}\n\n---\n\n${followUpText}`;
}

async function callAIWithRetry(fn, maxRetries = 2) {
    let lastError;
    let snippetLimit = 30000;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(snippetLimit);
        } catch (err) {
            lastError = err;
            const msg = `${err?.message || err}`;
            const isStreamError = msg.includes("Stream collection error") || msg.includes("error decoding response body");
            if (!isStreamError || attempt === maxRetries) break;
            snippetLimit = Math.max(12000, Math.floor(snippetLimit * 0.6));
            await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
    }
    throw lastError;
}

// --- Tavily Web Search Helper ---
async function searchWeb(query) {
    const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
    if (!apiKey) {
        console.log("No Tavily API Key found. Skipping web search.");
        return "";
    }

    try {
        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: "basic",
                max_results: 3
            })
        });

        if (!res.ok) {
            console.error("Tavily Error:", await res.text());
            return "";
        }

        const data = await res.json();
        return data.results.map(r => r.content).join("\n\n");
    } catch (e) {
        console.error("Failed to execute Web Search:", e);
        return "";
    }
}

function splitTextIntoChunks(text, maxLen) {
    const paragraphs = text.split(/\n+/).filter(Boolean);
    const chunks = [];
    let current = '';

    const pushCurrent = () => {
        if (current.trim()) chunks.push(current.trim());
        current = '';
    };

    for (const p of paragraphs) {
        if (p.length > maxLen) {
            pushCurrent();
            let start = 0;
            while (start < p.length) {
                const slice = p.slice(start, start + maxLen);
                chunks.push(slice.trim());
                start += maxLen;
            }
            continue;
        }

        if ((current + '\n' + p).length > maxLen) {
            pushCurrent();
            current = p;
        } else {
            current = current ? `${current}\n${p}` : p;
        }
    }

    pushCurrent();
    return chunks.length ? chunks : [text.slice(0, maxLen)];
}

export const generateMockExam = async (pdfText) => {
    if (!pdfText) throw new Error("No document text provided.");

    // Step 1: Query Generation (using Flash model)
    const qPrompt = `Read this course material and generate exactly 3 highly specific search queries to find related practice exams, academic tutorials, or deep concepts related to it on the web. Output a raw JSON array of 3 strings ONLY. \n\nMaterial snippet:\n${pdfText.substring(0, 10000)}`;

    let queries = [];
    try {
        const queriesText = await callAI({ contents: [{ parts: [{ text: qPrompt }] }] }, "gemini-3-flash");
        const cleanJson = queriesText.replace(/```json/g, '').replace(/```/g, '').trim();
        queries = JSON.parse(cleanJson);
        if (!Array.isArray(queries)) queries = [];
    } catch (e) {
        console.warn("Failed to generate queries from Flash, skipping web search.", e);
    }

    // Step 2: Fetch external context via Tavily
    let externalContext = "";
    if (queries.length > 0) {
        console.log("Executing Web Search for:", queries);
        for (const q of queries) {
            externalContext += await searchWeb(q) + "\n";
        }
    }

    // Step 3: Deep Synthesis with Pro Model (Huge context window up to 500,000 chars)
    const prompt = `
You are an advanced AI Researcher with "Deep Research" capabilities. Your task is to synthetically analyze ALL the provided document contexts and web search results, perform deep cross-referencing, and generate a highly comprehensive Mock Exam (预测试卷).

The student has uploaded multiple course materials. You must:
1. Synthesize the core concepts across all documents.
2. Identify patterns, underlying theories, and common pitfalls.
3. Generate a rigorous exam that tests deep understanding, not just surface-level memorization.

**Exam Structure (Strict Markdown Formatting):**

# 🎓 Deep Research Mock Exam | 深度统合预测试卷

## 📊 Research Summary | 考点深度洞察
[Write a 2-3 paragraph summary identifying the overarching themes connecting the different materials and what the student should focus on the most in Chinese.]

## 🔍 Part I: Cross-Concept Multiple Choice | 跨章节深度选择题 (5 Questions)
[Questions that require knowledge from multiple parts of the documents to answer correctly. Provide options A, B, C, D in both English and Chinese.]

## ✍️ Part II: Deep Analysis Short Answer | 深度解析简答题 (3 Questions)
[Scenario-based or calculation-heavy questions that test application of theory. Provide questions in both English and Chinese.]

## 🔑 Answer Key & Deep Explanations | 详尽解析与大模型研判
[Provide the answers with step-by-step reasoning. Do not just give the answer; explain *why* it's correct based on the text. Format equations using $LaTeX$ where necessary. Explain in both English and Chinese.]

---
EXTERNAL WEB KNOWLEDGE (If available):
${externalContext}
---
ALL UPLOADED DOCUMENTS KNOWLEDGE BASE:
${pdfText.substring(0, 500000)}
    `;

    try {
        // Use gemini-3.1-pro-high for deep synthesis
        return await callAI({
            contents: [{ parts: [{ text: prompt }] }]
        }, "gemini-3.1-pro-high");
    } catch (error) {
        console.error("Error generating deep research mock exam:", error);
        throw error;
    }
};
