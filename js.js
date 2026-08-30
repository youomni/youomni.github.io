// ==== Settings ====
const WS_URL = "wss://youomni-github-io.vercel.app/api/chat";

let socket = null;
let audioContext = null;
let micStream = null;
let processorNode = null;
let isTalking = false;

// Playback state for streaming the teacher's audio response in chunks
let playbackContext = null;
let playbackTime = 0;

async function startTalking() {
  if (isTalking) return;
  isTalking = true;

  socket = new WebSocket(WS_URL);

  socket.onopen = async () => {
    await startMic();
  };

  socket.onmessage = (event) => {
    handleServerMessage(event.data);
  };

  socket.onclose = () => {
    stopMic();
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

function stopTalking() {
  if (!isTalking) return;
  isTalking = false;
  stopMic();
  if (socket) socket.close();
}

// Exposed so the existing button's click handler can call them
window.startTalking = startTalking;
window.stopTalking = stopTalking;

// ==== Microphone capture and streaming ====
async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(micStream);

  processorNode = audioContext.createScriptProcessor(4096, 1, 1);

  // Zero gain so we don't hear our own mic echoed back,
  // while keeping the audio graph active
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  source.connect(processorNode);
  processorNode.connect(silentGain);
  silentGain.connect(audioContext.destination);

  processorNode.onaudioprocess = (event) => {
    if (!isTalking || !socket || socket.readyState !== WebSocket.OPEN) return;

    const floatData = event.inputBuffer.getChannelData(0);
    const pcmData = floatTo16BitPCM(floatData);
    const base64Data = arrayBufferToBase64(pcmData.buffer);

    socket.send(base64Data);
  };
}

function stopMic() {
  if (processorNode) processorNode.disconnect();
  if (micStream) micStream.getTracks().forEach((track) => track.stop());
  if (audioContext) audioContext.close();
  processorNode = null;
  micStream = null;
  audioContext = null;
}

function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ==== Receiving and playing back the teacher's response ====
function handleServerMessage(rawData) {
  console.log("Server message:", rawData);

  let message;
  try {
    message = JSON.parse(rawData);
  } catch (e) {
    console.error("Failed to parse server message:", e);
    return;
  }

  // The exact shape of the Gemini Live response may differ —
  // this part will most likely need adjusting based on real console logs.
  const parts = message?.serverContent?.modelTurn?.parts;
  if (!parts) return;

  for (const part of parts) {
    const audioBase64 = part?.inlineData?.data;
    if (audioBase64) {
      playAudioChunk(audioBase64);
    }
  }
}

function playAudioChunk(base64Data) {
  if (!playbackContext) {
    playbackContext = new AudioContext({ sampleRate: 24000 });
    playbackTime = playbackContext.currentTime;
  }

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16Data = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 0x8000;
  }

  const audioBuffer = playbackContext.createBuffer(
    1,
    float32Data.length,
    24000
  );
  audioBuffer.copyToChannel(float32Data, 0);

  const sourceNode = playbackContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(playbackContext.destination);

  const now = playbackContext.currentTime;
  const startAt = Math.max(now, playbackTime);
  sourceNode.start(startAt);
  playbackTime = startAt + audioBuffer.duration;
}
