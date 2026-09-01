class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];

    if (input && input[0]) {
      const floatData = input[0];

      const pcm16 = new Int16Array(floatData.length);

      for (let i = 0; i < floatData.length; i++) {
        let s = Math.max(-1, Math.min(1, floatData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(pcm16);
    }

    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
