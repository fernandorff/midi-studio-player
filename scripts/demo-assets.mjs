// Copies the stems and MIDI files the demo catalog names from the host project into demo/assets (gitignored: the
// audio is large and stays out of the repository). The source folder holds `stems/` and `midi/`; set it with
// DEMO_ASSETS_SOURCE when the host project lives elsewhere.
import { cp, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

const source = resolve(process.env.DEMO_ASSETS_SOURCE ?? 'D:/Projetos/dungeon-tactics-labs/web/public/content/musica');
const demo = resolve(import.meta.dirname, '..', 'demo');
const catalog = JSON.parse(await readFile(join(demo, 'catalog.json'), 'utf8'));

// catalog paths look like assets/stems/<render> and assets/midi/<render>.mid
const paths = new Set(catalog.songs.flatMap((s) => s.versions.flatMap((v) => [v.stemsBase, v.midi])));
for (const path of paths) {
  const from = join(source, path.replace(/^assets\//, ''));
  const to = join(demo, path);
  await mkdir(join(to, '..'), { recursive: true });
  await cp(from, to, { recursive: true });
  process.stdout.write(`${from} -> ${to}\n`);
}
