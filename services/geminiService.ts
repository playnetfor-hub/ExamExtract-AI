import { GoogleGenAI, Type, Schema } from "@google/genai";
import { McqData, AppLanguage } from '../types';

// Define the response schema strictly for the model
const mcqSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING, description: "The full text of the question." },
      choiceA: { type: Type.STRING, description: "Option A text" },
      choiceB: { type: Type.STRING, description: "Option B text" },
      choiceC: { type: Type.STRING, description: "Option C text" },
      choiceD: { type: Type.STRING, description: "Option D text" },
      choiceE: { type: Type.STRING, description: "Option E text (optional)", nullable: true },
      correctAnswer: { type: Type.STRING, description: "The correct option letter (A, B, C, D, or E). If unknown, empty string.", nullable: true },
      passage: { type: Type.STRING, description: "Context passage if available.", nullable: true },
    },
    required: ["question", "choiceA", "choiceB", "choiceC", "choiceD"],
  },
};

export const analyzeDocumentContent = async (
  contentBase64: string,
  mimeType: string,
  language: AppLanguage
): Promise<McqData[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  // Construct a sophisticated prompt based on language
  let langContext = "The document language is auto-detected.";
  if (language === AppLanguage.ARABIC) {
    langContext = `
      STRICT ARABIC RULES:
      1. The text is predominantly Arabic (RTL).
      2. Questions might be numbered with Arabic numerals (١, ٢, ٣) or standard (1, 2, 3).
      3. Choices might be labelled as (أ, ب, ج, د). You MUST map them:
         - أ -> A
         - ب -> B
         - ج -> C
         - د -> D
         - هـ -> E
      4. Ensure you capture the full Arabic text without reversing words.
    `;
  } else if (language === AppLanguage.ENGLISH) {
    langContext = "The text is in English.";
  }

  let visualContext = "";
  if (mimeType === 'text/html') {
    visualContext = `
    INPUT TYPE: HTML (Converted from Word/DOCX).
    - Look for <strong>, <b>, or <u> tags. These often indicate the Correct Answer.
    - If a choice is wrapped in <span style="background-color: ..."> or similar, it is likely the answer.
    `;
  } else {
    visualContext = `
    INPUT TYPE: HIGH-RES IMAGE (Scanned Exam/PDF).
    - **LAYOUT ANALYSIS**: The page might have 1 or 2 columns. Read strictly in logical reading order (Column 1 then Column 2). Do not mix questions from adjacent columns.
    - **VISUAL MARKERS**: Look for:
      - Circles around letters (e.g., ⓐ).
      - Checkmarks (✓) next to options.
      - Bolded option text.
      - Different colored text (Red/Blue).
      - Hand-written marks indicating a selection.
    `;
  }

  const systemPrompt = `
    You are an expert Exam Digitization AI. Your goal is to extract Multiple Choice Questions (MCQs) from the provided input with 100% accuracy.

    ${langContext}
    ${visualContext}

    *** IMPORTANT EXTRACTION RULES ***
    
    1. **QUESTION IDENTIFICATION**: 
       - Find the question stem. It usually ends with '?', ':', or '...'.
       - Remove question numbers (e.g., "1. What is..." -> "What is...").

    2. **CHOICE EXTRACTION**:
       - Extract choices A, B, C, D (and E).
       - Choices might be vertical (list) or horizontal (e.g., "A) 5   B) 10   C) 15"). You must separate them correctly.
       - Remove labels like "A)", "a.", "(a)", "[A]" from the choice text.

    3. **CORRECT ANSWER LOGIC (Priority Order)**:
       1. **Visual Cue**: Is one option bolded, colored, underlined, or ticked? Use that.
       2. **Answer Key**: Is there a table at the bottom of the page/text labeled "Answer Key" or "Answers"? If so, lookup the answer for the current question number.
       3. **Inference**: If absolute NO markings exist, leave 'correctAnswer' as an empty string "". DO NOT GUESS.

    4. **PASSAGE LINKING**:
       - If a block of text says "Read the following passage and answer questions X to Y", extract that text into the 'passage' field for all applicable questions.

    5. **SANITIZATION**:
       - Fix OCR errors (e.g., '1l' -> 'll', 'rn' -> 'm').
       - Ensure strictly valid JSON output.

    Output format: JSON Array only. No markdown code blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: contentBase64,
              mimeType: mimeType
            }
          },
          { text: systemPrompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: mcqSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    let rawText = response.text;
    if (!rawText) return [];

    // Clean up potential markdown leakage
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(rawText);
    
    // Post-processing
    return parsed.map((item: any) => ({
      ...item,
      id: crypto.randomUUID(),
      choiceE: item.choiceE || undefined,
      passage: item.passage || undefined,
      correctAnswer: item.correctAnswer ? item.correctAnswer.trim().toUpperCase().replace(/[^A-E]/g, '') : ''
    }));

  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    
    // Specific error handling
    if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        throw new Error("Model not found. Please check API configuration.");
    }
    
    // For other errors, we might want to throw to the UI or return empty to continue batch
    // In this case, if a page fails, we interpret it as empty result but log it.
    return [];
  }
};