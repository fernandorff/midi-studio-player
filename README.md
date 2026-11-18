# midi-studio-player

A browser music player for MIDI compositions rendered to **stems**: one audio file per MIDI channel and per render
(SoundFont). It plays the stems as one mix with a per-channel mixer, switches renders at the same position for A/B
listening, and gives a piano roll the MIDI notes in seconds.

Status: **0.0.0.** A headless engine plus Web Components built with Lit (`<dt-music-app>`, `<dt-library>`,
`<dt-transport>`, `<dt-piano-roll>`, `<dt-mixer>`, `<dt-track-notes>`). Not published to npm yet.

## Install

```bash
npm install midi-studio-player
```

ES module only, with TypeScript declarations. One runtime dependency, `lit`, kept external so a page with other Lit
elements loads it once. Importing the package registers the elements.

## Use

```ts
import { PlayerEngine, parseCatalog, readMidi } from 'midi-studio-player';

const parsed = parseCatalog(await (await fetch('/music/catalog.json')).json());
if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
const song = parsed.value.songs[0]!;

const engine = new PlayerEngine({ context: new AudioContext() });
engine.on('progress', ({ channel, loaded }) => console.log(channel, loaded));
engine.on('time', ({ position }) => console.log(position));
await engine.setSong(song); // downloads and decodes the stems of the first version

await engine.play(); // call from a user gesture: browsers keep audio suspended until one
engine.setSoloed(0, true);
engine.setVersion('sc88p'); // A/B: same position, other render
engine.setChannelVersion(9, 'gm'); // drums from another render
engine.setTreated(true);
engine.on('change', redraw); // any setter or seek; stemStatus(ch), volumeOf(ch) feed a mixer view

// the piano roll draws the active version's MIDI
const midi = readMidi(await (await fetch(engine.version!.midi)).arrayBuffer());
```

### Components

```html
<dt-music-app src="/music/catalog.json"></dt-music-app>
<script type="module">
  import 'midi-studio-player';
</script>
```

`<dt-music-app>` stacks three blocks at full width: the library, the transport with piano roll and mixer, and the
track notes. It takes `catalog` (object) or `src` (URL, validated with `parseCatalog`), creates the `PlayerEngine` and
its `AudioContext` on the first pointer or key press inside it (or Space anywhere), and closes that context when it is
removed. Space plays and pauses outside text fields and buttons.

Each piece also works alone with an `engine` property (yours, sharing your `AudioContext`); until there is one it
shows the `song` and `versionId` properties. Every component redraws on the engine's `change`, `state` and `progress`
events, so several views of one engine stay in step.

- `<dt-library>`: category tabs with counts (an empty category says so), song cards with search (title or authorship,
  case and accents ignored), the version list with the A and B marks, finish Treated/Original, and the A|B switch at
  the same point. It fires `dt-song` (`{ song }`) and `dt-ab` (`{ a, b, active }`) so a host can follow the choice.
- `<dt-transport>`: play/pause, time and length, position bar, the sounding version (A/B, label, finish), loop,
  master volume and stem loading.
- `<dt-piano-roll>`: tempo and bar count, clickable overview, bar ruler and one lane per channel with the active
  version's notes over the whole song. The needle follows playback; click or use the arrows (one bar) to seek.
- `<dt-mixer>`: one strip per lane with colour, name, volume, Mute, Solo and the render it plays; M and S work on a
  focused strip. Placed in the roll's `mixer` slot, the strips line up with the lanes.
- `<dt-track-notes>`: story (with a Draft badge when `storyDraft`), where it plays, measurements with their source,
  checks done and pending, and references opening in a new tab ("study only" when `study`).

#### Styling

The default theme (`theme="field"`) follows the Dungeon Tactics lab design system: petrol green, cinnabar, navy and
ochre on linen, square corners, 2 px borders and hard shadows. `theme="frontier"` pins the B-2 "Frontier Archive"
identity (near-black ink, 4 px petrol shadow, darker roll) and raises every button, select and slider to 44 px, with
taller lanes to fit them. `theme="dark"` is an example dark theme. Any token can
be set on an ancestor:

| Token                                                                                           | Default                                                        |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `--dt-player-bg`, `--dt-player-surface`                                                         | `#EAF0F5`, `#FFFFFF`                                           |
| `--dt-player-text`, `--dt-player-muted`                                                         | `#111827`, `#4B5563`                                           |
| `--dt-player-primary`, `--dt-player-on-primary`                                                 | `#1B494D`, `#FFFFFF`                                           |
| `--dt-player-accent`, `--dt-player-navy`, `--dt-player-ochre`                                   | `#D04A36`, `#1C3D5A`, `#C98A2C` (ochre is also the focus ring) |
| `--dt-player-line`                                                                              | `#D0DCE4`                                                      |
| `--dt-player-roll-bg`, `--dt-player-roll-alt`, `--dt-player-roll-grid`, `--dt-player-roll-text` | the dark piano roll and mixer                                  |
| `--dt-player-channel-0` to `--dt-player-channel-7`                                              | lane colours, by lane index                                    |
| `--dt-player-font-title`, `--dt-player-font-text`, `--dt-player-font-number`                    | Barlow Condensed, Source Serif 4, Space Mono (numbers only)    |
| `--dt-player-radius`, `--dt-player-border`, `--dt-player-shadow`                                | `0`, `2px`, `3px 3px 0 #1B494D`                                |
| `--dt-player-space`, `--dt-player-lane-height`, `--dt-player-mixer-width`                       | `16px`, `76px`, `420px`                                        |

The package loads no fonts (a `@font-face` inside a shadow root is ignored): load them in the page, as the demo does.
Parts: `tabs`, `tab`, `card`, `transport`, `roll`, `overview`, `lane`, `mixer-channel`, `notes` (re-exported by
`<dt-music-app>`). Text is 16 px or larger everywhere and focus is always visible. Under 700 px the blocks stay
stacked, the tabs and the roll scroll sideways and the mixer sits above the roll.

#### Labels

Labels are Brazilian Portuguese by default. Pass `strings` (`import { en } from 'midi-studio-player'`, or your own
object of type `Strings`) to any component.

### Catalog

```jsonc
{
  "categories": [{ "id": "battle", "label": "Battle", "order": 1 }],
  "songs": [
    {
      "id": "battle-c",
      "title": "March of Ashes",
      "category": "battle",
      "authorship": "Composer name",
      "story": "optional",
      "storyDraft": true,
      "whereItPlays": "optional",
      "versions": [
        {
          "id": "sc88p",
          "label": "SC-88Pro",
          "stemsBase": "/stems/batalha_C_sc88p",
          "midi": "/midi/batalha_C.mid",
          "duration": 94.5,
        },
      ],
      "channels": [{ "channel": 0, "program": 42, "name": "Cello" }],
      "references": [{ "label": "Trisection", "url": "https://…", "study": true }],
      "measurements": [{ "label": "Length", "value": "94.5 s", "source": "stems.json" }],
      "checks": [{ "text": "Someone listened", "state": "pending" }],
      "tags": { "style": ["orchestral"], "mood": ["tense"] },
    },
  ],
}
```

`parseCatalog(unknown)` checks every field (the JSON comes from outside) and returns `{ ok: true, value }` or
`{ ok: false, errors }`, each error with the path of the field. URLs must be http(s) or paths.

`parseStemsManifest(unknown)` reads the `stems.json` a stem renderer writes (`{ duracao, stems: [{ canal, programa,
nome }] }`, 1-based `canal`) into a duration and 0-based channels, to build versions from existing renders.

## Architecture

```
src/catalog/   schema.ts (types), parse-catalog.ts (validation at the trust boundary)
src/midi/      read-midi.ts: Standard MIDI File reader, notes in seconds with the tempo map applied
src/engine/    PlayerEngine.ts: stems, transport, mixer, versions, treatment; synth.ts: interface for live synthesis
src/ui/        Lit components; base.ts (tokens, engine binding), math.ts (bars, time/x, search), strings.ts (labels)
demo/          Vite page with a sample catalog; its audio is copied in by `npm run demo:assets`
```

The engine takes an injected `AudioContext` (or anything matching `AudioContextLike`), `fetch` and frame scheduler, so
it runs in tests without Web Audio and shares a context with the host's other audio. It never closes the context.

Graph: `stem source → channel gain → master gain → [treatment chain] → destination`.

## Decisions

- **Channels are 0-based MIDI channels everywhere** (drums = 9), as in the MIDI bytes and the stem file names
  (`${stemsBase}/${channel}.ogg`). Sources in 1-based numbering convert at the edge (`parseStemsManifest`).
- **Channels belong to the render, with the song's as default.** Most renders share the song's channels, but SoundFont
  banks without a General MIDI drum kit move the drums to melodic channels (measured on the source renders: the
  Tactical Fantasy Guy render of one piece has channels 0–8 and 10, and no 9). A version lists its own `channels`
  when they differ; the lanes follow the active version.
- **The piano roll draws the active version's MIDI.** Each render may come from its own MIDI: for General MIDI banks the
  files are byte-identical, while banks with other program maps change programs, move or drop drum notes and, in some
  renders, move a part to another channel (measured on 32 renders of 4 pieces; the note timing and the end of the last
  note never change). Only the MIDI of the render that is playing matches the channels of its stems.
- **A/B keeps the position in absolute seconds**, wrapped to the new loop when it is shorter. Renders of one MIDI share
  its timing and differ only in the reverb tail after the last note (in the source library, 363 of 368 render pairs
  have equal durations; the 5 exceptions are renders of one MIDI whose notes end at 144.7 s in every render, while the
  audio lasts 147.8 to 157.1 s). A proportional offset would
  shift the music.
- **One loop length for all stems**: the active version's duration. Every source loops at that point, and a stem
  shorter than the loop is padded with silence, so stems from different renders never drift apart.
- **A swapped stem starts on a scheduled tick** (50 ms ahead) at the offset of that tick, and the old one stops on the
  same tick, so there is no gap or overlap.
- **Solo is exclusive**: while any channel is soloed only soloed channels sound; several can be soloed; mute wins.
- **Per-channel render choice** (`setChannelVersion`): a channel may play another version's stem. When that version has
  no such channel, the active version's stem plays, and nothing is requested that does not exist.
- **"Treated" is a filter chain, not a file**: highpass 32 Hz, high shelf −6 dB at 2.5 kHz, compressor (−22 dB, 3.5:1),
  +3 dB makeup and a −3 dB ceiling, an approximation of an offline ffmpeg treatment. It sits after the master gain, so
  the mixer works the same with it on or off.
- **Pause stops the sources** instead of suspending the context, because the context may be shared with other audio.
- **Saved mixer presets stay with the host.** The engine exposes the state they need (`versionOf`, `effectiveGain`,
  `isMuted`, `isSoloed`, `setChannelVersion`, `setVolume`).
- **The piano roll draws on canvas, one per lane.** A piece has thousands of notes, and SVG would keep one DOM node
  per note. Lanes redraw only when the song, mute/solo, size or theme changes; the needle is a CSS line moved each
  frame.
- **Bars assume one tempo and 4/4**, from the MIDI's first tempo: 132 bpm over 94.5 s gives the 52 bars of the score.
  Pieces with tempo or metre changes need the tempo and time-signature maps.
- **The whole song fits the lane width**, as in the approved design, so a click anywhere seeks there; under 700 px the
  lanes keep 640 px and scroll.
- **Only `<dt-music-app>` creates an AudioContext**, on a user gesture; the other components use the host's engine.
- **Live synthesis is an interface only** (`Synth`), to be implemented with SpessaSynth as an optional dependency.

## Demo

```bash
npm run demo:assets   # copies stems and MIDI from the host project into demo/assets (gitignored)
npm run dev           # http://localhost:5310
```

`demo:assets` reads `DEMO_ASSETS_SOURCE` (default: the Dungeon Tactics lab's `public/content/musica`), a folder with
`stems/<render>/<channel>.ogg` and `midi/<render>.mid`. The sample catalog has two Dungeon Tactics pieces in two
renders each, made with SoundFonts whose licences allow it:

- **FluidR3** by Frank Wen, released under the MIT licence.
- **GeneralUser GS v2.0.3** by S. Christian Collins, GeneralUser GS License v2.0, which allows use "without
  restriction for your own music creation, private or commercial" (<https://www.schristiancollins.com>).

The demo exposes `window.__player` (the app, its engine and context, and the gain each lane plays through) for browser
checks.

## Develop

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## License

MIT, © Fernando Fonteles.
