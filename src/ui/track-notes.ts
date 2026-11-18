// Block 3: the song's story (with a Draft badge), where it plays, its measurements, checks and references.
import { css, html, nothing } from 'lit';
import { PlayerElement, tokens } from './base';

export class DtTrackNotes extends PlayerElement {
  static override styles = [
    tokens,
    css`
      [part='notes'] {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: calc(var(--_space) * 1.5);
      }
      .col {
        display: grid;
        gap: 12px;
        align-content: start;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .badge {
        background: var(--_accent);
        color: #ffffff;
        padding: 0 10px;
        font-weight: 700;
      }
      .box {
        border: var(--_border) solid var(--_line);
        background: var(--_surface);
        padding: 10px 12px;
        margin: 0;
      }
      .measures {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        margin: 0;
      }
      .measures div {
        border: var(--_border) solid var(--_primary);
        padding: 8px 10px;
      }
      dt {
        color: var(--_muted);
      }
      dd {
        margin: 0;
        font-weight: 700;
      }
      .source {
        color: var(--_muted);
        font-style: italic;
        font-weight: 400;
        font-family: var(--_font-text);
      }
      .checks {
        border: var(--_border) solid var(--_primary);
        padding: 10px 12px;
      }
      .checks.pending {
        border-color: var(--_accent);
      }
      .checks h4 {
        margin: 0;
        font-family: var(--_font-title);
        font-size: 18px;
        text-transform: uppercase;
      }
      ul {
        margin: 6px 0 0;
        padding-left: 20px;
      }
      .refs {
        list-style: none;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .refs a {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        min-height: 44px;
        align-items: center;
        border: var(--_border) solid var(--_primary);
        padding: 6px 12px;
        color: var(--_text);
        text-decoration: none;
      }
      .refs a:hover {
        background: var(--_bg);
      }
      .study {
        color: var(--_accent);
        font-weight: 700;
        white-space: nowrap;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .muted {
        color: var(--_muted);
      }
      @media (max-width: 900px) {
        [part='notes'] {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  override render() {
    const s = this.strings;
    const song = this.activeSong;
    if (!song) return nothing;
    const done = song.checks.filter((c) => c.state === 'done');
    const pending = song.checks.filter((c) => c.state === 'pending');
    return html`<div part="notes">
      <div class="col">
        <div class="head">
          <h3>${s.story}</h3>
          ${song.storyDraft ? html`<span class="badge">${s.draft}</span>` : nothing}
        </div>
        <p class="box">${song.story ?? s.noStory}</p>
        <h3>${s.whereItPlays}</h3>
        <p class="box">${song.whereItPlays ?? s.undecided}</p>
      </div>
      <div class="col">
        <h3>${s.measurements}</h3>
        ${
          song.measurements.length
            ? html`<dl class="measures">
                ${song.measurements.map(
                  (m) =>
                    html`<div>
                      <dt>${m.label}</dt>
                      <dd class="num">${m.value}</dd>
                      <dd class="source">${s.source}: ${m.source}</dd>
                    </div>`,
                )}
              </dl>`
            : html`<p class="muted">${s.nothingYet}</p>`
        }
      </div>
      <div class="col">
        <h3>${s.checks}</h3>
        ${song.checks.length ? nothing : html`<p class="muted">${s.nothingYet}</p>`}
        ${
          done.length
            ? html`<div class="checks">
                <h4>${s.done}</h4>
                <ul>
                  ${done.map((c) => html`<li>${c.text}</li>`)}
                </ul>
              </div>`
            : nothing
        }
        ${
          pending.length
            ? html`<div class="checks pending">
                <h4>${s.pending}</h4>
                <ul>
                  ${pending.map((c) => html`<li>${c.text}</li>`)}
                </ul>
              </div>`
            : nothing
        }
        <h3>${s.references}</h3>
        ${
          song.references.length
            ? html`<ul class="refs">
                ${song.references.map(
                  (r) =>
                    html`<li>
                      <a href=${r.url} target="_blank" rel="noopener noreferrer"
                        ><span>${r.label}</span
                        >${r.study ? html`<span class="study">${s.studyOnly}</span>` : nothing}<span aria-hidden="true"
                          >↗</span
                        ><span class="sr">${s.newTab}</span></a
                      >
                    </li>`,
                )}
              </ul>`
            : html`<p class="muted">${s.nothingYet}</p>`
        }
      </div>
    </div>`;
  }
}
