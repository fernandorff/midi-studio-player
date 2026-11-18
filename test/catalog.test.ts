import { describe, expect, it } from 'vitest';
import { parseCatalog, parseStemsManifest } from '../src/catalog/parse-catalog';

const valid = () => ({
  categories: [
    { id: 'battle', label: 'Battle', order: 1 },
    { id: 'town', label: 'Town', order: 2 },
  ],
  songs: [
    {
      id: 'battle-c',
      title: 'March of Ashes',
      category: 'battle',
      authorship: 'Composer name',
      story: 'Draft.',
      storyDraft: true,
      versions: [
        {
          id: 'sc88p',
          label: 'SC-88Pro',
          stemsBase: '/stems/batalha_C_sc88p',
          midi: '/midi/batalha_C.mid',
          duration: 94.5,
        },
        {
          id: 'tfg',
          label: 'Tactical Fantasy Guy',
          stemsBase: 'https://cdn.example.com/stems/batalha_C_tfg',
          midi: '/midi/batalha_C_tfg.mid',
          duration: 94.5,
          channels: [{ channel: 7, program: 22, name: 'Snare' }],
        },
      ],
      channels: [
        { channel: 0, program: 42, name: 'Cello' },
        { channel: 9, program: null, name: 'Drums' },
      ],
      references: [{ label: 'Trisection', url: 'https://www.youtube.com/watch?v=q7W5zevSY-A', study: true }],
      measurements: [{ label: 'Length', value: '94.5 s', source: 'stems.json' }],
      checks: [{ text: 'Someone listened', state: 'pending' }],
      tags: { mood: ['tense'] },
    },
  ],
});

describe('parseCatalog', () => {
  it('accepts a valid catalog and keeps every field', () => {
    const r = parseCatalog(valid());
    expect(r).toEqual({ ok: true, value: valid() });
  });

  it('defaults the optional lists to empty', () => {
    const c = valid() as Record<string, unknown> & ReturnType<typeof valid>;
    const s = c.songs[0] as Record<string, unknown>;
    delete s.references;
    delete s.measurements;
    delete s.checks;
    const r = parseCatalog(c);
    expect(r.ok && r.value.songs[0]!.references).toEqual([]);
  });

  it('reports every bad field with its path', () => {
    const c = valid();
    const s = c.songs[0]!;
    (s.versions[0] as Record<string, unknown>).duration = '94';
    s.channels[1]!.channel = 16;
    s.category = 'menu';
    s.references[0]!.url = 'javascript:alert(1)';
    (s.checks[0] as Record<string, unknown>).state = 'feito';
    const r = parseCatalog(c);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual([
      'catalog.songs[0].versions[0].duration: expected a positive number of seconds',
      'catalog.songs[0].channels[1].channel: expected a 0-based MIDI channel 0..15',
      'catalog.songs[0].references[0].url: expected an http(s) URL or a path',
      'catalog.songs[0].checks[0].state: expected "done" or "pending"',
      'catalog.songs[0].category: unknown category "menu"',
    ]);
  });

  it('rejects duplicate ids, duplicate channels and songs without versions', () => {
    const c = valid();
    c.songs.push({ ...c.songs[0]!, versions: [] });
    c.songs[0]!.channels.push({ channel: 0, program: 1, name: 'Again' });
    const r = parseCatalog(c);
    expect(!r.ok && r.errors).toEqual([
      'catalog.songs[0].channels[2].channel: duplicate channel 0',
      'catalog.songs[1].versions: expected at least one version',
      'catalog.songs[1].channels[2].channel: duplicate channel 0',
      'catalog.songs[1].id: duplicate id "battle-c"',
    ]);
  });

  it('rejects a draft or study mark that is not a boolean', () => {
    const c = valid();
    (c.songs[0] as Record<string, unknown>).storyDraft = 'yes';
    (c.songs[0]!.references[0] as Record<string, unknown>).study = 1;
    const r = parseCatalog(c);
    expect(!r.ok && r.errors).toEqual([
      'catalog.songs[0].references[0].study: expected true or false',
      'catalog.songs[0].storyDraft: expected true or false',
    ]);
  });

  it('rejects what is not an object', () => {
    expect(parseCatalog(null)).toEqual({ ok: false, errors: ['catalog: expected an object'] });
    expect(parseCatalog({ categories: 1, songs: [] })).toEqual({
      ok: false,
      errors: ['catalog.categories: expected an array'],
    });
  });
});

describe('parseStemsManifest', () => {
  it('converts the 1-based "canal" of stems.json to the 0-based channel used for file names', () => {
    // excerpt of stems/batalha_A_tfg/stems.json and the drum line of stems/batalha_A/stems.json
    const r = parseStemsManifest({
      duracao: 101.818186,
      stems: [
        { canal: 1, programa: 6, nome: 'String Ensemble 1' },
        { canal: 9, programa: 22, nome: 'Snare' },
        { canal: 10, programa: null, nome: 'Drums' },
      ],
    });
    expect(r).toEqual({
      ok: true,
      value: {
        duration: 101.818186,
        channels: [
          { channel: 0, program: 6, name: 'String Ensemble 1' },
          { channel: 8, program: 22, name: 'Snare' },
          { channel: 9, program: null, name: 'Drums' },
        ],
      },
    });
  });

  it('rejects channel 0, which does not exist in 1-based numbering', () => {
    const r = parseStemsManifest({ duracao: 1, stems: [{ canal: 0, programa: 1, nome: 'x' }] });
    expect(!r.ok && r.errors).toEqual(['stems.json.stems[0].canal: expected a 1-based MIDI channel 1..16']);
  });
});
