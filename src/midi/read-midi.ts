// Minimal Standard MIDI File reader for the piano roll: notes in seconds (tempo map applied), the first tempo and the
// first program of each channel. Channels are 0-based, as in the MIDI bytes (drums = 9).

export interface MidiNote {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  pitch: number;
  /** 0-based MIDI channel */
  channel: number;
}

export interface Midi {
  notes: MidiNote[];
  /** tempo at tick 0 */
  bpm: number;
  /** first program change seen on each channel */
  programs: Map<number, number>;
  /** end of the last note, in seconds */
  duration: number;
}

export class MidiParseError extends Error {
  override name = 'MidiParseError';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Scientific pitch name: 60 is C4. */
export const noteName = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

const DEFAULT_TEMPO = 500_000; // microseconds per quarter note (120 bpm) until a tempo event says otherwise

export function readMidi(buffer: ArrayBuffer): Midi {
  const d = new DataView(buffer);
  const tag = (o: number) =>
    String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
  if (d.byteLength < 14 || tag(0) !== 'MThd') throw new MidiParseError('Not a Standard MIDI File (no MThd header)');
  const trackCount = d.getUint16(10);
  const ppq = d.getUint16(12);
  if (ppq & 0x8000) throw new MidiParseError('SMPTE time division is not supported');

  const tempos: [tick: number, usPerQuarter: number][] = [[0, DEFAULT_TEMPO]];
  const raw: { tick: number; pitch: number; channel: number; on: boolean }[] = [];
  const programs = new Map<number, number>();
  let o = 14;
  try {
    for (let k = 0; k < trackCount; k++) {
      if (tag(o) !== 'MTrk') throw new MidiParseError(`Track ${k} has no MTrk header at byte ${o}`);
      const trackEnd = o + 8 + d.getUint32(o + 4);
      if (trackEnd > d.byteLength) throw new MidiParseError(`Track ${k} runs past the end of the file`);
      o += 8;
      let tick = 0;
      let status = 0;
      const varLen = () => {
        let v = 0;
        let b: number;
        do {
          b = d.getUint8(o++);
          v = (v << 7) | (b & 0x7f);
        } while (b & 0x80);
        return v;
      };
      while (o < trackEnd) {
        tick += varLen();
        if (d.getUint8(o) & 0x80) status = d.getUint8(o++); // otherwise running status: reuse the last one
        if (status === 0xff) {
          const type = d.getUint8(o++);
          const len = varLen();
          if (type === 0x51) tempos.push([tick, (d.getUint8(o) << 16) | (d.getUint8(o + 1) << 8) | d.getUint8(o + 2)]);
          o += len;
        } else if (status === 0xf0 || status === 0xf7) {
          o += varLen();
        } else {
          const type = status & 0xf0;
          const channel = status & 15;
          const a = d.getUint8(o++);
          const b = type === 0xc0 || type === 0xd0 ? 0 : d.getUint8(o++);
          if (type === 0xc0 && !programs.has(channel)) programs.set(channel, a);
          // note-on with velocity 0 is a note-off by the spec
          if (type === 0x90 || type === 0x80) raw.push({ tick, pitch: a, channel, on: type === 0x90 && b > 0 });
        }
      }
      o = trackEnd;
    }
  } catch (e) {
    if (e instanceof MidiParseError) throw e;
    throw new MidiParseError(`Truncated MIDI data near byte ${o}`);
  }

  // stable sort keeps file order for equal ticks, so a tempo set at tick 0 later in the file still wins over the default
  tempos.sort((x, y) => x[0] - y[0]);
  const seconds = (tick: number) => {
    let s = 0;
    let [lastTick, us] = tempos[0]!;
    for (const [t, next] of tempos.slice(1)) {
      if (t >= tick) break;
      s += ((t - lastTick) * us) / ppq / 1e6;
      [lastTick, us] = [t, next];
    }
    return s + ((tick - lastTick) * us) / ppq / 1e6;
  };
  // offs before ons on the same tick, so a repeated note closes the old one before opening the new one
  raw.sort((x, y) => x.tick - y.tick || Number(x.on) - Number(y.on));
  const open = new Map<number, number>(); // channel*128+pitch -> start in seconds
  const notes: MidiNote[] = [];
  for (const e of raw) {
    const key = e.channel * 128 + e.pitch;
    if (e.on) open.set(key, seconds(e.tick));
    else {
      const start = open.get(key);
      if (start === undefined) continue;
      notes.push({ start, end: seconds(e.tick), pitch: e.pitch, channel: e.channel });
      open.delete(key);
    }
  }
  const initial = tempos.filter((x) => x[0] === 0).pop()![1];
  return { notes, bpm: 6e7 / initial, programs, duration: Math.max(0, ...notes.map((n) => n.end)) };
}
