// The catalog a host hands the player: categories, songs and, inside each song, its rendered versions.
// Channels are 0-based MIDI channels everywhere in this package (drums = 9), so a stem file is `${channel}.ogg`.

export interface Catalog {
  categories: Category[];
  songs: Song[];
}

export interface Category {
  id: string;
  label: string;
  /** sort key for the category menu, ascending */
  order: number;
}

export interface Song {
  id: string;
  title: string;
  /** id of a category in the same catalog */
  category: string;
  /** who made it: composer, arranger or the model and effort that wrote it */
  authorship: string;
  story?: string;
  /** the story is a first draft: the notes show a "Draft" badge */
  storyDraft?: boolean;
  /** where the piece plays in the game or product */
  whereItPlays?: string;
  /** at least one; the first is the default */
  versions: Version[];
  /** the composition's channels; a version may list its own (see Version.channels) */
  channels: Channel[];
  references: Reference[];
  measurements: Measurement[];
  checks: Check[];
  tags?: { style?: string[]; mood?: string[] };
}

/** One render of the song, for example the same MIDI through another SoundFont. */
export interface Version {
  id: string;
  /** shown to the listener, for example "SC-88Pro" */
  label: string;
  /** folder URL holding `${channel}.ogg` for every channel */
  stemsBase: string;
  /** the MIDI this render came from; the piano roll draws the active version's MIDI */
  midi: string;
  /** seconds; the loop length while this version is active */
  duration: number;
  /**
   * Channels of this render when they differ from the song's. Banks without a General MIDI drum kit move the drums to
   * melodic channels, so their renders have other channel numbers.
   */
  channels?: Channel[];
}

export interface Channel {
  /** 0-based MIDI channel, 0..15 */
  channel: number;
  /** General MIDI program 0..127, or null when the channel never sets one (drums) */
  program: number | null;
  name: string;
}

export interface Reference {
  label: string;
  url: string;
  /** a third-party work kept for study only: the notes warn it is not ours to ship */
  study?: boolean;
}

export interface Measurement {
  label: string;
  value: string;
  /** how the value was obtained: a tool, a file, a listening test */
  source: string;
}

export interface Check {
  text: string;
  state: 'done' | 'pending';
}
