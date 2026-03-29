import Groq from 'groq-sdk';

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        'VITE_GROQ_API_KEY is not set. Please provide it in your environment variables.'
      );
    }
    _groq = new Groq({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return _groq;
}

export const modelName = "llama-3.3-70b-versatile";

export async function generateRoadmap(syllabus: string, difficulty: string = 'beginner') {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: `You are an expert curriculum designer. Convert the user's syllabus into a structured learning roadmap with topics and descriptions tailored for a ${difficulty} level.`
      },
      {
        role: "user",
        content: `The roadmap should be progressive and clear. 
Return a JSON object with a single key "data" containing an array of objects.
Each object must have 'id' (string), 'title' (string), 'description' (string), and 'order' (number).
Syllabus: ${syllabus}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  const parsed = JSON.parse(completion.choices[0].message?.content || '{"data":[]}');
  return parsed.data;
}

export async function solveDoubt(topic: string, question: string) {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: `Context: Topic is ${topic}. Provide a clear, educational explanation.`
      },
      {
        role: "user",
        content: question
      }
    ],
  });
  return completion.choices[0].message?.content || "";
}

export async function generateQuiz(topic: string, description: string) {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: `You are an expert educator. Generate a 5-question multiple choice quiz for the topic: ${topic} (${description}).`
      },
      {
        role: "user",
        content: `Return a JSON object with a single key "data" containing an array of objects.
Each object must have 'question' (string), 'options' (array of 4 strings), and 'correctAnswer' (string matching one option).`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  const parsed = JSON.parse(completion.choices[0].message?.content || '{"data":[]}');
  return parsed.data;
}

export async function generateRevisionNotes(content: string) {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "user",
        content: `Summarize the following content into quick revision notes with bullet points. Content: ${content}`
      }
    ],
  });
  return completion.choices[0].message?.content || "";
}

export async function findYouTubeVideo(topic: string, description: string) {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "user",
        content: `Recommend the most relevant and high-quality educational YouTube video for the topic: "${topic}". 
Description: ${description}. 
Provide a likely real YouTube URL and a brief explanation of why it's good.`
      }
    ],
  });
  return completion.choices[0].message?.content || "";
}

export async function generateTopicSummary(topic: string, description: string) {
  const completion = await getGroq().chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "user",
        content: `Provide a concise, high-level summary of the following topic for a quick pre-quiz review. 
Topic: ${topic}
Description: ${description}
The summary should be around 2-3 sentences and capture the most critical concepts.`
      }
    ],
  });
  return completion.choices[0].message?.content || "";
}
