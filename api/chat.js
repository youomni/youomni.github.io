import { GoogleGenAI } from "@google/genai";

export default async function handler(REQ, RES) {
  // Enable CORS for your GitHub Pages origin
  RES.setHeader("Access-Control-Allow-Origin", "*");
  RES.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  RES.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (REQ.method === "OPTIONS") {
    RES.status(200).end();
    return;
  }

  if (!process.env.GOOGLE) {
    RES.status(500).json({ error: "Missing process.env.GOOGLE API key" });
    return;
  }

  try {
    const AI = new GoogleGenAI({ apiKey: process.env.GOOGLE });

    // Request an ephemeral client token for Gemini Multimodal Live API
    const CLIENT_TOKEN = await AI.auth.createClientToken({
      config: {
        uses: 1,
        ttl: "300s", // Valid for 5 minutes
      },
    });

    RES.status(200).json({ token: CLIENT_TOKEN.value });
  } catch (ERR) {
    console.error("Token generation error:", ERR);
    RES.status(500).json({ error: "Failed to generate ephemeral token" });
  }
}