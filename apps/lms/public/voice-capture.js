// Encode mono speech into 60 ms frames at 16 kHz. Leave the output silent.
class RoomVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Uint8Array(960);
    this.offset = 0;
    this.clock = 0;
    this.sum = 0;
    this.count = 0;
    this.logMu = Math.log(256);
  }

  process(inputs) {
    for (const sample of inputs[0]?.[0] ?? []) {
      this.sum += sample;
      this.count++;
      this.clock += 16000;
      if (this.clock < sampleRate) continue;
      this.clock -= sampleRate;
      const average = Math.max(-1, Math.min(1, this.sum / this.count));
      const magnitude = Math.log1p(255 * Math.abs(average)) / this.logMu;
      this.frame[this.offset++] =
        128 + Math.round(127 * Math.sign(average) * magnitude);
      this.sum = 0;
      this.count = 0;
      if (this.offset === this.frame.length) {
        this.port.postMessage({ frame: this.frame, time: currentTime }, [
          this.frame.buffer,
        ]);
        this.frame = new Uint8Array(960);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('room-voice-capture', RoomVoiceCapture);
