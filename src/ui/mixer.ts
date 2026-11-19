// Block 2, left of the lanes: one channel strip per lane with colour, name, volume, Mute, Solo and the render it plays.
// Each strip is as tall as its lane (--dt-player-lane-height), and the header as tall as the ruler, so placed in the
// piano roll's `mixer` slot the strips line up with the notes.
import { css, html } from 'lit';
import type { Channel } from '../catalog/schema';
import { PlayerElement, channelColor, tokens } from './base';

export class DtMixer extends PlayerElement {
  static override styles = [
    tokens,
    css`
      :host {
        width: var(--dt-player-mixer-width, 420px);
        background: var(--_roll-bg);
        color: var(--_roll-text);
        border: var(--_border) solid var(--_primary);
        border-right-width: 0;
      }
      .head {
        height: 40px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-family: var(--_font-title);
        font-weight: 700;
        font-size: 18px;
        text-transform: uppercase;
        background: var(--_roll-alt);
      }
      [part='mixer-channel'] {
        height: var(--_lane);
        border-top: 1px solid var(--_roll-grid);
        padding: 4px 10px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        grid-template-rows: 1fr 1fr;
        align-items: center;
        gap: 2px 6px;
      }
      [part='mixer-channel']:nth-of-type(even) {
        background: var(--_roll-alt);
      }
      .name {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-weight: 700;
      }
      .name span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .swatch {
        flex: none;
        width: 14px;
        height: 14px;
      }
      button {
        min-height: 30px;
        padding: 0 8px;
        background: transparent;
        border-color: var(--_roll-grid);
      }
      button[aria-pressed='true'] {
        background: var(--_accent);
        border-color: var(--_accent);
        color: var(--_on-accent);
      }
      .vol {
        grid-column: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .vol input {
        flex: 1;
        min-width: 60px;
        accent-color: var(--_accent);
      }
      .vol .num {
        width: 3ch;
        text-align: right;
      }
      select {
        grid-column: 2 / span 2;
        max-width: 160px;
        min-height: 30px;
        background: var(--_roll-bg);
        border: 1px solid var(--_roll-grid);
        border-radius: var(--_radius);
      }
      @media (max-width: 700px) {
        :host {
          width: auto;
          border-right-width: var(--_border);
        }
        [part='mixer-channel'] {
          height: auto;
          min-height: var(--_lane);
          grid-template-columns: minmax(0, 1fr) auto auto;
          grid-template-rows: auto auto;
          padding: 8px 10px;
        }
        select {
          max-width: none;
        }
      }
    `,
  ];

  #key(e: KeyboardEvent, ch: number) {
    const eng = this.engine;
    const target = e.composedPath()[0] as HTMLElement;
    if (!eng || target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'm') eng.setMuted(ch, !eng.isMuted(ch));
    else if (k === 's') eng.setSoloed(ch, !eng.isSoloed(ch));
    else return;
    e.preventDefault();
  }

  #strip(c: Channel, i: number) {
    const s = this.strings;
    const e = this.engine;
    const vol = e ? Math.round(e.volumeOf(c.channel) * 100) : 100;
    const own = e?.versionOf(c.channel)?.id ?? this.activeVersion?.id;
    // only renders that have this channel can play it
    const versions = (this.activeSong?.versions ?? []).filter((v) =>
      (v.channels ?? this.activeSong?.channels ?? []).some((x) => x.channel === c.channel),
    );
    return html`<div
      part="mixer-channel"
      tabindex="0"
      aria-label=${`${c.name}. ${s.channelHint}`}
      @keydown=${(ev: KeyboardEvent) => this.#key(ev, c.channel)}
    >
      <span class="name" title=${c.name}
        ><span class="swatch" style="background:${channelColor(i)}"></span><span>${c.name}</span></span
      >
      <button
        aria-pressed=${e?.isMuted(c.channel) ?? false}
        @click=${() => e?.setMuted(c.channel, !e.isMuted(c.channel))}
      >
        ${s.mute}
      </button>
      <button
        aria-pressed=${e?.isSoloed(c.channel) ?? false}
        @click=${() => e?.setSoloed(c.channel, !e.isSoloed(c.channel))}
      >
        ${s.solo}
      </button>
      <label class="vol"
        >Vol
        <input
          type="range"
          min="0"
          max="150"
          step="1"
          .value=${String(vol)}
          aria-label=${s.channelVolume(c.name)}
          aria-valuetext=${`${vol}%`}
          @input=${(ev: Event) => e?.setVolume(c.channel, Number((ev.target as HTMLInputElement).value) / 100)}
        /><span class="num">${vol}</span></label
      >
      <select
        aria-label=${s.channelVersion(c.name)}
        @change=${(ev: Event) => {
          const id = (ev.target as HTMLSelectElement).value;
          e?.setChannelVersion(c.channel, id === e.version?.id ? null : id);
        }}
      >
        ${versions.map((v) => html`<option value=${v.id} .selected=${v.id === own}>${v.label}</option>`)}
      </select>
    </div>`;
  }

  override render() {
    return html`<div class="head">${this.strings.mixerChannels}</div>
      ${this.lanes.map((c, i) => this.#strip(c, i))}`;
  }
}
