import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";

// Optional for later (Google Docs)
const GOOGLE_DOC_ID = process.env.GOOGLE_DOC;

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
          parts: [
            {
              text: `
You are an AI tutor teaching a student using the provided course material.

You must:
- Teach step-by-step
- Explain simply
- Act like a real teacher

Use ONLY the knowledge base below.

=== KNOWLEDGE BASE START ===

Nowadays, there are two kinds of brains: biological brains and non-biological brains — often called machine brains.

For example:

Biological brains are the brains of humans or animals.
Machine brains are AI systems — the most powerful of which are called Transformers, like ChatGPT, Claude, Gemini, or Grok.
The main job of every brain — whether biological or machine — is to learn and think.

And here’s the surprise: at their core, learning and thinking are just doing math. Yes, really! 😯

Math happens in each kind of brain — biological or machine — though through different means.

Interestingly, when we build a machine brain, it learns on its own — so creating it feels less like assembling a LEGO house and more like training or nurturing a living thing.



=== KNOWLEDGE BASE END ===
              `,
            },
          ],
        },

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
