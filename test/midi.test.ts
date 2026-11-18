import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MidiParseError, noteName, readMidi } from '../src/midi/read-midi';

const track = (...events: number[]) => [
  ...[0x4d, 0x54, 0x72, 0x6b], // MTrk
  ...[0, 0, 0, events.length],
  ...events,
];
const smf = (...tracks: number[][]) =>
  new Uint8Array([
    ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6], // MThd, length 6
    ...[0, 1, 0, tracks.length, 0, 96], // format 1, 96 ticks per quarter
    ...tracks.flat(),
  ]).buffer;

// tempo track: 60 bpm at tick 0, 120 bpm from tick 192 (2 s in)
const tempo = track(
  ...[0x00, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40],
  ...[0x81, 0x40, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20], // delta 192 as a variable-length 0x81 0x40
  ...[0x00, 0xff, 0x2f, 0x00],
);
// notes: program 5 on channel 0, C4 for one beat ended by a note-on with velocity 0 under running status,
// then a snare on channel 9 from tick 192 to 288
const notes = track(
  ...[0x00, 0xc0, 0x05],
  ...[0x00, 0x90, 60, 100],
  ...[0x60, 60, 0],
  ...[0x60, 0x99, 38, 90],
  ...[0x60, 0x89, 38, 0],
  ...[0x00, 0xff, 0x2f, 0x00],
);

describe('readMidi', () => {
  it('applies the tempo map, running status and note-on with velocity 0', () => {
    const m = readMidi(smf(tempo, notes));
    expect(m.bpm).toBe(60);
    expect([...m.programs]).toEqual([[0, 5]]);
    expect(m.notes).toEqual([
      { start: 0, end: 1, pitch: 60, channel: 0 },
      { start: 2, end: 2.5, pitch: 38, channel: 9 },
    ]);
    expect(m.duration).toBe(2.5);
  });

  it('rejects data that is not a MIDI file and truncated files with a readable error', () => {
    expect(() => readMidi(new Uint8Array([1, 2, 3]).buffer)).toThrow(MidiParseError);
    const whole = new Uint8Array(smf(tempo, notes));
    const cut = whole.slice(0, whole.length - 6);
    expect(() => readMidi(cut.buffer)).toThrow(/past the end/);
    const lying = whole.slice();
    lying[14] = 0x58; // breaks the first MTrk tag
    expect(() => readMidi(lying.buffer)).toThrow(/MTrk/);
  });

  it('reads an original composition rendered by the game', () => {
    const b = readFileSync(new URL('./fixtures/batalha_A.mid', import.meta.url));
    const m = readMidi(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    // values measured with this reader on 2026-11-18; the stems of this piece last 101.818186 s
    expect(m.bpm).toBeCloseTo(132);
    expect(m.notes).toHaveLength(1828);
    expect(m.duration).toBeCloseTo(101.82, 1);
    expect([...m.programs]).toEqual([
      [0, 48],
      [1, 48],
      [2, 43],
      [3, 60],
      [4, 61],
      [5, 47],
      [6, 68],
    ]);
    expect(m.notes.filter((n) => n.channel === 9)).toHaveLength(700);
  });

  it('names notes in scientific pitch', () => {
    expect([noteName(60), noteName(69), noteName(21)]).toEqual(['C4', 'A4', 'A0']);
  });
});
