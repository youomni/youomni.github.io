// ==== Settings ====
var WS_URL = "wss://youomni-github-io.vercel.app/api/chat";

var SOCKET = null;
var AUDIO_CONTEXT = null;
var MIC_STREAM = null;
var IS_TALKING = false;

var WORKLET_NODE = null;

// Playback state
var PLAYBACK_CONTEXT = null;
var PLAYBACK_TIME = 0;
var PLAYBACK_GAIN = null;
var SCHEDULED_SOURCES = [];
var OUTPUT_VOLUME = 2.0;

async function startTalking() {
  if (IS_TALKING) return;
  IS_TALKING = true;

  SOCKET = new WebSocket(WS_URL);

  SOCKET.onopen = async () => {
    await startMic();
  };

  SOCKET.onmessage = (event) => {
    handleServerMessage(event.data);
  };

  SOCKET.onclose = () => {
    stopMic();
  };

  SOCKET.onerror = (ERR) => {
    console.error("WebSocket error:", ERR);
  };
}

function stopTalking() {
  if (!IS_TALKING) return;
  IS_TALKING = false;

  stopMic();
  stopPlayback();

  if (SOCKET) SOCKET.close();
}

window.startTalking = startTalking;
window.stopTalking = stopTalking;

// =========================
// MICROPHONE (AudioWorklet)
// =========================
async function startMic() {
  MIC_STREAM = await navigator.mediaDevices.getUserMedia({ audio: true });

  AUDIO_CONTEXT = new AudioContext({ sampleRate: 16000 });

  await AUDIO_CONTEXT.audioWorklet.addModule("/audio-processor.js");

  const SOURCE = AUDIO_CONTEXT.createMediaStreamSource(MIC_STREAM);

  WORKLET_NODE = new AudioWorkletNode(AUDIO_CONTEXT, "mic-processor");

  WORKLET_NODE.port.onmessage = (EVENT) => {
    if (!IS_TALKING || !SOCKET || SOCKET.readyState !== WebSocket.OPEN) return;

    const PCM16 = EVENT.data; // Int16Array
    const BASE64_DATA = arrayBufferToBase64(PCM16.buffer);
    SOCKET.send(BASE64_DATA);
  };

  SOURCE.connect(WORKLET_NODE);
  WORKLET_NODE.connect(AUDIO_CONTEXT.destination);
}

function stopMic() {
  if (WORKLET_NODE) {
    WORKLET_NODE.disconnect();
    WORKLET_NODE = null;
  }

  if (MIC_STREAM) {
    MIC_STREAM.getTracks().forEach((T) => T.stop());
    MIC_STREAM = null;
  }

  if (AUDIO_CONTEXT) {
    AUDIO_CONTEXT.close();
    AUDIO_CONTEXT = null;
  }
}

function arrayBufferToBase64(BUFFER) {
  let BINARY = "";
  const BYTES = new Uint8Array(BUFFER);
  for (let I = 0; I < BYTES.byteLength; I++) {
    BINARY += String.fromCharCode(BYTES[I]);
  }
  return btoa(BINARY);
}

// =========================
// SERVER AUDIO HANDLING
// =========================
function handleServerMessage(RAW_DATA) {
  let MESSAGE;
  try {
    MESSAGE = JSON.parse(RAW_DATA);
  } catch (E) {
    console.error(E);
    return;
  }

  if (MESSAGE?.serverContent?.outputTranscription?.text) {
    if (typeof window.advanceFocusToText === "function") {
      window.advanceFocusToText(MESSAGE.serverContent.outputTranscription.text);
    }
  }

  if (MESSAGE?.serverContent?.interrupted) {
    stopPlayback();
    return;
  }

  const PARTS = MESSAGE?.serverContent?.modelTurn?.parts;
  if (!PARTS) return;

  for (const PART of PARTS) {
    const AUDIO_BASE64 = PART?.inlineData?.data;
    if (AUDIO_BASE64) playAudioChunk(AUDIO_BASE64);
  }
}

// =========================
// PLAYBACK
// =========================
function stopPlayback() {
  for (const SOURCE of SCHEDULED_SOURCES) {
    try { SOURCE.stop(); } catch {}
  }
  SCHEDULED_SOURCES = [];
}

function playAudioChunk(BASE64_DATA) {
  if (!PLAYBACK_CONTEXT) {
    PLAYBACK_CONTEXT = new AudioContext({ sampleRate: 24000 });
    PLAYBACK_TIME = PLAYBACK_CONTEXT.currentTime;

    PLAYBACK_GAIN = PLAYBACK_CONTEXT.createGain();
    PLAYBACK_GAIN.gain.value = OUTPUT_VOLUME;
    PLAYBACK_GAIN.connect(PLAYBACK_CONTEXT.destination);
  }

  const BINARY = atob(BASE64_DATA);
  const BYTES = new Uint8Array(BINARY.length);
  for (let I = 0; I < BINARY.length; I++) {
    BYTES[I] = BINARY.charCodeAt(I);
  }

  const DATA_VIEW = new DataView(BYTES.buffer);
  const INT16_COUNT = Math.floor(BYTES.length / 2);
  const FLOAT32 = new Float32Array(INT16_COUNT);

  for (let I = 0; I < INT16_COUNT; I++) {
    const INT16_VAL = DATA_VIEW.getInt16(I * 2, true);
    FLOAT32[I] = INT16_VAL / 32768.0;
  }

  const BUFFER = PLAYBACK_CONTEXT.createBuffer(1, FLOAT32.length, 24000);
  BUFFER.copyToChannel(FLOAT32, 0);

  const SOURCE = PLAYBACK_CONTEXT.createBufferSource();
  SOURCE.buffer = BUFFER;
  SOURCE.connect(PLAYBACK_GAIN);

  const NOW = PLAYBACK_CONTEXT.currentTime;
  const START_AT = Math.max(NOW, PLAYBACK_TIME);

  SOURCE.start(START_AT);
  PLAYBACK_TIME = START_AT + BUFFER.duration;

  SCHEDULED_SOURCES.push(SOURCE);

  SOURCE.onended = () => {
    SCHEDULED_SOURCES = SCHEDULED_SOURCES.filter((S) => S !== SOURCE);
  };
}