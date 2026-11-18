// Trust boundary: a catalog arrives as JSON from outside the package, so every field is checked and rebuilt here.
// Errors carry the path of the field (`songs[2].versions[0].duration: expected a number`) so a host can fix its data.
import type { Catalog, Category, Channel, Check, Measurement, Reference, Song, Version } from './schema';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

class Reader {
  errors: string[] = [];
  fail(path: string, message: string) {
    this.errors.push(`${path}: ${message}`);
  }
  object(v: unknown, path: string): Obj | undefined {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Obj;
    this.fail(path, 'expected an object');
  }
  string(o: Obj, key: string, path: string): string {
    const v = o[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
    this.fail(`${path}.${key}`, 'expected a non-empty string');
    return '';
  }
  optionalString(o: Obj, key: string, path: string): string | undefined {
    return o[key] === undefined ? undefined : this.string(o, key, path);
  }
  optionalBoolean(o: Obj, key: string, path: string): boolean | undefined {
    const v = o[key];
    if (v === undefined || typeof v === 'boolean') return v;
    this.fail(`${path}.${key}`, 'expected true or false');
  }
  number(o: Obj, key: string, path: string, check: (n: number) => boolean, rule: string): number {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v) && check(v)) return v;
    this.fail(`${path}.${key}`, `expected ${rule}`);
    return 0;
  }
  // URLs end up in href and fetch: only http(s) or paths, never javascript: or data:
  url(o: Obj, key: string, path: string): string {
    const v = this.string(o, key, path);
    if (!v) return v;
    let protocol = '';
    try {
      protocol = new URL(v, 'https://relative.invalid/').protocol;
    } catch {
      /* reported below */
    }
    if (protocol !== 'http:' && protocol !== 'https:') this.fail(`${path}.${key}`, 'expected an http(s) URL or a path');
    return v;
  }
  list<T>(o: Obj, key: string, path: string, item: (v: unknown, path: string) => T | undefined, required = true): T[] {
    const v = o[key];
    if (v === undefined && !required) return [];
    if (!Array.isArray(v)) {
      this.fail(`${path}.${key}`, 'expected an array');
      return [];
    }
    return v.flatMap((x, i) => {
      const r = item(x, `${path}.${key}[${i}]`);
      return r === undefined ? [] : [r];
    });
  }
  stringList(o: Obj, key: string, path: string): string[] | undefined {
    if (o[key] === undefined) return undefined;
    return this.list(o, key, path, (v, p) => {
      if (typeof v === 'string' && v.trim() !== '') return v;
      this.fail(p, 'expected a non-empty string');
    });
  }
  unique(items: { id: string }[], path: string) {
    const seen = new Set<string>();
    items.forEach((x, i) => {
      if (seen.has(x.id)) this.fail(`${path}[${i}].id`, `duplicate id "${x.id}"`);
      seen.add(x.id);
    });
  }
}

const isInt = (min: number, max: number) => (n: number) => Number.isInteger(n) && n >= min && n <= max;

function channel(r: Reader, v: unknown, path: string): Channel | undefined {
  const o = r.object(v, path);
  if (!o) return;
  const before = r.errors.length;
  const program = o.program === null ? null : r.number(o, 'program', path, isInt(0, 127), 'an integer 0..127 or null');
  const out = {
    channel: r.number(o, 'channel', path, isInt(0, 15), 'a 0-based MIDI channel 0..15'),
    program,
    name: r.string(o, 'name', path),
  };
  // an invalid entry is left out, so its placeholder number never shows up as a duplicate channel
  return r.errors.length === before ? out : undefined;
}

function channels(r: Reader, o: Obj, path: string): Channel[] {
  const list = r.list(o, 'channels', path, (v, p) => channel(r, v, p));
  const seen = new Set<number>();
  list.forEach((c, i) => {
    if (seen.has(c.channel)) r.fail(`${path}.channels[${i}].channel`, `duplicate channel ${c.channel}`);
    seen.add(c.channel);
  });
  return list;
}

function version(r: Reader, v: unknown, path: string): Version | undefined {
  const o = r.object(v, path);
  if (!o) return;
  const out: Version = {
    id: r.string(o, 'id', path),
    label: r.string(o, 'label', path),
    stemsBase: r.url(o, 'stemsBase', path),
    midi: r.url(o, 'midi', path),
    duration: r.number(o, 'duration', path, (n) => n > 0, 'a positive number of seconds'),
  };
  if (o.channels !== undefined) out.channels = channels(r, o, path);
  return out;
}

function song(r: Reader, v: unknown, path: string): Song | undefined {
  const o = r.object(v, path);
  if (!o) return;
  const versions = r.list(o, 'versions', path, (x, p) => version(r, x, p));
  if (Array.isArray(o.versions) && o.versions.length === 0) r.fail(`${path}.versions`, 'expected at least one version');
  r.unique(versions, `${path}.versions`);
  const out: Song = {
    id: r.string(o, 'id', path),
    title: r.string(o, 'title', path),
    category: r.string(o, 'category', path),
    authorship: r.string(o, 'authorship', path),
    versions,
    channels: channels(r, o, path),
    references: r.list(
      o,
      'references',
      path,
      (x, p): Reference | undefined => {
        const ro = r.object(x, p);
        if (!ro) return;
        const ref: Reference = { label: r.string(ro, 'label', p), url: r.url(ro, 'url', p) };
        if (r.optionalBoolean(ro, 'study', p)) ref.study = true;
        return ref;
      },
      false,
    ),
    measurements: r.list(
      o,
      'measurements',
      path,
      (x, p): Measurement | undefined => {
        const mo = r.object(x, p);
        return (
          mo && { label: r.string(mo, 'label', p), value: r.string(mo, 'value', p), source: r.string(mo, 'source', p) }
        );
      },
      false,
    ),
    checks: r.list(
      o,
      'checks',
      path,
      (x, p): Check | undefined => {
        const co = r.object(x, p);
        if (!co) return;
        const state = co.state;
        if (state !== 'done' && state !== 'pending') r.fail(`${p}.state`, 'expected "done" or "pending"');
        return { text: r.string(co, 'text', p), state: state === 'done' ? 'done' : 'pending' };
      },
      false,
    ),
  };
  const story = r.optionalString(o, 'story', path);
  if (story !== undefined) out.story = story;
  if (r.optionalBoolean(o, 'storyDraft', path)) out.storyDraft = true;
  const where = r.optionalString(o, 'whereItPlays', path);
  if (where !== undefined) out.whereItPlays = where;
  if (o.tags !== undefined) {
    const t = r.object(o.tags, `${path}.tags`);
    if (t) {
      const tags: NonNullable<Song['tags']> = {};
      const style = r.stringList(t, 'style', `${path}.tags`);
      const mood = r.stringList(t, 'mood', `${path}.tags`);
      if (style) tags.style = style;
      if (mood) tags.mood = mood;
      out.tags = tags;
    }
  }
  return out;
}

export function parseCatalog(input: unknown): ParseResult<Catalog> {
  const r = new Reader();
  const o = r.object(input, 'catalog');
  if (!o) return { ok: false, errors: r.errors };
  const categories = r.list(o, 'categories', 'catalog', (v, p): Category | undefined => {
    const c = r.object(v, p);
    return (
      c && {
        id: r.string(c, 'id', p),
        label: r.string(c, 'label', p),
        order: r.number(c, 'order', p, Number.isFinite, 'a number'),
      }
    );
  });
  r.unique(categories, 'catalog.categories');
  const songs = r.list(o, 'songs', 'catalog', (v, p) => song(r, v, p));
  r.unique(songs, 'catalog.songs');
  const known = new Set(categories.map((c) => c.id));
  songs.forEach((s, i) => {
    if (s.category && !known.has(s.category))
      r.fail(`catalog.songs[${i}].category`, `unknown category "${s.category}"`);
  });
  return r.errors.length ? { ok: false, errors: r.errors } : { ok: true, value: { categories, songs } };
}

/**
 * Reads the `stems.json` a stem renderer writes next to the `.ogg` files: `{ duracao, stems: [{ canal, programa, nome }] }`
 * with 1-based `canal`. Returns the duration and the channels converted to this package's 0-based convention.
 */
export function parseStemsManifest(input: unknown): ParseResult<{ duration: number; channels: Channel[] }> {
  const r = new Reader();
  const o = r.object(input, 'stems.json');
  if (!o) return { ok: false, errors: r.errors };
  const duration = r.number(o, 'duracao', 'stems.json', (n) => n > 0, 'a positive number of seconds');
  const list = r.list(o, 'stems', 'stems.json', (v, p): Channel | undefined => {
    const s = r.object(v, p);
    if (!s) return;
    const canal = r.number(s, 'canal', p, isInt(1, 16), 'a 1-based MIDI channel 1..16');
    const program =
      s.programa === null || s.programa === undefined
        ? null
        : r.number(s, 'programa', p, isInt(0, 127), 'an integer 0..127 or null');
    return { channel: canal - 1, program, name: r.string(s, 'nome', p) };
  });
  return r.errors.length ? { ok: false, errors: r.errors } : { ok: true, value: { duration, channels: list } };
}
