// A Web Audio stand-in that records the graph, gain values and scheduled starts, so the engine runs in Node.
import type { AudioContextLike } from '../src/engine/PlayerEngine';

const param = (value: number) => ({ value });

export class FakeNode {
  outputs: FakeNode[] = [];
  constructor(readonly kind: string) {}
  connect(n: FakeNode) {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
}

export class FakeGain extends FakeNode {
  gain = param(1);
  constructor() {
    super('gain');
  }
}

export class FakeBiquad extends FakeNode {
  type = 'lowpass';
  frequency = param(350);
  gain = param(0);
  constructor() {
    super('biquad');
  }
}

export class FakeCompressor extends FakeNode {
  threshold = param(-24);
  ratio = param(12);
  attack = param(0.003);
  release = param(0.25);
  constructor() {
    super('compressor');
  }
}

export class FakeBuffer {
  readonly length: number;
  copied = false;
  constructor(
    readonly duration: number,
    readonly sampleRate = 100,
    readonly numberOfChannels = 1,
  ) {
    this.length = Math.round(duration * sampleRate);
  }
  getChannelData() {
    return new Float32Array(this.length);
  }
  copyToChannel() {
    this.copied = true;
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started?: { when: number; offset: number };
  stoppedAt?: number;
  constructor() {
    super('source');
  }
  start(when: number, offset: number) {
    this.started = { when, offset };
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

export class FakeContext {
  currentTime = 0;
  destination = new FakeNode('destination');
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return new FakeBiquad();
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeBuffer(length / rate, rate, channels);
  }
  // the fake "audio file" is just its duration as a float64
  async decodeAudioData(data: ArrayBuffer) {
    return new FakeBuffer(new DataView(data).getFloat64(0));
  }
  async resume() {}
  /** sources currently sounding, by the gain node they feed */
  live() {
    return this.sources.filter((s) => s.started && s.stoppedAt === undefined);
  }
  asContext() {
    return this as unknown as AudioContextLike;
  }
}

/** fetch that serves `${stemsBase}/${channel}.ogg` as a fake file of the given duration, and 404 for anything else */
export function fakeFetch(files: Record<string, number>) {
  const requested: string[] = [];
  const fetch = async (url: string) => {
    requested.push(url);
    const duration = files[url];
    if (duration === undefined) return new Response(null, { status: 404 });
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, duration);
    return new Response(bytes, { headers: { 'content-length': '8' } });
  };
  return { fetch, requested };
}
