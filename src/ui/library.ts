// Block 1: category tabs, the song cards with search, the version list with the A and B marks, the finish and the
// A|B switch. Picking a song or a version calls the engine when there is one and always fires an event, so a host
// without an engine can follow the choice.
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
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: calc(var(--_space) * 1.5);
      }
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
      .versions {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }
      .version {
        display: flex;
        justify-content: space-between;
        text-align: left;
        border-color: var(--_line);
      }
      .version.is-a,
      .version.is-b {
        border-color: var(--_primary);
      }
      .version.playing {
        background: var(--_accent);
        border-color: var(--_accent);
        color: #ffffff;
      }
      .marks {
        font-family: var(--_font-number);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }
      .ab {
        border: var(--_border) solid var(--_accent);
        box-shadow: var(--_shadow);
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      .ab .slots {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .slot {
        border: 1px solid var(--_line);
        padding: 8px;
      }
      .slot.on {
        border-color: var(--_accent);
        color: var(--_accent);
      }
      .switch button {
        min-width: 48px;
      }
      .note {
        color: var(--_muted);
        font-style: italic;
        margin: 0;
      }
      @media (max-width: 700px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
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

  /** puts a version in the active slot and plays it */
  #pickVersion(id: string) {
    this.ab = { ...this.ab, [this.ab.active]: id };
    this.#play(id);
  }

  #switch(slot: 'a' | 'b') {
    this.ab = { ...this.ab, active: slot };
    const id = this.ab[slot];
    if (id) this.#play(id);
  }

  #play(id: string) {
    this.versionId = id;
    this.engine?.setVersion(id);
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
      <div class="grid" role="tabpanel" aria-label=${cat?.label ?? ''}>
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
        ${song ? this.#renderVersions(song) : nothing}
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

  #renderVersions(song: Song) {
    const s = this.strings;
    const playing = this.activeVersion?.id;
    const label = (id: string | undefined) => song.versions.find((v) => v.id === id)?.label ?? '';
    const treated = this.engine?.treated ?? false;
    return html`<div>
      <h3>${s.versions}</h3>
      <div class="versions">
        ${song.versions.map((v) => {
          const a = v.id === this.ab.a;
          const b = v.id === this.ab.b;
          return html`<button
            class="version ${a ? 'is-a' : ''} ${b ? 'is-b' : ''} ${v.id === playing ? 'playing' : ''}"
            aria-pressed=${v.id === playing}
            @click=${() => this.#pickVersion(v.id)}
          >
            <span>${v.label}</span><span class="marks">${a ? 'A' : ''}${b ? 'B' : ''}</span>
          </button>`;
        })}
      </div>
      <div class="row" role="group" aria-label=${s.finish}>
        <span>${s.finish}:</span>
        <button aria-pressed=${treated} @click=${() => this.engine?.setTreated(true)}>${s.treated}</button>
        <button aria-pressed=${!treated} @click=${() => this.engine?.setTreated(false)}>${s.original}</button>
      </div>
      <div class="ab">
        <div class="row" style="justify-content:space-between;margin:0">
          <h3>${s.abTitle}</h3>
          <span class="switch" role="group" aria-label=${s.abTitle}>
            <button aria-pressed=${this.ab.active === 'a'} @click=${() => this.#switch('a')}>A</button>
            <button aria-pressed=${this.ab.active === 'b'} @click=${() => this.#switch('b')}>B</button>
          </span>
        </div>
        <div class="slots">
          ${(['a', 'b'] as const).map(
            (slot) =>
              html`<div class="slot ${this.ab.active === slot ? 'on' : ''}">
                <strong>${slot === 'a' ? s.versionA : s.versionB}</strong>${
                  this.ab.active === slot ? ` (${s.playing})` : ''
                }<br />${label(this.ab[slot])}
              </div>`,
          )}
        </div>
        <p class="note">${s.abKeepsPoint}</p>
      </div>
    </div>`;
  }
}
