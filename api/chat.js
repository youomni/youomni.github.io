import { experimental_upgradeWebSocket } from "@vercel/functions";

export default async function handler(req) {
  const upgrade = req.headers.get("upgrade");

  if (upgrade !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const { socket, response } = experimental_upgradeWebSocket(req);

  socket.addEventListener("open", () => {
    console.log("Client connected");
  });

  socket.addEventListener("message", (event) => {
    console.log("Received:", event.data);
    // later Gemini Live API
  });

  socket.addEventListener("close", () => {
    console.log("Client disconnected");
  });

  return response;
}


