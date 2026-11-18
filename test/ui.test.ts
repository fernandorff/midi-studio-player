// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalog, Song } from '../src/catalog/schema';
import { PlayerEngine } from '../src/engine/PlayerEngine';
import { DtLibrary, DtMixer, DtTransport, en } from '../src/index';
import {
  barAt,
  barCount,
  barSeconds,
  filterSongs,
  formatTime,
  pitchRanges,
  rulerBars,
  timeToX,
  xToTime,
} from '../src/ui/math';
import { FakeContext, fakeFetch } from './fake-audio';

const song = (id: string, title: string, category: string, authorship = 'Dungeon Tactics'): Song => ({
  id,
  title,
  category,
  authorship,
  channels: [
    { channel: 0, program: 42, name: 'Cello' },
    { channel: 9, program: null, name: 'Drums' },
  ],
  versions: [
    { id: 'fluidr3', label: 'FluidR3', stemsBase: `/s/${id}_fluidr3`, midi: `/m/${id}.mid`, duration: 94.5 },
    { id: 'gugs', label: 'GeneralUser GS', stemsBase: `/s/${id}_gugs`, midi: `/m/${id}.mid`, duration: 94.5 },
  ],
  references: [],
  measurements: [],
  checks: [],
});

const march = song('march', 'Marcha das Cinzas', 'battle');
const catalog: Catalog = {
  categories: [
    { id: 'town', label: 'Cidade', order: 2 },
    { id: 'battle', label: 'Batalha', order: 1 },
    { id: 'menu', label: 'Menu', order: 3 },
  ],
  songs: [march, song('bread', 'Pão e Lareira', 'town', 'tema B'), song('embers', 'Brasas', 'battle')],
};

describe('roll maths', () => {
  it('counts bars from the tempo, as measured on the lab pieces', () => {
    expect(barSeconds(120)).toBe(2);
    expect(barCount(94.545442, 132)).toBe(52); // Marcha das Cinzas: 52 bars by its score
    expect(barCount(126.315782, 76)).toBe(40); // Pão e Lareira: 40 bars by its score
    expect(barAt(0, 132, 52)).toBe(1);
    expect(barAt(1.82, 132, 52)).toBe(2);
    expect(barAt(94.5, 132, 52)).toBe(52); // the reverb tail never makes a bar 53
  });

  it('maps time to x and back, clamped to the song', () => {
    expect(timeToX(25, 100, 800)).toBe(200);
    expect(xToTime(200, 100, 800)).toBe(25);
    expect(xToTime(-5, 100, 800)).toBe(0);
    expect(xToTime(900, 100, 800)).toBe(100);
    expect(timeToX(10, 0, 800)).toBe(0);
  });

  it('spaces ruler labels so they never touch', () => {
    expect(rulerBars(52, 1040)).toEqual([1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52]); // 20 px a bar
    expect(rulerBars(8, 800)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('formats m:ss and finds each channel pitch range', () => {
    expect(formatTime(94.5)).toBe('1:34');
    expect(formatTime(-1)).toBe('0:00');
    const ranges = pitchRanges([
      { channel: 0, pitch: 50 },
      { channel: 0, pitch: 62 },
      { channel: 9, pitch: 36 },
    ]);
    expect([...ranges]).toEqual([
      [0, [50, 62]],
      [9, [36, 36]],
    ]);
  });

  it('filters by category and by title or authorship, ignoring case and accents', () => {
    expect(filterSongs(catalog.songs, 'battle', '').map((s) => s.id)).toEqual(['march', 'embers']);
    expect(filterSongs(catalog.songs, 'battle', 'cinzas').map((s) => s.id)).toEqual(['march']);
    expect(filterSongs(catalog.songs, 'town', 'PAO').map((s) => s.id)).toEqual(['bread']);
    expect(filterSongs(catalog.songs, 'town', 'tema b').map((s) => s.id)).toEqual(['bread']);
    expect(filterSongs(catalog.songs, 'menu', '')).toEqual([]);
  });
});

async function engineFor(s: Song) {
  const files: Record<string, number> = {};
  for (const v of s.versions) for (const c of s.channels) files[`${v.stemsBase}/${c.channel}.ogg`] = v.duration;
  const engine = new PlayerEngine({
    context: new FakeContext().asContext(),
    fetch: fakeFetch(files).fetch,
    requestFrame: () => () => undefined,
  });
  await engine.setSong(s);
  return engine;
}

async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(el: T) {
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const shadow = (el: HTMLElement) => el.shadowRoot!;
const buttons = (el: HTMLElement, text: string) =>
  [...shadow(el).querySelectorAll('button')].filter((b) => b.textContent!.trim() === text);

afterEach(() => document.body.replaceChildren());

describe('dt-mixer with an engine', () => {
  it('shows mute and solo as pressed buttons and sets the engine', async () => {
    const engine = await engineFor(march);
    const mixer = await mount(Object.assign(new DtMixer(), { engine }));
    const [mute] = buttons(mixer, 'Mudo');
    const solo = buttons(mixer, 'Solo')[1]!;
    expect(mute!.getAttribute('aria-pressed')).toBe('false');
    mute!.click();
    solo.click();
    await mixer.updateComplete;
    expect(engine.isMuted(0)).toBe(true);
    expect(engine.isSoloed(9)).toBe(true);
    expect(mute!.getAttribute('aria-pressed')).toBe('true');
    expect(solo.getAttribute('aria-pressed')).toBe('true');
    expect([0, 9].map((c) => engine.effectiveGain(c))).toEqual([0, 1]);
  });

  it('toggles mute and solo with M and S on the focused strip', async () => {
    const engine = await engineFor(march);
    const mixer = await mount(Object.assign(new DtMixer(), { engine }));
    const strip = shadow(mixer).querySelector<HTMLElement>('[part="mixer-channel"]')!;
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    expect([engine.isMuted(0), engine.isSoloed(0)]).toEqual([true, true]);
  });

  it('labels the volume slider with its value and follows the strings', async () => {
    const engine = await engineFor(march);
    engine.setVolume(0, 0.84);
    const mixer = await mount(Object.assign(new DtMixer(), { engine, strings: en }));
    const slider = shadow(mixer).querySelector('input[type="range"]')!;
    expect(slider.getAttribute('aria-valuetext')).toBe('84%');
    expect(slider.getAttribute('aria-label')).toBe('Cello volume');
    expect(buttons(mixer, 'Mute')).toHaveLength(2);
  });
});

describe('frontier theme', () => {
  it('sets the B-2 tokens and 44 px targets', async () => {
    const mixer = await mount(Object.assign(new DtMixer(), { song: march, theme: 'frontier' }));
    const style = getComputedStyle(mixer);
    expect(style.getPropertyValue('--dt-player-text')).toBe('#0f172a');
    expect(style.getPropertyValue('--dt-player-shadow')).toBe('4px 4px 0 #1b494d');
    expect(getComputedStyle(buttons(mixer, 'Mudo')[0]!).minHeight).toBe('44px');
  });
});

describe('dt-library', () => {
  it('lists every category with its count, empty ones included, in order', async () => {
    const lib = await mount(Object.assign(new DtLibrary(), { catalog, song: march }));
    const tabs = [...shadow(lib).querySelectorAll('[role="tab"]')].map((t) =>
      t.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual(['Batalha 2', 'Cidade 1', 'Menu 0']);
    shadow(lib).querySelectorAll<HTMLElement>('[role="tab"]')[2]!.click();
    await lib.updateComplete;
    expect(shadow(lib).querySelector('.empty')!.textContent).toBe('Ainda não há músicas em Menu.');
  });

  it('switches A|B on the engine and keeps the position', async () => {
    const engine = await engineFor(march);
    engine.seek(24);
    const lib = await mount(Object.assign(new DtLibrary(), { catalog, engine }));
    const [a, b] = shadow(lib).querySelectorAll<HTMLButtonElement>('.switch button');
    expect([a!.getAttribute('aria-pressed'), b!.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
    b!.click();
    await lib.updateComplete;
    expect(engine.version!.id).toBe('gugs');
    expect(engine.position).toBe(24);
    expect([a!.getAttribute('aria-pressed'), b!.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
  });

  it('picks a song from the cards and tells the host', async () => {
    const engine = await engineFor(march);
    const lib = await mount(Object.assign(new DtLibrary(), { catalog, engine }));
    let picked = '';
    lib.addEventListener('dt-song', (e) => (picked = (e as CustomEvent<{ song: Song }>).detail.song.id));
    const card = [...shadow(lib).querySelectorAll<HTMLElement>('[part="card"]')].find((c) =>
      c.textContent!.includes('Brasas'),
    )!;
    card.click();
    expect(picked).toBe('embers');
    expect(engine.song!.id).toBe('embers');
  });
});

describe('dt-transport', () => {
  it('shows the loop and the play state of the engine', async () => {
    const engine = await engineFor(march);
    const t = await mount(Object.assign(new DtTransport(), { engine }));
    expect(buttons(t, '↻ Repetir')[0]!.getAttribute('aria-pressed')).toBe('true');
    buttons(t, '↻ Repetir')[0]!.click();
    expect(engine.loop).toBe(false);
    await engine.play();
    await t.updateComplete;
    expect(shadow(t).querySelector('.play')!.textContent!.trim()).toBe('❚❚ Pausar');
    expect(shadow(t).querySelector('input[type="range"]')!.getAttribute('aria-valuetext')).toBe('0:00 de 1:34');
  });
});
