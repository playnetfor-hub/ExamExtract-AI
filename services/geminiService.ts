import { GoogleGenAI, Type, Schema } from "@google/genai";
import { McqData, AppLanguage } from '../types';

// Define the response schema strictly for the model
const mcqSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING, description: "Question text." },
      choiceA: { type: Type.STRING, description: "Option A" },
      choiceB: { type: Type.STRING, description: "Option B" },
      choiceC: { type: Type.STRING, description: "Option C" },
      choiceD: { type: Type.STRING, description: "Option D" },
      choiceE: { type: Type.STRING, description: "Option E (optional)", nullable: true },
      correctAnswer: { type: Type.STRING, description: "Correct letter (A-E). Empty if unknown.", nullable: true },
      passage: { 
        type: Type.STRING, 
        description: "The FULL text of the reading passage or context. MUST be repeated for EVERY question linked to it.", 
        nullable: true 
      },
    },
    required: ["question", "choiceA", "choiceB", "choiceC", "choiceD"],
  },
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isRetryable = error.message?.includes('503') || error.message?.includes('429');
      if (i === retries - 1 || !isRetryable) throw error;
      await wait(1000 * Math.pow(2, i));
    }
  }
}

export const analyzeDocumentContent = async (
  pages: string[], 
  mimeType: string,
  language: AppLanguage
): Promise<McqData[]> => {
  // CRITICAL: Robust API Key Retrieval for Browser Environments
  // We check multiple locations to ensure we find the key if it exists
  let apiKey: string | undefined = undefined;

  // 1. Check standard process.env (Node/Bundlers)
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    apiKey = process.env.API_KEY;
  }
  
  // 2. Check window.process.env (Browser Polyfill)
  if (!apiKey && typeof window !== 'undefined') {
    const win = window as any;
    apiKey = win.process?.env?.API_KEY;
  }

  if (!apiKey) {
    console.error("Environment Configuration Error: API_KEY is missing from process.env and window.process.env");
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is configured in your environment.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  // Using gemini-3-flash-preview for optimal speed/intelligence ratio for text tasks
  const modelName = 'gemini-3-flash-preview';

  let langInstruction = "";
  if (language === AppLanguage.ARABIC) {
    langInstruction = `Processing Arabic Document (RTL). Standardize numbers to Western (1,2,3). Standardize Arabic letters (أ,ب,ج,د) to (A,B,C,D).`;
  }

  // System instructions are more powerful than simple prompts
  const systemInstruction = `
    You are an expert Document Analysis AI specialized in extracting MCQs (Multiple Choice Questions) to structured JSON.
    ${langInstruction}
    
    VISUAL DETECTION RULES (HIGHEST PRIORITY):
    1. HIGHLIGHTS = CORRECT ANSWER: If an option has a background color (Yellow, Green, Gray, Pink), it IS the correct answer. This is the #1 signal.
    2. MARKS: Checkmarks (✓), Circles around letters, or Colored text (e.g., Red) indicate correct answers.
    3. STYLES: Bold or Underline (if only one option has it) indicates the answer.

    EXTRACTION RULES:
    1. EXTRACT ALL: Process the entire input batch. Extract every single question found. Do not summarize.
    2. PASSAGE LINKING (CRITICAL): 
       - If a text/story/passage appears, it applies to the questions that follow it.
       - You MUST copy the FULL passage text into the "passage" field for EVERY question linked to it.
       - Even if the passage was on Page 1 and the question is on Page 2, include the passage.
    3. CLEANUP: Remove "Q1", "1.", "a)" prefixes from values.
  `;

  const contentParts = pages.map(p => ({
    inlineData: { data: p, mimeType: mimeType }
  }));

  // Simple user prompt to trigger the system instruction
  contentParts.push({ text: "Extract all MCQs from these pages into the specified JSON format." } as any);

  try {
    const response = await generateWithRetry(ai, {
      model: modelName,
      contents: {
        parts: contentParts
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: mcqSchema,
        temperature: 0.1, // Low temperature for deterministic results
        thinkingConfig: { thinkingBudget: 0 } // Speed optimization
      }
    });

    let rawText = response.text;
    if (!rawText) return [];

    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawText);
    
    return parsed.map((item: any) => ({
      ...item,
      id: crypto.randomUUID(),
      choiceE: item.choiceE || undefined,
      passage: item.passage || undefined,
      correctAnswer: item.correctAnswer ? item.correctAnswer.trim().toUpperCase().replace(/[^A-E]/g, '') : ''
    }));

  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    return [];
  }
};