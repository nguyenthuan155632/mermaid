import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  return genAI;
}

export async function fixMermaidDiagram(
  code: string,
  errorMessage: string
): Promise<{ fixedCode: string; explanation: string }> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const prompt = `You are a Mermaid diagram syntax expert. Fix the following Mermaid diagram code that has an error.

Error message: ${errorMessage}

Broken Mermaid code:
\`\`\`
${code}
\`\`\`

IMPORTANT: Return ONLY the final, complete corrected Mermaid code. Do not include:
- Step-by-step explanations
- Multiple versions or iterations
- Markdown formatting or code blocks
- Process descriptions
- Any text before or after the code

Return ONLY the raw Mermaid code that is 100% correct and ready to use.

Format your response as JSON:
{
  "fixedCode": "the final corrected mermaid code here",
  "explanation": "brief explanation of the fix"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        fixedCode: parsed.fixedCode || code,
        explanation: parsed.explanation || "Fixed syntax error",
      };
    }

    // Fallback: return the text as fixed code
    return {
      fixedCode: text.trim().replace(/```mermaid\n?/g, "").replace(/```\n?/g, "").trim(),
      explanation: "AI fixed the syntax error",
    };
  } catch (error) {
    console.error("Failed to fix diagram with AI:", error);
    throw new Error("Failed to fix diagram with AI");
  }
}

