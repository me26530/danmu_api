import test from 'node:test';
import assert from 'node:assert/strict';
import Kan360Source from './sources/kan360.js';

function makeDetail(site, start, end) {
  return {
    data: {
      allepidetail: {
        [site]: Array.from({ length: end - start + 1 }, (_, index) => {
          const episodeNo = start + index;
          return {
            playlink_num: String(episodeNo),
            url: `https://example.test/${site}/${episodeNo}`
          };
        })
      }
    }
  };
}

test('Kan360Source.getEpisodesV1 batches /v1/detail requests in chunks of 200 episodes', async () => {
  const source = new Kan360Source();
  const calls = [];
  source.get360Detail = async (cat, id, site, start, end) => {
    calls.push({ cat, id, site, start, end });
    return makeDetail(site, start, end);
  };

  const episodes = await source.getEpisodesV1(4, 'entity-1', 'qq', 450);

  assert.deepEqual(calls.map(({ start, end }) => [start, end]), [
    [1, 200],
    [201, 400],
    [401, 450]
  ]);
  assert.equal(episodes.length, 450);
  assert.deepEqual(episodes[0], { name: '1', url: 'https://example.test/qq/1' });
  assert.deepEqual(episodes.at(-1), { name: '450', url: 'https://example.test/qq/450' });
});

test('Kan360Source.getEpisodesV1 returns already fetched episodes when a later batch is empty', async () => {
  const source = new Kan360Source();
  source.get360Detail = async (_cat, _id, site, start, end) => {
    if (start > 200) return { data: { allepidetail: {} } };
    return makeDetail(site, start, end);
  };

  const episodes = await source.getEpisodesV1(2, 'entity-2', 'qiyi', 250);

  assert.equal(episodes.length, 200);
  assert.equal(episodes.at(-1).name, '200');
});
