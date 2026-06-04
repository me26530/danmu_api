import test from 'node:test';
import assert from 'node:assert/strict';

import { collectSearchEpisodesResults } from './apis/dandan-api.js';

test('collectSearchEpisodesResults should cap concurrent detail loads and preserve order', async () => {
  const searchAnimes = Array.from({ length: 4 }, (_, index) => {
    const n = index + 1;
    return {
      animeId: n,
      bangumiId: `bangumi-${n}`,
      animeTitle: `并发番剧${n}`,
      type: '动漫',
      typeDescription: '动漫',
      source: 'tencent',
    };
  });

  let activeLoads = 0;
  let maxActiveLoads = 0;

  const results = await collectSearchEpisodesResults(
    searchAnimes,
    new URL('https://example.test/search/episodes'),
    new Map(),
    '1',
    {
      detailConcurrency: 2,
      resolveDetailFromStore: () => null,
      loadBangumi: async (animeItem) => {
        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
        try {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            success: true,
            bangumi: {
              episodes: [
                {
                  episodeId: animeItem.animeId * 10,
                  episodeTitle: `第${animeItem.animeId}集`,
                  episodeNumber: '1',
                },
              ],
            },
          };
        } finally {
          activeLoads -= 1;
        }
      },
    },
  );

  assert.equal(maxActiveLoads <= 2, true);
  assert.deepEqual(results.map((item) => item.animeId), [1, 2, 3, 4]);
  assert.deepEqual(results.map((item) => item.episodes[0].episodeId), [10, 20, 30, 40]);
});

test('collectSearchEpisodesResults should materialize from detail store without fetching bangumi', async () => {
  const searchAnimes = [
    {
      animeId: 7,
      bangumiId: 'bangumi-7',
      animeTitle: '存量番剧',
      type: '动漫',
      typeDescription: '动漫',
      source: 'youku',
    },
  ];

  const detailAnime = {
    animeId: 7,
    bangumiId: 'bangumi-7',
    animeTitle: '存量番剧',
    type: '动漫',
    typeDescription: '动漫',
    imageUrl: '',
    startDate: '',
    episodeCount: 2,
    rating: 0,
    isFavorited: true,
    source: 'youku',
    links: [
      { id: 701, url: 'https://example.test/ep1', title: '第1集' },
      { id: 702, url: 'https://example.test/ep2', title: '第2集' },
    ],
  };

  let loadBangumiCalls = 0;
  const results = await collectSearchEpisodesResults(
    searchAnimes,
    new URL('https://example.test/search/episodes'),
    new Map(),
    '2',
    {
      resolveDetailFromStore: () => detailAnime,
      loadBangumi: async () => {
        loadBangumiCalls += 1;
        throw new Error('loadBangumi should not be called when detail store already has the anime');
      },
    },
  );

  assert.equal(loadBangumiCalls, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].animeTitle, '存量番剧');
  assert.equal(results[0].episodes[0].episodeId, 702);
  assert.equal(results[0].episodes[0].episodeTitle, '第2集');
});
