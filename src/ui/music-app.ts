// The whole player: library, transport with piano roll and mixer, and the track notes, stacked at full width.
// It owns the PlayerEngine and its AudioContext, created on the first pointer or key press inside it (or Space
// anywhere), because browsers keep a context made earlier suspended and warn about it.
import { css, html, nothing, type PropertyValues } from 'lit';
import { parseCatalog } from '../catalog/parse-catalog';
import type { Catalog, Song } from '../catalog/schema';
import { PlayerEngine } from '../engine/PlayerEngine';
import { PlayerElement, tokens } from './base';
import type { AbState } from './library';

const PARTS = 'tabs, tab, card, transport, roll, overview, lane, mixer-channel, notes';

// keys typed into a control belong to it, not to the player
const isControl = (el: Element) =>
  /^(INPUT|BUTTON|SELECT|TEXTAREA|A)$/.test(el.tagName) || (el as HTMLElement).isContentEditable;

export class DtMusicApp extends PlayerElement {
  static override properties = {
    catalog: { attribute: false },
    src: {},
    ab: { state: true },
    errors: { state: true },
  };
  static override styles = [
    tokens,
    css`
      :host {
        background: var(--_bg);
        padding: var(--_space);
      }
      section {
        background: var(--_surface);
        border: var(--_border) solid var(--_primary);
        box-shadow: var(--_shadow);
        padding: calc(var(--_space) * 1.25);
        display: grid;
        grid-template-columns: minmax(0, 1fr); /* lets the tabs and the roll scroll instead of widening the page */
        gap: var(--_space);
        margin-bottom: calc(var(--_space) * 1.5);
      }
      h2 {
        text-transform: uppercase;
        padding-bottom: 10px;
        border-bottom: var(--_border) solid var(--_primary);
      }
      h2::before {
        content: '';
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-right: 10px;
        background: var(--_accent);
      }
      .stage {
        display: grid;
        grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); /* versions beside the roll, never above it */
        gap: var(--_space);
        align-items: start;
      }
      .stage > div {
        min-width: 0;
        display: grid;
        gap: var(--_space);
      }
      .hints {
        margin: 0;
        color: var(--_muted);
      }
      .error {
        color: var(--_accent-ink);
      }
      @media (max-width: 700px) {
        :host {
          padding: 8px;
        }
        section {
          padding: 12px;
        }
        .stage {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  declare catalog: Catalog | undefined;
  declare src: string | undefined;
  declare ab: AbState | undefined;
  declare errors: string[];
  #context: AudioContext | undefined;

  constructor() {
    super();
    this.errors = [];
    this.addEventListener('pointerdown', this.#start, { capture: true });
    this.addEventListener('keydown', this.#start, { capture: true });
  }

  override connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener('keydown', this.#space);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener('keydown', this.#space);
    this.engine?.dispose();
    void this.#context?.close(); // the app made this context, so it closes it
    this.engine = undefined;
    this.#context = undefined;
  }

  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    if (changed.has('src') && this.src) void this.#load(this.src);
    if (changed.has('catalog') && this.catalog && !this.song) {
      const order = new Map(this.catalog.categories.map((c) => [c.id, c.order]));
      const first = [...this.catalog.songs].sort((a, b) => order.get(a.category)! - order.get(b.category)!)[0];
      if (first) this.#select(first);
    }
  }

  async #load(src: string) {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
      const parsed = parseCatalog(await res.json());
      if (parsed.ok) this.catalog = parsed.value;
      else this.errors = parsed.errors;
    } catch (error) {
      this.errors = [String(error)];
    }
  }

  #select(song: Song) {
    this.song = song;
    this.ab = { a: song.versions[0]?.id, b: (song.versions[1] ?? song.versions[0])?.id, active: 'a' };
    this.versionId = this.ab.a;
  }

  #start = () => {
    if (this.engine) return;
    this.#context = new AudioContext();
    this.engine = new PlayerEngine({ context: this.#context });
    this.engine.setTreated(true); // the treated finish is the one to hear; the original is no longer offered
    if (this.song) void this.engine.setSong(this.song, this.versionId);
  };

  #space = (e: KeyboardEvent) => {
    const target = e.composedPath()[0];
    if (e.key !== ' ' || e.defaultPrevented || (target instanceof Element && isControl(target))) return;
    e.preventDefault();
    this.#start();
    const eng = this.engine!;
    if (eng.state === 'playing') eng.pause();
    else void eng.play();
  };

  override render() {
    const s = this.strings;
    if (this.errors.length)
      return html`<section role="alert">
        <h2>${s.catalogError}</h2>
        <ul class="error">
          ${this.errors.map((x) => html`<li>${x}</li>`)}
        </ul>
      </section>`;
    if (!this.catalog) return nothing;
    return html`
      <section>
        <h2>${s.library}</h2>
        <dt-library
          exportparts=${PARTS}
          theme=${this.theme}
          .catalog=${this.catalog}
          .ab=${this.ab}
          .engine=${this.engine}
          .song=${this.song}
          .versionId=${this.versionId}
          .strings=${s}
          @dt-song=${(e: CustomEvent<{ song: Song }>) => (this.song = e.detail.song)}
          @dt-ab=${(e: CustomEvent<AbState>) => {
            this.ab = e.detail;
            this.versionId = e.detail[e.detail.active];
          }}
        ></dt-library>
      </section>
      <section>
        <h2>${s.rollAndMixer}</h2>
        <div class="stage">
          <dt-versions
            exportparts=${PARTS}
            theme=${this.theme}
            .ab=${this.ab}
            .engine=${this.engine}
            .song=${this.song}
            .versionId=${this.versionId}
            .strings=${s}
            @dt-ab=${(e: CustomEvent<AbState>) => {
              this.ab = e.detail;
              this.versionId = e.detail[e.detail.active];
            }}
          ></dt-versions>
          <div>
            <dt-transport
              exportparts=${PARTS}
              theme=${this.theme}
              .ab=${this.ab}
              .engine=${this.engine}
              .song=${this.song}
              .versionId=${this.versionId}
              .strings=${s}
            ></dt-transport>
            <dt-piano-roll
              exportparts=${PARTS}
              theme=${this.theme}
              .engine=${this.engine}
              .song=${this.song}
              .versionId=${this.versionId}
              .strings=${s}
            >
              <dt-mixer
                slot="mixer"
                exportparts=${PARTS}
                theme=${this.theme}
                .engine=${this.engine}
                .song=${this.song}
                .versionId=${this.versionId}
                .strings=${s}
              ></dt-mixer>
            </dt-piano-roll>
          </div>
        </div>
        <p class="hints">${s.hints}</p>
      </section>
      <section>
        <h2>${s.notes}</h2>
        <dt-track-notes
          exportparts=${PARTS}
          theme=${this.theme}
          .engine=${this.engine}
          .song=${this.song}
          .strings=${s}
        ></dt-track-notes>
      </section>
    `;
  }
}
