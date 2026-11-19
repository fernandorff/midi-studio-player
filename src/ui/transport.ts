// Top of block 2: play/pause, time, the position bar, which version is sounding and the master volume.
import { css, html, nothing } from 'lit';
import { PlayerElement, tokens } from './base';
import type { AbState } from './library';
import { formatTime } from './math';

export class DtTransport extends PlayerElement {
  static override properties = { ab: { attribute: false } };
  static override styles = [
    tokens,
    css`
      [part='transport'] {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px 16px;
        padding: 12px var(--_space);
        background: var(--_primary);
        color: var(--_on-primary);
        border: var(--_border) solid var(--_primary);
      }
      button {
        background: transparent;
        border-color: var(--_on-primary);
        color: var(--_on-primary);
      }
      .play {
        background: var(--_accent);
        border-color: var(--_on-primary);
        color: var(--_on-accent);
        min-width: 112px;
        font-weight: 700;
      }
      button[aria-pressed='true'] {
        background: var(--_on-primary);
        color: var(--_primary);
      }
      :host([theme='dark']) .now strong {
        color: var(--_on-primary);
      }
      .now strong {
        font-family: var(--_font-title);
        font-size: 18px;
        text-transform: uppercase;
        color: var(--_gold-on-dark);
      }
      .seek {
        flex: 1 1 260px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      input[type='range'] {
        accent-color: var(--_accent);
        min-height: 32px;
      }
      .seek input {
        flex: 1;
        min-width: 120px;
      }
      label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .status {
        flex-basis: 100%;
        margin: 0;
      }
    `,
  ];

  declare ab: AbState | undefined;

  protected override onTime() {
    this.requestUpdate();
  }

  override render() {
    const s = this.strings;
    const e = this.engine;
    const v = this.activeVersion;
    const playing = e?.state === 'playing';
    const pos = this.position;
    const total = this.duration;
    const finish = (e?.treated ?? true) ? s.treated : s.original;
    return html`<div part="transport">
      <button class="play" @click=${() => (playing ? e?.pause() : void e?.play())} ?disabled=${!v}>
        ${playing ? `❚❚ ${s.pause}` : `▶ ${s.play}`}
      </button>
      <span class="now">${s.nowPlaying}: <strong>${v?.label ?? '—'} · ${finish}</strong></span>
      <span class="seek">
        <span class="num">${formatTime(pos)}</span>
        <input
          type="range"
          min="0"
          max=${total}
          step="0.1"
          .value=${String(pos)}
          aria-label=${s.position}
          aria-valuetext=${`${formatTime(pos)} ${s.of} ${formatTime(total)}`}
          @input=${(ev: Event) => e?.seek(Number((ev.target as HTMLInputElement).value))}
        />
        <span class="num">${formatTime(total)}</span>
      </span>
      <label
        >${s.volume}
        <input
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          .value=${String(e?.masterVolume ?? 1)}
          aria-valuetext=${`${Math.round((e?.masterVolume ?? 1) * 100)}%`}
          @input=${(ev: Event) => e?.setMasterVolume(Number((ev.target as HTMLInputElement).value))}
      /></label>
      ${this.#status()}
    </div>`;
  }

  #status() {
    const e = this.engine;
    if (!e?.song) return nothing;
    const lanes = e.channels.map((c) => e.stemStatus(c.channel));
    const failed = lanes.filter((r) => r === 'error').length;
    const done = lanes.filter((r) => r === 'ready').length;
    if (failed) return html`<p class="status" role="status">${this.strings.loadError}</p>`;
    if (done < lanes.length)
      return html`<p class="status" role="status">${this.strings.loading(done, lanes.length)}</p>`;
    return nothing;
  }
}
