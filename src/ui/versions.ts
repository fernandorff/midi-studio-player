// The version list with the A and B marks, the finish and the A|B switch for the song being played. It sits beside the
// piano roll so changing a version never means scrolling away from it. Picking a version calls the engine when there
// is one and always fires `dt-ab`, so a host without an engine can follow the choice.
import { css, html, type PropertyValues } from 'lit';
import type { Song } from '../catalog/schema';
import { PlayerElement, tokens } from './base';
import type { AbState } from './library';

export class DtVersions extends PlayerElement {
  static override properties = { ab: { attribute: false } };
  static override styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .versions {
        display: grid;
        gap: 8px;
        margin-bottom: 12px;
        max-height: 220px; /* a few rows; the rest scrolls so the roll stays in view */
        overflow-y: auto;
        padding: 2px 6px 6px 2px;
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
    `,
  ];

  declare ab: AbState;

  constructor() {
    super();
    this.ab = { a: undefined, b: undefined, active: 'a' };
  }

  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    // a song set from outside (or a first render) starts with its first two versions as A and B
    const v = this.activeSong?.versions;
    if (v && !v.some((x) => x.id === this.ab.a)) this.ab = { a: v[0]?.id, b: (v[1] ?? v[0])?.id, active: 'a' };
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
    this.dispatchEvent(new CustomEvent('dt-ab', { detail: { ...this.ab }, bubbles: true, composed: true }));
  }

  override render() {
    const song = this.activeSong;
    return song ? this.#renderVersions(song) : html``;
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
