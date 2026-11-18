import { en, ptBR, type DtMusicApp } from '../src/index';

// demo only: keep every GainNode the page creates, so a test can read the gains the engine really set
const gains: GainNode[] = [];
let context: BaseAudioContext | undefined;
const createGain = AudioContext.prototype.createGain;
AudioContext.prototype.createGain = function (this: AudioContext) {
  const g = createGain.call(this);
  context = g.context;
  gains.push(g);
  return g;
};

const app = document.querySelector<DtMusicApp>('dt-music-app')!;
document.querySelector<HTMLSelectElement>('#theme')!.onchange = (e) =>
  (app.theme = (e.target as HTMLSelectElement).value);
document.querySelector<HTMLSelectElement>('#lang')!.onchange = (e) =>
  (app.strings = (e.target as HTMLSelectElement).value === 'en' ? en : ptBR);

// debug handle for browser checks; the engine creates its master gain and the treatment's makeup gain first, then
// one gain per lane in lane order
Object.assign(globalThis, {
  __player: {
    app,
    get engine() {
      return app.engine;
    },
    get context() {
      return context;
    },
    laneGains: () =>
      Object.fromEntries((app.engine?.channels ?? []).map((c, i) => [c.channel, gains[i + 2]?.gain.value])),
  },
});
