import { GoogleGenAI, Modality } from "@google/genai";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server starting on port ${PORT}`);

wss.on("connection", (ws) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE });
  let liveSession = null;

  (async () => {
    try {
      liveSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [
              {
                text: `You are an AI tutor teaching a student using the provided course material.`
              }
            ]
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
              endOfSpeechSensitivity: "END_SENSITIVITY_HIGH"
            }
          }
        },
        callbacks: {
          onmessage: (message) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(message));
            }
          },
          onerror: (err) => {
            console.error("Gemini Live error:", err);
          }
        }
      });
    } catch (e) {
      console.error("Connection failed:", e);
    }
  })();

  ws.on("message", (data) => {
    if (liveSession) {
      liveSession.sendRealtimeInput({
        audio: {
          data: data.toString(),
          mimeType: "audio/pcm;rate=16000"
        }
      });
    }
  });

  ws.on("close", () => {
    if (liveSession) liveSession.close();
  });
});
