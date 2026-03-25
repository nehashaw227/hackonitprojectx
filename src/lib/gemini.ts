import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const roadmapModel = "gemini-3-flash-preview";
export const chatModel = "gemini-3-flash-preview";

export async function generateRoadmap(syllabus: string, difficulty: string = 'beginner') {
  const response = await ai.models.generateContent({
    model: roadmapModel,
    contents: `Convert the following syllabus into a structured learning roadmap with topics and descriptions tailored for a ${difficulty} level. 
    The roadmap should be progressive and clear. 
    Return a JSON array of objects with 'id', 'title', 'description', and 'order'. 
    Syllabus: ${syllabus}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            order: { type: Type.NUMBER }
          },
          required: ["id", "title", "description", "order"]
        }
      }
    }
  });
  return JSON.parse(response.text);
}

export async function solveDoubt(topic: string, question: string) {
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: `Context: Topic is ${topic}. Question: ${question}. Provide a clear, educational explanation.`,
  });
  return response.text;
}

export async function generateQuiz(topic: string, description: string) {
  const response = await ai.models.generateContent({
    model: roadmapModel,
    contents: `Generate a 5-question multiple choice quiz for the topic: ${topic} (${description}). Return a JSON array of objects with 'question', 'options' (array of 4), and 'correctAnswer'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswer"]
        }
      }
    }
  });
  return JSON.parse(response.text);
}

export async function generateRevisionNotes(content: string) {
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: `Summarize the following content into quick revision notes with bullet points. Content: ${content}`,
  });
  return response.text;
}

export async function findYouTubeVideo(topic: string, description: string) {
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: `Find the most relevant and high-quality educational YouTube video for the topic: "${topic}". 
    Description: ${description}. 
    Provide the YouTube URL and a brief explanation of why it's good.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return response.text;
}

export async function generateTopicSummary(topic: string, description: string) {
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: `Provide a concise, high-level summary of the following topic for a quick pre-quiz review. 
    Topic: ${topic}
    Description: ${description}
    The summary should be around 2-3 sentences and capture the most critical concepts.`,
  });
  return response.text;
}
