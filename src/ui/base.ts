// What every component shares: the design tokens, the dark theme and the binding to a PlayerEngine.
// Each component reads public `--dt-player-*` tokens through private `--_*` ones with the default as fallback, so a
// value set on any ancestor (or by `theme` on dt-music-app) reaches components nested in other shadow roots.
import { LitElement, css, type CSSResultGroup, type PropertyDeclarations, type PropertyValues } from 'lit';
import type { Channel, Song, Version } from '../catalog/schema';
import type { PlayerEngine } from '../engine/PlayerEngine';
import { ptBR, type Strings } from './strings';

export const tokens = css`
  :host {
    --_bg: var(--dt-player-bg, #eaf0f5);
    --_surface: var(--dt-player-surface, #ffffff);
    --_text: var(--dt-player-text, #111827);
    --_muted: var(--dt-player-muted, #4b5563);
    --_primary: var(--dt-player-primary, #1b494d);
    --_accent: var(--dt-player-accent, #d04a36);
    --_navy: var(--dt-player-navy, #1c3d5a);
    --_ochre: var(--dt-player-ochre, #c98a2c);
    --_line: var(--dt-player-line, #d0dce4);
    --_on-primary: var(--dt-player-on-primary, #ffffff);
    --_roll-bg: var(--dt-player-roll-bg, #0e1b1d);
    --_roll-alt: var(--dt-player-roll-alt, #13262a);
    --_roll-grid: var(--dt-player-roll-grid, #2a4448);
    --_roll-text: var(--dt-player-roll-text, #e8eef2);
    --_font-title: var(--dt-player-font-title, 'Barlow Condensed', 'Arial Narrow', sans-serif);
    --_font-text: var(--dt-player-font-text, 'Source Serif 4', Georgia, serif);
    --_font-number: var(--dt-player-font-number, 'Space Mono', ui-monospace, monospace);
    --_radius: var(--dt-player-radius, 0);
    --_border: var(--dt-player-border, 2px);
    --_shadow: var(--dt-player-shadow, 3px 3px 0 #1b494d);
    --_space: var(--dt-player-space, 16px);
    --_lane: var(--dt-player-lane-height, 76px);
    --_ch0: var(--dt-player-channel-0, #8e44ad);
    --_ch1: var(--dt-player-channel-1, #2a7fc1);
    --_ch2: var(--dt-player-channel-2, #e0661f);
    --_ch3: var(--dt-player-channel-3, #2e9e4f);
    --_ch4: var(--dt-player-channel-4, #c9372c);
    --_ch5: var(--dt-player-channel-5, #17a589);
    --_ch6: var(--dt-player-channel-6, #c98a2c);
    --_ch7: var(--dt-player-channel-7, #8a9399);
    display: block;
    color: var(--_text);
    font: 16px/1.4 var(--_font-text);
  }
  :host([theme='dark']) {
    --dt-player-bg: #0f1719;
    --dt-player-surface: #172326;
    --dt-player-text: #e8eef2;
    --dt-player-muted: #a9b6bd;
    --dt-player-primary: #5fa8ae;
    --dt-player-accent: #f0705c;
    --dt-player-navy: #8fb3d9;
    --dt-player-ochre: #e0a84a;
    --dt-player-line: #34484d;
    --dt-player-on-primary: #0f1719;
    --dt-player-shadow: 3px 3px 0 #000000;
  }
  /* B-2 "Frontier Archive": pinned here so later changes to the default theme never move it */
  :host([theme='frontier']) {
    --dt-player-bg: #eaf0f5;
    --dt-player-surface: #ffffff;
    --dt-player-text: #0f172a;
    --dt-player-muted: #4b5563;
    --dt-player-primary: #1b494d;
    --dt-player-on-primary: #ffffff;
    --dt-player-accent: #d04a36;
    --dt-player-navy: #1c3d5a;
    --dt-player-ochre: #c98a2c;
    --dt-player-line: #d0dce4;
    --dt-player-roll-bg: #0b1517;
    --dt-player-roll-alt: #102023;
    --dt-player-roll-grid: #2a4448;
    --dt-player-roll-text: #eef3f6;
    --dt-player-radius: 0;
    --dt-player-border: 2px;
    --dt-player-shadow: 4px 4px 0 #1b494d;
    /* room for 44 px Mute and Solo under the channel name */
    --dt-player-lane-height: 100px;
  }
  /* the Dungeon Tactics game's 3D menu parchment and ink (its --ui3d-* tokens), the lab's colours since 18/11 */
  :host([theme='parchment']) {
    --dt-player-bg: #ece7d4;
    --dt-player-surface: #f6f1db;
    --dt-player-text: #474129;
    --dt-player-muted: #5b5440;
    --dt-player-primary: #332b1a;
    --dt-player-on-primary: #fdebb4;
    --dt-player-accent: #962b20;
    --dt-player-navy: #2f5f94;
    --dt-player-ochre: #7a6126;
    --dt-player-line: #bbb4a2;
    --dt-player-roll-bg: #2a2619;
    --dt-player-roll-alt: #332b1a;
    --dt-player-roll-grid: #5b5440;
    --dt-player-roll-text: #fdebb4;
    --dt-player-radius: 0;
    --dt-player-border: 2px;
    --dt-player-shadow: 4px 4px 0 #332b1a;
    --dt-player-lane-height: 100px;
  }
  /* the Dungeon Tactics lab's "Noite" scheme: blue-grey ground, navy leather, warm gold (the lab's colours since 18/11) */
  :host([theme='night']) {
    --dt-player-bg: #e5e9f0;
    --dt-player-surface: #f2f4f8;
    --dt-player-text: #1c2433;
    --dt-player-muted: #4a5568;
    --dt-player-primary: #1f2a3d;
    --dt-player-on-primary: #eef1f7;
    --dt-player-accent: #7a5f24;
    --dt-player-navy: #27558f;
    --dt-player-ochre: #8a6d2f;
    --dt-player-line: #ccd3e0;
    --dt-player-roll-bg: #141c2b;
    --dt-player-roll-alt: #1f2a3d;
    --dt-player-roll-grid: #4a5568;
    --dt-player-roll-text: #eef1f7;
    --dt-player-radius: 0;
    --dt-player-border: 2px;
    --dt-player-shadow: 4px 4px 0 #1f2a3d;
    --dt-player-lane-height: 100px;
  }
  /* 44 px touch targets; the :host() prefix outranks each component's own smaller sizes */
  :host([theme='frontier']) button,
  :host([theme='frontier']) select,
  :host([theme='frontier']) input[type='range'],
  :host([theme='parchment']) button,
  :host([theme='parchment']) select,
  :host([theme='parchment']) input[type='range'],
  :host([theme='night']) button,
  :host([theme='night']) select,
  :host([theme='night']) input[type='range'] {
    min-height: 44px;
  }
  :host([hidden]) {
    display: none;
  }
  * {
    box-sizing: border-box;
  }
  button,
  input,
  select {
    font: inherit;
    color: inherit;
  }
  button {
    min-height: 36px;
    padding: 2px 12px;
    border: var(--_border) solid var(--_primary);
    border-radius: var(--_radius);
    background: var(--_surface);
    cursor: pointer;
  }
  button[aria-pressed='true'],
  button[aria-selected='true'] {
    background: var(--_primary);
    color: var(--_on-primary);
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  :focus-visible {
    outline: 3px solid var(--_ochre);
    outline-offset: 2px;
  }
  .num {
    font-family: var(--_font-number);
    font-variant-numeric: tabular-nums;
  }
  h2,
  h3 {
    margin: 0;
    font-family: var(--_font-title);
    font-weight: 700;
    color: var(--_primary);
  }
  h2 {
    font-size: 24px;
  }
  h3 {
    font-size: 20px;
  }
`;

/** the colour of the lane at `index`, as a CSS value */
export const channelColor = (index: number) => `var(--_ch${index % 8})`;

/**
 * A component bound to a PlayerEngine. Before the engine exists (it waits for the first user gesture, since browsers
 * keep audio suspended until one) it shows `song` and `versionId`.
 */
export class PlayerElement extends LitElement {
  static override properties: PropertyDeclarations = {
    engine: { attribute: false },
    song: { attribute: false },
    versionId: { attribute: false },
    strings: { attribute: false },
    theme: { reflect: true },
  };
  static override styles: CSSResultGroup = tokens;

  declare engine: PlayerEngine | undefined;
  declare song: Song | undefined;
  declare versionId: string | undefined;
  declare strings: Strings;
  declare theme: string;
  #off: (() => void)[] = [];
  #bound: PlayerEngine | undefined;

  constructor() {
    super();
    this.strings = ptBR;
    this.theme = 'field';
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#bind();
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unbind();
  }
  protected override willUpdate(changed: PropertyValues) {
    if (changed.has('engine')) this.#bind();
  }

  #bind() {
    if (this.#bound === this.engine && this.#off.length) return;
    this.#unbind();
    const e = this.engine;
    if (!e) return;
    this.#bound = e;
    const update = () => this.requestUpdate();
    this.#off = [
      e.on('change', update),
      e.on('state', update),
      e.on('progress', update),
      e.on('error', update),
      e.on('time', ({ position }) => this.onTime(position)),
    ];
  }
  #unbind() {
    this.#off.forEach((off) => off());
    this.#off = [];
    this.#bound = undefined;
  }

  /** once per frame while playing; components that follow the position override it */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onTime(position: number) {}

  get activeSong(): Song | undefined {
    return this.engine?.song ?? this.song;
  }
  get activeVersion(): Version | undefined {
    if (this.engine?.version) return this.engine.version;
    const versions = this.song?.versions ?? [];
    return versions.find((v) => v.id === this.versionId) ?? versions[0];
  }
  /** the lanes: the active version's channels */
  get lanes(): Channel[] {
    if (this.engine?.song) return this.engine.channels;
    return this.activeVersion?.channels ?? this.song?.channels ?? [];
  }
  get duration() {
    return this.engine?.duration || this.activeVersion?.duration || 0;
  }
  get position() {
    return this.engine?.position ?? 0;
  }
}
