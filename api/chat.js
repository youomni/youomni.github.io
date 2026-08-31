import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE });
  let liveSession = null;

  (async () => {
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: {
          parts: [{ text: "Ты дружелюбный AI-учитель для детей." }],
        },
        // More sensitive voice activity detection so the model notices
        // sooner when the user starts talking, and lets itself be interrupted.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
          },
        },
      },
      callbacks: {
        onmessage: (message) => {
          ws.send(JSON.stringify(message));
        },
        onerror: (err) => {
          console.error("Gemini Live error:", err);
        },
      },
    });
  })();

  ws.on("message", (data) => {
    if (liveSession) {
      liveSession.sendRealtimeInput({
        audio: {
          data: data.toString(),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    }
  });

  ws.on("close", () => {
    if (liveSession) liveSession.close();
  });
});

export default server;
