import test from 'node:test';
import assert from 'node:assert/strict';
import AnimekoSource from './sources/animeko.js';
import { Globals } from './configs/globals.js';

function resetRuntime(env = {}) {
  Globals.init({ LOG_LEVEL: 'error', MAX_ANIMES: '1000', ...env });
}

test('Animeko Bangumi search uses built-in mirror first and keeps direct fallback', () => {
  resetRuntime();
  const source = new AnimekoSource();
  const urls = source._getSearchRequestUrls('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0');

  assert.deepEqual(urls, [
    'https://api.bangumi.one/v0/search/subjects?limit=20&offset=0',
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
  ]);
});

test('Animeko Bangumi search honors configured animeko@ proxy before direct fallback', () => {
  resetRuntime({ PROXY_URL: 'animeko@https://mirror.example.test/base' });
  const source = new AnimekoSource();
  const urls = source._getSearchRequestUrls('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0');

  assert.deepEqual(urls, [
    'https://mirror.example.test/base/v0/search/subjects?limit=20&offset=0',
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
  ]);
});

test('Animeko filterSearchResults matches infobox 中文名 value', () => {
  resetRuntime();
  const source = new AnimekoSource();
  const results = source.filterSearchResults([
    {
      id: 1,
      name: 'Some Japanese Title',
      name_cn: '',
      infobox: [
        { key: '中文名', value: '镜像中文名测试' },
      ],
    },
  ], '镜像中文名测试');

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 1);
});
