// ==== Settings ====
const WS_URL = "wss://youomni-github-io.vercel.app/api/chat";

let socket = null;
let audioContext = null;
let micStream = null;
let isTalking = false;

let workletNode = null;

// Playback state
let playbackContext = null;
let playbackTime = 0;
let playbackGain = null;
let scheduledSources = [];
const OUTPUT_VOLUME = 2.0;

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
  stopPlayback();

  if (socket) socket.close();
}

window.startTalking = startTalking;
window.stopTalking = stopTalking;

// =========================
// MICROPHONE (AudioWorklet)
// =========================
async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioContext = new AudioContext({ sampleRate: 16000 });

  // Absolute path — audio-processor.js lives at repo root and is shared
  // across all lesson pages (e.g. /lesson1/lesson1.html, /lesson2/lesson2.html, ...)
  await audioContext.audioWorklet.addModule("/audio-processor.js");

  const source = audioContext.createMediaStreamSource(micStream);

  workletNode = new AudioWorkletNode(audioContext, "mic-processor");

  workletNode.port.onmessage = (event) => {
    if (!isTalking || !socket || socket.readyState !== WebSocket.OPEN) return;

    const pcm16 = event.data; // Int16Array
    const base64Data = arrayBufferToBase64(pcm16.buffer);
    socket.send(base64Data);
  };

  source.connect(workletNode);
  workletNode.connect(audioContext.destination);
}

function stopMic() {
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// =========================
// SERVER AUDIO HANDLING
// =========================
function handleServerMessage(rawData) {
  let message;
  try {
    message = JSON.parse(rawData);
  } catch (e) {
    console.error(e);
    return;
  }

  const parts = message?.serverContent?.modelTurn?.parts;
  const hasAudio = Array.isArray(parts) && parts.some((p) => p?.inlineData?.data);

  // Skip logging when the message carries raw audio chunks — those are
  // huge base64 blobs that flood the console and are useless to read.
  if (!hasAudio) {
    console.log("RAW MESSAGE:", JSON.stringify(message, null, 2)); // TEMP DEBUG
  }

  if (message?.serverContent?.outputTranscription?.text) {
    window.advanceFocusToText(message.serverContent.outputTranscription.text);
  }

  if (message?.serverContent?.interrupted) {
    stopPlayback();
    return;
  }

  if (!parts) return;

  for (const part of parts) {
    const audioBase64 = part?.inlineData?.data;
    if (audioBase64) playAudioChunk(audioBase64);
  }
}

// =========================
// PLAYBACK
// =========================
function stopPlayback() {
  for (const source of scheduledSources) {
    try { source.stop(); } catch {}
  }
  scheduledSources = [];
}

function playAudioChunk(base64Data) {
  if (!playbackContext) {
    playbackContext = new AudioContext({ sampleRate: 24000 });
    playbackTime = playbackContext.currentTime;

    playbackGain = playbackContext.createGain();
    playbackGain.gain.value = OUTPUT_VOLUME;
    playbackGain.connect(playbackContext.destination);
  }

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);

  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }

  const buffer = playbackContext.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);

  const source = playbackContext.createBufferSource();
  source.buffer = buffer;
  source.connect(playbackGain);

  const now = playbackContext.currentTime;
  const startAt = Math.max(now, playbackTime);

  source.start(startAt);
  playbackTime = startAt + buffer.duration;

  scheduledSources.push(source);

  source.onended = () => {
    scheduledSources = scheduledSources.filter((s) => s !== source);
  };
}
