

import { experimental_upgradeWebSocket } from "@vercel/functions";
import { GoogleGenAI, Modality } from "@google/genai";

export default async function handler(req) {
  const upgrade = req.headers.get("upgrade");

  if (upgrade !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const { socket, response } = experimental_upgradeWebSocket(req);

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE });
  let liveSession = null;

  socket.addEventListener("open", async () => {
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: {
          parts: [{ text: "Ты дружелюбный AI-учитель для детей." }],
        },
      },
      callbacks: {
        onmessage: (message) => {
          socket.send(JSON.stringify(message));
        },
      },
    });
  });

  socket.addEventListener("message", (event) => {
    if (liveSession) {
      liveSession.sendRealtimeInput({ media: event.data });
    }
  });

  socket.addEventListener("close", () => {
    if (liveSession) liveSession.close();
  });

  return response;
}

