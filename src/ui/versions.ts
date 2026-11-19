// The version list of the song being played. It sits beside the
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
      .version.playing {
        background: var(--_primary);
        border-color: var(--_primary);
        color: var(--_on-primary);
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
    return html`<div>
      <h3>${s.versions}</h3>
      <div class="versions">
        ${song.versions.map((v) => {
          return html`<button
            class="version ${v.id === playing ? 'playing' : ''}"
            aria-pressed=${v.id === playing}
            @click=${() => this.#pickVersion(v.id)}
          >
            <span>${v.label}</span>
          </button>`;
        })}
      </div>
    </div>`;
  }
}
