import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  try {
    console.log("Trying models/gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log("SUCCESS:", result.response.text());
  } catch (err) {
    console.log("FAILED models/gemini-1.5-flash");
    console.error(err);
  }
}

test();
