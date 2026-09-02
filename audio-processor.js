class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1600; // 100ms at 16kHz
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        // Clamp the signal to [-1, 1]
        const s = Math.max(-1, Math.min(1, channelData[i]));
        // Convert Float32 to Int16 PCM
        this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;

        if (this.bufferIndex >= this.bufferSize) {
          // Send the filled buffer and reset with a fresh array
          this.port.postMessage(this.buffer);
          this.buffer = new Int16Array(this.bufferSize);
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);