// Block 1: category tabs and the song cards with search. Picking a song calls the engine when there is one and always
// fires an event, so a host without an engine can follow the choice. Versions and A|B live in dt-versions.
import { css, html, nothing, type PropertyValues } from 'lit';
import type { Catalog, Song } from '../catalog/schema';
import { PlayerElement, tokens } from './base';
import { filterSongs, formatTime } from './math';

export interface AbState {
  a: string | undefined;
  b: string | undefined;
  active: 'a' | 'b';
}

export class DtLibrary extends PlayerElement {
  static override properties = {
    catalog: { attribute: false },
    category: { state: true },
    query: { state: true },
    ab: { attribute: false },
  };
  static override styles = [
    tokens,
    css`
      [role='tablist'] {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 4px 4px 12px;
        border-bottom: 1px solid var(--_line);
        margin-bottom: var(--_space);
      }
      [role='tab'] {
        flex: none;
        font-family: var(--_font-title);
        font-weight: 700;
        font-size: 18px;
        text-transform: uppercase;
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      input[type='search'] {
        width: 100%;
        min-height: 44px;
        padding: 6px 12px;
        border: var(--_border) solid var(--_primary);
        border-radius: var(--_radius);
        background: var(--_surface);
        margin-bottom: 12px;
      }
      .cards {
        max-height: 224px; /* about two rows of cards; the rest scrolls so the roll below stays in view */
        overflow-y: auto;
        padding: 2px 6px 6px 2px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }
      [part~='card'] {
        display: grid;
        gap: 6px;
        text-align: left;
        padding: 12px;
        border-color: var(--_line);
      }
      [part~='card'][aria-pressed='true'] {
        background: var(--_surface);
        color: var(--_text);
        border-color: var(--_accent);
        box-shadow: var(--_shadow);
      }
      .card-title {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-family: var(--_font-title);
        font-weight: 700;
        font-size: 20px;
      }
      [aria-pressed='true'] .card-title {
        color: var(--_accent);
      }
      .empty {
        padding: var(--_space);
        border: var(--_border) dashed var(--_line);
        color: var(--_muted);
      }
    `,
  ];

  declare catalog: Catalog | undefined;
  declare category: string | undefined;
  declare query: string;
  declare ab: AbState;

  constructor() {
    super();
    this.query = '';
    this.ab = { a: undefined, b: undefined, active: 'a' };
  }

  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    // a song set from outside (or a first render) starts with its first two versions as A and B
    const v = this.activeSong?.versions;
    if (v && !v.some((x) => x.id === this.ab.a)) this.ab = { a: v[0]?.id, b: (v[1] ?? v[0])?.id, active: 'a' };
  }

  get categories() {
    return [...(this.catalog?.categories ?? [])].sort((x, y) => x.order - y.order);
  }

  #pickSong(song: Song) {
    if (song === this.activeSong) return;
    const ab: AbState = { a: song.versions[0]?.id, b: (song.versions[1] ?? song.versions[0])?.id, active: 'a' };
    this.ab = ab;
    this.song = song;
    this.versionId = ab.a;
    void this.engine?.setSong(song, ab.a);
    this.#emit('dt-song', { song });
    this.#emitAb();
  }

  #emitAb() {
    this.#emit('dt-ab', { ...this.ab });
  }

  #emit(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  #tabKey(e: KeyboardEvent, index: number) {
    const cats = this.categories;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = cats[(index + step + cats.length) % cats.length]!;
    this.category = next.id;
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>(`[role='tab'][data-id='${CSS.escape(next.id)}']`)?.focus(),
    );
  }

  override render() {
    const s = this.strings;
    const cats = this.categories;
    const song = this.activeSong;
    const catId = this.category ?? song?.category ?? cats[0]?.id;
    const cat = cats.find((c) => c.id === catId);
    const all = this.catalog?.songs ?? [];
    const inCat = all.filter((x) => x.category === catId);
    const shown = filterSongs(all, catId ?? '', this.query);
    return html`
      <div role="tablist" part="tabs" aria-label=${s.categories}>
        ${cats.map((c, i) => {
          const on = c.id === catId;
          return html`<button
            role="tab"
            part="tab"
            data-id=${c.id}
            aria-selected=${on}
            tabindex=${on ? 0 : -1}
            @click=${() => (this.category = c.id)}
            @keydown=${(e: KeyboardEvent) => this.#tabKey(e, i)}
          >
            ${c.label} <span class="num">${all.filter((x) => x.category === c.id).length}</span>
          </button>`;
        })}
      </div>
      <div role="tabpanel" aria-label=${cat?.label ?? ''}>
        <div>
          <div class="head">
            <h3>${s.songsIn(cat?.label ?? '')}</h3>
            <span>${s.showing(shown.length, inCat.length)}</span>
          </div>
          ${inCat.length ? this.#search() : nothing}
          ${
            !inCat.length
              ? html`<p class="empty">${s.emptyCategory(cat?.label ?? '')}</p>`
              : shown.length
                ? html`<div class="cards">${shown.map((x) => this.#card(x, x === song))}</div>`
                : html`<p class="empty">${s.noMatch}</p>`
          }
        </div>
      </div>
    `;
  }

  #search() {
    return html`<input
      type="search"
      placeholder=${this.strings.search}
      aria-label=${this.strings.search}
      .value=${this.query}
      @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
    />`;
  }

  #card(x: Song, on: boolean) {
    return html`<button part="card" aria-pressed=${on} @click=${() => this.#pickSong(x)}>
      <span class="card-title"
        ><span>${x.title}</span><span class="num">${formatTime(x.versions[0]?.duration ?? 0)}</span></span
      >
      <span>${x.authorship}</span>
    </button>`;
  }
}
