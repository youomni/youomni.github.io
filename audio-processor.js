class MicProcessor extends AudioWorkletProcessor {
  process(INPUTS) {
    const INPUT = INPUTS[0];
    if (INPUT && INPUT[0]) {
      const CHANNEL_DATA = INPUT[0];

      const PCM16 = new Int16Array(CHANNEL_DATA.length);
      for (let I = 0; I < CHANNEL_DATA.length; I++) {
        const S = Math.max(-1, Math.min(1, CHANNEL_DATA[I]));
        PCM16[I] = S < 0 ? S * 0x8000 : S * 0x7fff;
      }

      this.port.postMessage(PCM16);
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);