import HTTP from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";

const GOOGLE_DOC_ID = process.env.GOOGLE_DOC;

const SERVER = HTTP.createServer();
const WSS = new WebSocketServer({ server: SERVER });

WSS.on("connection", (WS) => {
  const AI = new GoogleGenAI({ apiKey: process.env.GOOGLE });
  let LIVE_SESSION = null;

  (async () => {
    LIVE_SESSION = await AI.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},

        systemInstruction: {
          parts: [
            {
              text: `
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
PARAMETER_change = ERROR
PARAMETER = PARAMETER + PARAMETER_change
Because the brain has just one PARAMETER — WEIGHT — we obtain:
SIMPLEST CHANGE RULE for WEIGHT
WEIGHT_change = ERROR
WEIGHT = WEIGHT + WEIGHT_change
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
WEIGHT_change = ERROR
WEIGHT = WEIGHT + WEIGHT_change
WEIGHT_change = ERROR = 3.0
WEIGHT = WEIGHT + WEIGHT_change = 0.0 + 3.0 = 3.0
So the WEIGHT becomes 3.0.
WEIGHT = 3.0
What just happened?
The brain has just improved itself.
Now, if it receives the same INPUT of 0.6, the OUTPUT becomes 1.8 (0.6 * 3.0) — which is closer to the TARGET (3.0) than the previous OUTPUT (0.0) was.
The ERROR becomes smaller:
ERROR = 1.2

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
        onmessage: (MESSAGE) => {
          WS.send(JSON.stringify(MESSAGE));
        },
        onerror: (ERR) => {
          console.error("Gemini Live error:", ERR);
        },
      },
    });
  })();

  WS.on("message", (DATA) => {
    if (LIVE_SESSION) {
      LIVE_SESSION.sendRealtimeInput({
        audio: {
          data: DATA.toString(),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    }
  });

  WS.on("close", () => {
    if (LIVE_SESSION) LIVE_SESSION.close();
  });
});

export default SERVER;