// Pure helpers behind the views, kept apart from the DOM so they run in tests.
import type { Song } from '../catalog/schema';

// ponytail: one tempo and 4/4 for the whole piece (the MIDI reader exposes the first bpm only); read the tempo and
// time-signature maps when a piece changes either.
const BEATS_PER_BAR = 4;

/** seconds per bar at a constant tempo in 4/4 */
export const barSeconds = (bpm: number) => (BEATS_PER_BAR * 60) / bpm;

/** whole bars in the loop; rounding absorbs the render tail of a few milliseconds */
export const barCount = (duration: number, bpm: number) => Math.max(1, Math.round(duration / barSeconds(bpm)));

/** 1-based bar under a position, never past the last bar */
export const barAt = (position: number, bpm: number, bars: number) =>
  Math.min(bars, Math.floor(position / barSeconds(bpm)) + 1);

export const timeToX = (t: number, duration: number, width: number) => (duration > 0 ? (t / duration) * width : 0);

export const xToTime = (x: number, duration: number, width: number) =>
  width > 0 ? Math.max(0, Math.min(duration, (x / width) * duration)) : 0;

/** the bar labels on the ruler: bar 1, then every `step` bars, with `step` wide enough for a label */
export function rulerBars(bars: number, width: number, minGap = 44): number[] {
  const steps = [1, 2, 4, 8, 16, 32];
  const step = steps.find((s) => (width / bars) * s >= minGap) ?? 64;
  const out = [1];
  for (let b = step; b <= bars; b += step) if (b !== 1) out.push(b);
  return out;
}

/** m:ss */
export const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** songs of a category whose title or authorship contains the query, ignoring case and accents */
export function filterSongs(songs: Song[], category: string, query: string): Song[] {
  const q = fold(query.trim());
  return songs.filter(
    (s) => s.category === category && (!q || fold(s.title).includes(q) || fold(s.authorship).includes(q)),
  );
}

/** lowest and highest pitch per channel, for scaling each lane to its own range */
export function pitchRanges(notes: { channel: number; pitch: number }[]) {
  const out = new Map<number, [number, number]>();
  for (const n of notes) {
    const r = out.get(n.channel);
    if (!r) out.set(n.channel, [n.pitch, n.pitch]);
    else {
      if (n.pitch < r[0]) r[0] = n.pitch;
      if (n.pitch > r[1]) r[1] = n.pitch;
    }
  }
  return out;
}
