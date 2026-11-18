import { DtLibrary } from './ui/library';
import { DtMixer } from './ui/mixer';
import { DtMusicApp } from './ui/music-app';
import { DtPianoRoll } from './ui/piano-roll';
import { DtTrackNotes } from './ui/track-notes';
import { DtTransport } from './ui/transport';

export type { Catalog, Category, Channel, Check, Measurement, Reference, Song, Version } from './catalog/schema';
export { parseCatalog, parseStemsManifest, type ParseResult } from './catalog/parse-catalog';
export { readMidi, noteName, MidiParseError, type Midi, type MidiNote } from './midi/read-midi';
export {
  PlayerEngine,
  type AudioContextLike,
  type PlayerEngineOptions,
  type PlayerEvents,
  type PlayerState,
} from './engine/PlayerEngine';
export type { Synth } from './engine/synth';
export type { Strings } from './ui/strings';
export { ptBR, en } from './ui/strings';
export type { AbState } from './ui/library';
export { PlayerElement } from './ui/base';
export { DtLibrary, DtTransport, DtPianoRoll, DtMixer, DtTrackNotes, DtMusicApp };

// importing the package registers the elements, once, and only where custom elements exist (not in Node)
const elements = {
  'dt-library': DtLibrary,
  'dt-transport': DtTransport,
  'dt-piano-roll': DtPianoRoll,
  'dt-mixer': DtMixer,
  'dt-track-notes': DtTrackNotes,
  'dt-music-app': DtMusicApp,
};
for (const [tag, element] of Object.entries(elements))
  if (globalThis.customElements && !customElements.get(tag)) customElements.define(tag, element);
