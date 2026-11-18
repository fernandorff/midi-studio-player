/**
 * Live synthesis from the MIDI and a SoundFont, the optional alternative to pre-rendered stems: any SoundFont, no render
 * step, at the cost of CPU and of sounding slightly different from the offline render.
 *
 * TODO(live synthesis): implement with SpessaSynth (Apache-2.0) as an optional peer dependency, so hosts that only play
 * stems never download it. Not wired into PlayerEngine yet; the engine keeps its mixer API and would route a Synth's
 * per-channel output through the same gains, so mute, solo and the treatment chain behave the same.
 */
export interface Synth {
  loadSoundFont(data: ArrayBuffer): Promise<void>;
  loadMidi(data: ArrayBuffer): Promise<void>;
  /** where the synth sends its audio (the engine's master input) */
  connect(destination: AudioNode): void;
  /** start at this position in seconds */
  play(position: number): void;
  pause(): void;
  /** 0-based MIDI channel; 0 silences it */
  setChannelGain(channel: number, gain: number): void;
}
