import { describe, expect, it } from 'vitest';
import type { Song } from '../src/catalog/schema';
import { PlayerEngine, type PlayerEvents } from '../src/engine/PlayerEngine';
import { FakeBiquad, FakeCompressor, FakeContext, FakeGain, type FakeNode, fakeFetch } from './fake-audio';

const song: Song = {
  id: 'battle-a',
  title: 'Embers in the Pass',
  category: 'battle',
  authorship: 'test',
  channels: [
    { channel: 0, program: 48, name: 'Strings' },
    { channel: 1, program: 43, name: 'Contrabass' },
    { channel: 9, program: null, name: 'Drums' },
  ],
  versions: [
    { id: 'gm', label: 'MuseScore General', stemsBase: '/s/a', midi: '/m/a.mid', duration: 100 },
    { id: 'sc88p', label: 'SC-88Pro', stemsBase: '/s/a_sc88p/', midi: '/m/a.mid', duration: 100 },
    {
      id: 'tfg',
      label: 'TFG',
      stemsBase: '/s/a_tfg',
      midi: '/m/a_tfg.mid',
      duration: 100,
      // no General MIDI drum kit: the drums live on melodic channels
      channels: [
        { channel: 0, program: 6, name: 'Strings' },
        { channel: 1, program: 5, name: 'Celli' },
        { channel: 7, program: 22, name: 'Snare' },
      ],
    },
    { id: 'short', label: 'Short tail', stemsBase: '/s/a_short', midi: '/m/a.mid', duration: 90 },
  ],
  references: [],
  measurements: [],
  checks: [],
};

const files = {
  '/s/a/0.ogg': 100,
  '/s/a/1.ogg': 100,
  '/s/a/9.ogg': 100,
  '/s/a_sc88p/0.ogg': 100,
  '/s/a_sc88p/1.ogg': 100,
  '/s/a_sc88p/9.ogg': 100,
  '/s/a_tfg/0.ogg': 100,
  '/s/a_tfg/1.ogg': 100,
  '/s/a_tfg/7.ogg': 100,
  '/s/a_short/0.ogg': 90,
  '/s/a_short/1.ogg': 88, // shorter than its version's loop: must be padded
  '/s/a_short/9.ogg': 90,
};

async function setup(versionId?: string) {
  const ctx = new FakeContext();
  const net = fakeFetch(files);
  const frames: (() => void)[] = [];
  const engine = new PlayerEngine({
    context: ctx.asContext(),
    fetch: net.fetch,
    requestFrame: (cb) => {
      frames.push(cb);
      return () => undefined;
    },
  });
  await engine.setSong(song, versionId);
  return { ctx, net, engine, frames };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PlayerEngine mixer', () => {
  it('solo is exclusive, several channels can be soloed and mute wins', async () => {
    const { engine } = await setup();
    engine.setVolume(1, 0.5);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([1, 0.5, 1]);
    engine.setSoloed(1, true);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([0, 0.5, 0]);
    engine.setSoloed(9, true);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([0, 0.5, 1]);
    engine.setMuted(9, true);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([0, 0.5, 0]);
    engine.setSoloed(1, false);
    engine.setSoloed(9, false);
    engine.setMuted(9, false);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([1, 0.5, 1]);
  });

  it('writes the effective gain into the gain node each stem plays through', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    engine.setMuted(0, true);
    engine.setSoloed(9, true);
    // sources start in lane order (channels 0, 1, 9), each into its own gain
    expect(ctx.live().map((s) => (s.outputs[0] as FakeGain).gain.value)).toEqual([0, 0, 1]);
  });
});

describe('PlayerEngine treatment', () => {
  const path = (from: FakeNode): string[] => {
    const out: string[] = [];
    let n: FakeNode | undefined = from;
    while (n) {
      out.push(n.kind);
      n = n.outputs[0];
    }
    return out;
  };

  it('routes master straight to the output when off and through the filter chain when on', async () => {
    const { ctx, engine } = await setup();
    const master = ctx.gains[0]!;
    expect(path(master)).toEqual(['gain', 'destination']);
    engine.setTreated(true);
    expect(path(master)).toEqual(['gain', 'biquad', 'biquad', 'compressor', 'gain', 'compressor', 'destination']);
    let n = master.outputs[0] as FakeBiquad;
    expect([n.type, n.frequency.value]).toEqual(['highpass', 32]);
    n = n.outputs[0] as FakeBiquad;
    expect([n.type, n.frequency.value, n.gain.value]).toEqual(['highshelf', 2500, -6]);
    const comp = n.outputs[0] as FakeCompressor;
    expect([comp.threshold.value, comp.ratio.value, comp.attack.value, comp.release.value]).toEqual([
      -22, 3.5, 0.004, 0.12,
    ]);
    const makeup = comp.outputs[0] as FakeGain;
    expect(makeup.gain.value).toBe(1.4);
    const ceiling = makeup.outputs[0] as FakeCompressor;
    expect([ceiling.threshold.value, ceiling.ratio.value, ceiling.attack.value, ceiling.release.value]).toEqual([
      -3, 20, 0.001, 0.05,
    ]);
    engine.setTreated(false);
    expect(path(master)).toEqual(['gain', 'destination']);
  });

  it('keeps the mixer working in both modes', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    engine.setMuted(1, true);
    const channelGains = () => ctx.live().map((s) => (s.outputs[0] as FakeGain).gain.value);
    const before = channelGains();
    engine.setTreated(true);
    expect(channelGains()).toEqual(before);
    expect(before).toEqual([1, 0, 1]);
    // every channel gain still feeds the master
    for (const s of ctx.live()) expect(s.outputs[0]!.outputs[0]).toBe(ctx.gains[0]);
  });
});

describe('PlayerEngine transport', () => {
  it('starts every stem on the same tick at the same offset, with one loop length', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    const live = ctx.live();
    expect(live).toHaveLength(3);
    expect(new Set(live.map((s) => s.started!.when)).size).toBe(1);
    expect(live.every((s) => s.started!.offset === 0 && s.loop && s.loopEnd === 100)).toBe(true);
  });

  it('wraps the position at the loop end, and stops at the end when the loop is off', async () => {
    const { ctx, engine, frames } = await setup();
    await engine.play();
    ctx.currentTime = 0.05 + 130;
    expect(engine.position).toBeCloseTo(30);
    engine.setLoop(false);
    expect(ctx.live().every((s) => !s.loop)).toBe(true);
    expect(engine.position).toBeCloseTo(100);
    frames.at(-1)!();
    expect(engine.state).toBe('paused');
    expect(engine.position).toBe(0);
  });

  it('pauses and resumes at the same point, and seeks', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    ctx.currentTime = 0.05 + 12;
    engine.pause();
    expect(ctx.live()).toHaveLength(0);
    ctx.currentTime = 50;
    expect(engine.position).toBeCloseTo(12);
    await engine.play();
    expect(ctx.live().map((s) => s.started!.offset)).toEqual([12, 12, 12].map((x) => expect.closeTo(x, 6)));
    engine.seek(40);
    expect(ctx.live().map((s) => s.started!.offset)).toEqual([40, 40, 40].map((x) => expect.closeTo(x, 6)));
  });
});

describe('PlayerEngine versions', () => {
  it('A/B keeps the position and swaps each stem on a scheduled tick', async () => {
    const { ctx, engine, net } = await setup();
    await engine.play();
    ctx.currentTime = 0.05 + 42;
    const old = ctx.live();
    engine.setVersion('sc88p');
    await flush();
    await flush();
    expect(engine.version?.id).toBe('sc88p');
    expect(engine.position).toBeCloseTo(42);
    const fresh = ctx.live();
    expect(fresh).toHaveLength(3);
    for (const s of fresh) {
      expect(s.started!.when).toBeCloseTo(ctx.currentTime + 0.05);
      expect(s.started!.offset).toBeCloseTo(42.05); // the position at the tick it starts on
    }
    // the old stems end exactly where the new ones begin
    for (const s of old) expect(s.stoppedAt).toBeCloseTo(ctx.currentTime + 0.05);
    expect(net.requested.filter((u) => u.startsWith('/s/a_sc88p/'))).toHaveLength(3);
  });

  it('A/B to a shorter version keeps the same seconds, wrapped to its loop', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    ctx.currentTime = 0.05 + 95;
    engine.setVersion('short');
    expect(engine.position).toBeCloseTo(5);
    engine.pause();
    engine.setVersion('gm');
    expect(engine.position).toBeCloseTo(5);
  });

  it('A/B while paused moves the stored position only', async () => {
    const { engine, ctx } = await setup();
    engine.seek(30);
    engine.setVersion('sc88p');
    expect(engine.position).toBe(30);
    expect(ctx.live()).toHaveLength(0);
  });

  it('switching to a version with other channels changes the lanes and stops the missing ones', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    const drums = ctx.live()[2]!;
    engine.setVersion('tfg');
    expect(engine.channels.map((c) => c.channel)).toEqual([0, 1, 7]);
    expect(drums.stoppedAt).toBeDefined();
  });

  it('pads a stem shorter than the loop so no stem drifts', async () => {
    const { ctx, engine } = await setup('short');
    await engine.play();
    const live = ctx.live();
    expect(live.map((s) => s.loopEnd)).toEqual([90, 90, 90]);
    expect(live.map((s) => s.buffer!.duration)).toEqual([90, 90, 90]);
    expect(live[1]!.buffer!.copied).toBe(true);
  });

  it('plays one channel from another version, falling back when that version lacks the channel', async () => {
    const { ctx, engine, net } = await setup();
    engine.setChannelVersion(1, 'tfg');
    engine.setChannelVersion(9, 'tfg'); // tfg has no channel 9
    await flush();
    await flush();
    expect(engine.versionOf(1)?.id).toBe('tfg');
    expect(engine.versionOf(9)?.id).toBe('gm');
    expect(net.requested).toContain('/s/a_tfg/1.ogg');
    expect(net.requested).not.toContain('/s/a_tfg/9.ogg');
    await engine.play();
    expect(ctx.live()).toHaveLength(3);
    engine.setChannelVersion(1, null);
    expect(engine.versionOf(1)?.id).toBe('gm');
  });
});

describe('PlayerEngine events', () => {
  it('reports progress, state and errors', async () => {
    const ctx = new FakeContext();
    const net = fakeFetch({ '/s/a/0.ogg': 100, '/s/a/1.ogg': 100 }); // 9.ogg missing
    const engine = new PlayerEngine({
      context: ctx.asContext(),
      fetch: net.fetch,
      requestFrame: () => () => undefined,
    });
    const seen: { [K in keyof PlayerEvents]: PlayerEvents[K][] } = {
      time: [],
      state: [],
      progress: [],
      error: [],
      change: [],
    };
    engine.on('progress', (e) => seen.progress.push(e));
    engine.on('error', (e) => seen.error.push(e));
    engine.on('state', (e) => seen.state.push(e));
    await engine.setSong(song);
    expect(seen.progress.filter((p) => p.loaded === 1).map((p) => p.channel)).toEqual([0, 1]);
    expect(seen.error).toHaveLength(1);
    expect(seen.error[0]).toMatchObject({ versionId: 'gm', channel: 9 });
    expect([0, 9].map((c) => engine.stemStatus(c))).toEqual(['ready', 'error']);
    await engine.play();
    expect(ctx.live()).toHaveLength(2); // the missing stem never blocks the others
    expect(seen.state.map((s) => s.state)).toEqual(['playing']);
  });
});

describe('PlayerEngine change event', () => {
  it('fires on every setter and on a seek while paused, so shared views redraw', async () => {
    const { engine } = await setup();
    let n = 0;
    engine.on('change', () => n++);
    const calls: (() => void)[] = [
      () => engine.setMuted(0, true),
      () => engine.setSoloed(1, true),
      () => engine.setVolume(0, 0.5),
      () => engine.setMasterVolume(0.8),
      () => engine.setTreated(true),
      () => engine.setLoop(false),
      () => engine.seek(12),
      () => engine.setVersion('sc88p'),
      () => engine.setChannelVersion(0, 'gm'),
    ];
    for (const call of calls) {
      const before = n;
      call();
      expect(n).toBeGreaterThan(before);
    }
  });
});

describe('PlayerEngine regressions', () => {
  it('a solo on a channel the new version lacks does not silence every lane', async () => {
    const { ctx, engine } = await setup();
    await engine.play();
    engine.setSoloed(9, true);
    expect([0, 1].map((c) => engine.effectiveGain(c))).toEqual([0, 0]);
    engine.setVersion('tfg'); // tfg has no channel 9
    await flush();
    await flush();
    expect([0, 1, 7].map((c) => engine.effectiveGain(c))).toEqual([1, 1, 1]);
    expect(ctx.live().map((s) => (s.outputs[0] as FakeGain).gain.value)).toEqual([1, 1, 1]);
  });

  it('a new song starts with a fresh mixer', async () => {
    const { engine } = await setup();
    engine.setMuted(0, true);
    engine.setSoloed(1, true);
    engine.setVolume(9, 0.2);
    await engine.setSong(song);
    expect([0, 1, 9].map((c) => engine.effectiveGain(c))).toEqual([1, 1, 1]);
  });

  it('does not copy a stem that is short of the loop by resampling rounding only', async () => {
    const ctx = new FakeContext();
    const net = fakeFetch({ '/s/a/0.ogg': 99.9999, '/s/a/1.ogg': 100, '/s/a/9.ogg': 100 });
    const engine = new PlayerEngine({
      context: ctx.asContext(),
      fetch: net.fetch,
      requestFrame: () => () => undefined,
    });
    await engine.setSong(song);
    await engine.play();
    expect(ctx.live()[0]!.buffer!.duration).toBe(99.9999);
  });

  it('reuses the padded copy of a short stem on the next start', async () => {
    const { ctx, engine } = await setup('short');
    await engine.play();
    const padded = ctx.live()[1]!.buffer;
    engine.seek(10);
    expect(ctx.live()[1]!.buffer).toBe(padded);
  });

  it('sets the master volume on the master gain and ignores a second play while the first waits', async () => {
    const { ctx, engine, frames } = await setup();
    engine.setMasterVolume(0.7);
    expect(ctx.gains[0]!.gain.value).toBe(0.7);
    expect(engine.masterVolume).toBe(0.7);
    await Promise.all([engine.play(), engine.play()]);
    expect(ctx.live()).toHaveLength(3);
    expect(frames).toHaveLength(1);
  });
});
