const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (const m of ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]) {
    try {
      console.log("Testing:", m);
      const res = await ai.models.generateContent({
        model: m,
        contents: "Respond with: Hello world",
      });
      console.log("==> SUCCESS with:", m, "Output:", res.text);
      return m;
    } catch (e) {
      console.log("==> FAILED:", m, e.message);
    }
  }
}
main();
