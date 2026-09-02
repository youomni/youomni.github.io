// ==== Settings ====
var VERCEL_TOKEN_URL = "https://youomni-github-io.vercel.app/api/chat";

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

const SYSTEM_INSTRUCTION_TEXT = `
You are an AI tutor teaching a student using the provided course material.

You must:
- literally read the text word by word, including each headline
- Teach and explain step-by-step according to precisely this text
- Explain simply
- Act like a real teacher
- Speak in the language the student is speaking

Use ONLY the knowledge base below.

=== KNOWLEDGE BASE START ===
Lesson 1:

HOW
MACHINES
LEARN AND
THINK
Lesson 1
Our First Machine Brain
Introduction
A NEURON needs at least one PARAMETER to do anything useful.
So our NEURON will have one: WEIGHT.
To learn from its own ERRORS, our NEURON also needs a CHANGE RULE — to change its PARAMETER step by step.

Brain
We're going to build a machine brain that can multiply any number by 5.0.
In this scenario, the INPUT represents the number being multiplied, and the OUTPUT represents the result of the multiplication.
Let's call this brain the Multiplier-by-Five.
As said, the brain will have a single PARAMETER: WEIGHT.
The brain will be a formula like this:
OUTPUT = INPUT * WEIGHT
We need to find the correct PARAMETER: WEIGHT.
Initial PARAMETER
Suppose we don't yet know what the PARAMETER should be, so let's start by setting it to zero:
WEIGHT = 0.0
At first, the brain will generate nonsense, since with any INPUT the OUTPUT is zero.
Dataset
We will use this training DATASET, which has two EXAMPLES:

 INPUT 
 TARGET 
 EXAMPLE1 
 0.6 
 3.0 
 EXAMPLE2 
 1.0 
 5.0 

The TARGET represents the correct OUTPUT.
EXAMPLE1 means when the INPUT is 0.6, the OUTPUT must be 3.0.
EXAMPLE2 means when the INPUT is 1.0, the OUTPUT must be 5.0.
So, our DATASET contains two EXAMPLES:
EXAMPLES = 2
During TRAINING, in each LESSON, the brain changes its PARAMETER so that the OUTPUT gets closer to the TARGET.
Change Rule
The brain changes the PARAMETER using this CHANGE RULE:
SIMPLEST CHANGE RULE for PARAMETER
PARAMETER_update = ERROR
PARAMETER = PARAMETER + PARAMETER_update
Because the brain has just one PARAMETER — WEIGHT — we obtain:
SIMPLEST CHANGE RULE for WEIGHT
WEIGHT_update = ERROR
WEIGHT = WEIGHT + WEIGHT_update
Don't worry — each step is simple. Just follow the calculations below.
Training
LESSON 1
WEIGHT = 0.0
EXAMPLE1:
INPUT = 0.6
TARGET = 3.0
Forward Pass
PRODUCT = INPUT * WEIGHT = 0.6 * 0.0 = 0.0
OUTPUT = PRODUCT = 0.0
Error
ERROR = TARGET − OUTPUT = 3.0 − 0.0 = 3.0
The ERROR tells us how far the OUTPUT is off from the TARGET.

Backward Pass
The brain changes the PARAMETER that caused this ERROR.
Imagine the brain asking itself:
"How should I change my WEIGHT so the OUTPUT gets closer to the TARGET?"
The ERROR provides the answer:
"Your OUTPUT is 3.0 below the TARGET, so increase the WEIGHT by the exact same 3.0."
And that's exactly what the SIMPLEST CHANGE RULE tells us to do:
SIMPLEST CHANGE RULE for WEIGHT
WEIGHT_update = ERROR
WEIGHT = WEIGHT + WEIGHT_update
WEIGHT_update = ERROR = 3.0
WEIGHT = WEIGHT + WEIGHT_update = 0.0 + 3.0 = 3.0
So the WEIGHT becomes 3.0.
WEIGHT = 3.0
What just happened?
The brain has just improved itself.
Now, if it receives the same INPUT of 0.6, the OUTPUT becomes 1.8 (0.6 * 3.0) — which is closer to the TARGET (3.0) than the previous OUTPUT (0.0) was.
The ERROR becomes smaller:
ERROR = 1.2

=== KNOWLEDGE BASE END ===
`;

async function startTalking() {
  if (IS_TALKING) return;
  IS_TALKING = true;

  try {
    // 1. Fetch ephemeral token from Vercel
    const RESPONSE = await fetch(VERCEL_TOKEN_URL);
    if (!RESPONSE.ok) {
      const ERROR_DATA = await RESPONSE.json().catch(() => ({}));
      console.error("HTTP error fetching token:", RESPONSE.status, ERROR_DATA);
      IS_TALKING = false;
      return;
    }

    const DATA = await RESPONSE.json();

    if (!DATA.token) {
      console.error("Failed to retrieve token:", DATA);
      IS_TALKING = false;
      return;
    }

    // 2. Open direct WebSocket connection using v1alpha endpoint and access_token parameter
    const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${DATA.token}`;
    SOCKET = new WebSocket(GEMINI_WS_URL);

    SOCKET.onopen = async () => {
      console.log("WebSocket connected to Gemini");

      // Send initial setup payload using gemini-2.0-flash-exp on v1alpha
      const SETUP_PAYLOAD = {
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION_TEXT }]
          }
        }
      };

      SOCKET.send(JSON.stringify(SETUP_PAYLOAD));
      await startMic();
    };

    SOCKET.onmessage = (EVENT) => {
      handleServerMessage(EVENT.data);
    };

    SOCKET.onclose = (EVENT) => {
      console.log("WebSocket closed:", EVENT.code, EVENT.reason);
      stopMic();
    };

    SOCKET.onerror = (ERR) => {
      console.error("WebSocket error:", ERR);
    };
  } catch (E) {
    console.error("Failed to initialize session:", E);
    IS_TALKING = false;
  }
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

    const PCM16_DATA = EVENT.data; // Int16Array from mic-processor
    const BASE64_DATA = arrayBufferToBase64(PCM16_DATA.buffer);

    const AUDIO_PAYLOAD = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: BASE64_DATA
          }
        ]
      }
    };

    SOCKET.send(JSON.stringify(AUDIO_PAYLOAD));
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

  if (PLAYBACK_CONTEXT.state === "suspended") {
    PLAYBACK_CONTEXT.resume();
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