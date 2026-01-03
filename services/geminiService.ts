const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type ApiResponse = {
  text?: string;
  error?: string;
};

const postJson = async (path: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
};

export const generateInsight = async (prompt: string): Promise<string> => {
  try {
    const response = await postJson("/insights/", { prompt });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("API Error:", error);
    return "Could not generate insight at this time. Please check your API key.";
  }
};

export const generateLessonPlan = async (subject: string, topic: string, duration: string): Promise<string> => {
  try {
    const response = await postJson("/lesson-plans/", { subject, topic, duration });
    return response.text || "Could not generate lesson plan.";
  } catch (error) {
    console.error("API Error:", error);
    return "Error generating lesson plan.";
  }
};

export const analyzeFinancialHealth = async (data: string): Promise<string> => {
  try {
    const response = await postJson("/financial-health/", { data });
    return response.text || "Could not analyze data.";
  } catch (error) {
    return "Error analyzing financials.";
  }
};

export const generateSchoolDocument = async (studentName: string, docType: string, details: string): Promise<string> => {
  try {
    const response = await postJson("/school-documents/", {
      student_name: studentName,
      doc_type: docType,
      details,
    });
    return response.text || "Erro ao gerar documento.";
  } catch (error) {
    console.error(error);
    return "Erro de conexao com a IA.";
  }
};
