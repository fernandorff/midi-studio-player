// Block 2: tempo line, the clickable overview, the bar ruler and one lane per channel with the real MIDI notes of the
// active version across the whole song. Canvas, not SVG: a piece has thousands of notes, and one canvas per lane is
// drawn only when the song, mute/solo, size or theme changes; the needle is a CSS line moved each frame.
import { css, html, nothing, type PropertyValues } from 'lit';
import { readMidi, type Midi } from '../midi/read-midi';
import { PlayerElement, tokens } from './base';
import { barAt, barCount, barSeconds, pitchRanges, rulerBars, timeToX, xToTime } from './math';

const midiCache = new Map<string, Promise<Midi>>();
const loadMidi = (url: string) => {
  let p = midiCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: HTTP ${r.status}`))))
      .then(readMidi);
    p.catch(() => midiCache.delete(url)); // a later render may retry
    midiCache.set(url, p);
  }
  return p;
};

const NARROW = 700;

export class DtPianoRoll extends PlayerElement {
  static override properties = { midi: { state: true }, midiFailed: { state: true } };
  static override styles = [
    tokens,
    css`
      [part='roll'] {
        display: grid;
        gap: 8px;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
      }
      .meta .tempo {
        border: var(--_border) solid var(--_line);
        padding: 2px 10px;
      }
      .meta .pos {
        color: var(--_accent);
      }
      .track {
        position: relative;
      }
      .overview {
        display: block;
        width: 100%;
        height: 40px;
        cursor: pointer;
        border: var(--_border) solid var(--_primary);
        background: var(--_roll-bg);
      }
      .body {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
      }
      .scroll {
        overflow-x: auto;
      }
      .lanes {
        position: relative;
        min-width: 100%;
        background: var(--_roll-bg);
        border: var(--_border) solid var(--_primary);
        cursor: pointer;
      }
      .ruler {
        display: block;
        width: 100%;
        height: 40px;
      }
      [part='lane'] {
        height: var(--_lane);
        border-top: 1px solid var(--_roll-grid);
      }
      [part='lane'] canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      .needle {
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(var(--dt-progress, 0) * 100%);
        width: 2px;
        margin-left: -1px;
        background: var(--_accent);
        pointer-events: none;
      }
      .lanes .needle::before {
        content: '';
        position: absolute;
        top: 0;
        left: -6px;
        border: 7px solid transparent;
        border-top: 10px solid var(--_accent);
      }
      .empty {
        color: var(--_muted);
      }
      @media (max-width: ${NARROW}px) {
        .body {
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
        }
        .lanes {
          min-width: 640px;
        }
      }
    `,
  ];

  declare midi: Midi | undefined;
  declare midiFailed: boolean;
  #midiUrl: string | undefined;
  // hosts' test DOMs (jsdom) have no ResizeObserver; the roll then keeps its first size instead of failing to construct
  #resize = globalThis.ResizeObserver ? new ResizeObserver(() => this.requestUpdate()) : undefined;

  constructor() {
    super();
    this.midiFailed = false;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resize?.disconnect();
  }

  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    const url = this.activeVersion?.midi;
    if (url === this.#midiUrl) return;
    this.#midiUrl = url;
    this.midi = undefined;
    this.midiFailed = false;
    if (!url) return;
    loadMidi(url).then(
      (m) => url === this.#midiUrl && (this.midi = m),
      () => url === this.#midiUrl && (this.midiFailed = true),
    );
  }

  get bpm() {
    return this.midi?.bpm ?? 120;
  }
  get bars() {
    return barCount(this.duration, this.bpm);
  }

  protected override onTime(position: number) {
    this.#needle(position);
  }

  #needle(position: number) {
    const d = this.duration;
    this.style.setProperty('--dt-progress', String(d ? position / d : 0));
    const lanes = this.renderRoot.querySelector('.lanes');
    const text = this.strings.bar(barAt(position, this.bpm, this.bars), this.bars);
    lanes?.setAttribute('aria-valuenow', position.toFixed(1));
    lanes?.setAttribute('aria-valuetext', text);
    const pos = this.renderRoot.querySelector('.pos');
    if (pos && pos.textContent !== text) pos.textContent = text;
  }

  #seekAt(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.engine?.seek(xToTime(e.clientX - r.left, this.duration, r.width));
  }

  #key(e: KeyboardEvent) {
    const eng = this.engine;
    if (!eng) return;
    const bar = barSeconds(this.bpm);
    const at = eng.position;
    const to =
      e.key === 'ArrowRight'
        ? at + bar
        : e.key === 'ArrowLeft'
          ? at - bar
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? this.duration - bar
              : undefined;
    if (e.key === ' ') {
      if (eng.state === 'playing') eng.pause();
      else void eng.play();
    } else if (to === undefined) return;
    else eng.seek(Math.max(0, Math.min(this.duration, to)));
    e.preventDefault();
    e.stopPropagation(); // dt-music-app also listens for Space on the window
  }

  override render() {
    const s = this.strings;
    if (!this.activeVersion) return nothing;
    return html`<div part="roll">
      <div class="meta">
        <span class="tempo">${this.midi ? s.tempo(this.bpm, this.bars) : '…'}</span>
        <span class="pos num" aria-hidden="true"></span>
      </div>
      ${this.midiFailed ? html`<p class="empty" role="status">${s.midiMissing}</p>` : nothing}
      <div class="track">
        <canvas class="overview" part="overview" role="img" aria-label=${s.overview} @click=${this.#seekAt}></canvas>
        <div class="needle"></div>
      </div>
      <div class="body">
        <slot name="mixer"></slot>
        <div class="scroll">
          <div
            class="lanes"
            tabindex="0"
            role="slider"
            aria-label=${s.rollLabel}
            aria-valuemin="0"
            aria-valuemax=${this.duration.toFixed(1)}
            @click=${this.#seekAt}
            @keydown=${this.#key}
          >
            <canvas class="ruler"></canvas>
            ${this.lanes.map((c) => html`<div part="lane" data-channel=${c.channel}><canvas></canvas></div>`)}
            <div class="needle"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  protected override firstUpdated() {
    this.#resize?.observe(this);
  }

  protected override updated() {
    this.#draw();
    this.#needle(this.position);
  }

  #draw() {
    const root = this.renderRoot;
    const style = getComputedStyle(this);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const dpr = globalThis.devicePixelRatio || 1;
    const d = this.duration;
    const notes = this.midi?.notes ?? [];
    const ranges = pitchRanges(notes);
    const lanes = this.lanes;
    const sounding = (ch: number) => !this.engine || this.engine.effectiveGain(ch) > 0;
    const narrow = globalThis.innerWidth < NARROW; // the same test as the media query that stacks the mixer

    // sizes the backing store to the CSS box and returns a context in CSS pixels, or null where canvas is missing
    const prepare = (c: HTMLCanvasElement | null) => {
      const g = c?.getContext('2d');
      if (!c || !g) return null;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      return { g, w, h };
    };

    const ruler = prepare(root.querySelector<HTMLCanvasElement>('.ruler'));
    if (ruler && this.midi) {
      const { g, w, h } = ruler;
      g.fillStyle = token('--_roll-alt');
      g.fillRect(0, 0, w, h);
      g.font = `700 16px ${token('--_font-number')}`;
      g.textBaseline = 'middle';
      g.fillStyle = token('--_roll-text');
      const bar = barSeconds(this.bpm);
      for (const b of rulerBars(this.bars, w)) {
        const x = timeToX((b - 1) * bar, d, w);
        g.fillRect(x, h - 8, 1, 8);
        g.fillText(String(b), Math.min(x + 4, w - 28), h / 2);
      }
    }

    lanes.forEach((lane, i) => {
      const box = prepare(root.querySelector<HTMLCanvasElement>(`[data-channel='${lane.channel}'] canvas`));
      if (!box) return;
      const { g, w, h } = box;
      g.fillStyle = token(i % 2 ? '--_roll-alt' : '--_roll-bg');
      g.fillRect(0, 0, w, h);
      // a grid line every 4 bars, as on the ruler's longer ticks
      g.fillStyle = token('--_roll-grid');
      const every = barSeconds(this.bpm) * 4;
      for (let t = every; t < d; t += every) g.fillRect(timeToX(t, d, w), 0, 1, h);
      const [lo, hi] = ranges.get(lane.channel) ?? [60, 60];
      const span = Math.max(12, hi - lo + 1);
      const noteH = Math.max(3, Math.min(10, (h - 12) / span));
      g.fillStyle = token(`--_ch${i % 8}`);
      g.globalAlpha = sounding(lane.channel) ? 1 : 0.25;
      for (const n of notes) {
        if (n.channel !== lane.channel) continue;
        const x = timeToX(n.start, d, w);
        const y = h - 6 - ((n.pitch - lo + 0.5) / span) * (h - 12);
        g.fillRect(x, y - noteH / 2, Math.max(2, timeToX(n.end - n.start, d, w) - 1), noteH);
      }
      g.globalAlpha = 1;
      if (narrow) {
        // on a phone the mixer sits above the roll, so each lane names its channel
        g.font = `16px ${token('--_font-text')}`;
        g.textBaseline = 'top';
        g.fillStyle = token('--_roll-text');
        g.fillText(lane.name, 6, 4);
      }
    });

    const over = prepare(root.querySelector<HTMLCanvasElement>('.overview'));
    if (over && lanes.length) {
      const { g, w, h } = over;
      const band = h / lanes.length;
      lanes.forEach((lane, i) => {
        const [lo, hi] = ranges.get(lane.channel) ?? [60, 60];
        const span = Math.max(12, hi - lo + 1);
        g.fillStyle = token(`--_ch${i % 8}`);
        g.globalAlpha = sounding(lane.channel) ? 0.9 : 0.2;
        for (const n of notes) {
          if (n.channel !== lane.channel) continue;
          const y = i * band + band - ((n.pitch - lo + 0.5) / span) * band;
          g.fillRect(timeToX(n.start, d, w), y, Math.max(1, timeToX(n.end - n.start, d, w)), 1.5);
        }
      });
      g.globalAlpha = 1;
    }
  }
}
