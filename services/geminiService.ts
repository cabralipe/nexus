import { GoogleGenAI } from "@google/genai";

export const generateInsight = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert educational and financial data analyst for a school management SaaS. Keep answers concise, professional, and actionable. Use Markdown formatting.",
      }
    });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate insight at this time. Please check your API key.";
  }
};

export const generateLessonPlan = async (subject: string, topic: string, duration: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Create a structured lesson plan for ${subject} on the topic "${topic}". Duration: ${duration}. Include Learning Objectives, Activities, and Assessment. Format as Markdown.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Could not generate lesson plan.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Error generating lesson plan.";
    }
}

export const analyzeFinancialHealth = async (data: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analyze this financial summary JSON and provide 3 key bullet points for the school director regarding cash flow and delinquency risks: ${data}`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Could not analyze data.";
    } catch (error) {
        return "Error analyzing financials.";
    }
}

export const generateSchoolDocument = async (studentName: string, docType: string, details: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Atue como secretário escolar. Redija um documento oficial do tipo "${docType}" para o aluno "${studentName}". Contexto/Detalhes: "${details}". O documento deve ter cabeçalho formal (EduSaaS Nexus), corpo do texto jurídico/administrativo, local e data (use a data de hoje), e espaço para assinatura. Use formatação Markdown.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Erro ao gerar documento.";
    } catch (error) {
        console.error(error);
        return "Erro de conexão com a IA.";
    }
}