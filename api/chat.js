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

    // Set expiration time to 5 minutes (300 seconds)
    const EXPIRE_TIME = new Date(Date.now() + 300 * 1000).toISOString();

    const TOKEN_RESPONSE = await AI.authTokens.create({
      config: {
        uses: 1,
        expireTime: EXPIRE_TIME,
      },
    });

    const TOKEN_VALUE = TOKEN_RESPONSE.name || TOKEN_RESPONSE.value;

    RES.status(200).json({ token: TOKEN_VALUE });
  } catch (ERR) {
    console.error("Token generation error:", ERR);
    RES.status(500).json({ error: ERR.message || "Failed to generate ephemeral token" });
  }
}