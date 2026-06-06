import test from 'node:test';
import assert from 'node:assert/strict';
import { globals } from './configs/globals.js';
import { log } from './utils/log-util.js';
import { runWithSourceLogContext, toLogSourceName } from './utils/log-context-util.js';

test('toLogSourceName normalizes scheduler source keys to log tags', () => {
  assert.equal(toLogSourceName('360'), '360kan');
  assert.equal(toLogSourceName('imgo'), 'mango');
  assert.equal(toLogSourceName('iqiyi'), 'iqiyi');
});

test('log prefixes untagged messages with current source context', async () => {
  globals.logLevel = 'info';
  globals.logBuffer = [];
  globals.originalEnvVars = {};
  globals.accessedEnvVars = {};

  await runWithSourceLogContext('360', async () => {
    log('info', 'HTTP GET: https://example.test');
  });

  assert.equal(globals.logBuffer.length, 1);
  assert.equal(globals.logBuffer[0].message, '[360kan] HTTP GET: https://example.test');
});

test('log prefixes generic request tags with current source context', async () => {
  globals.logLevel = 'info';
  globals.logBuffer = [];

  await runWithSourceLogContext('360', async () => {
    log('info', '[请求模拟] HTTP GET: https://example.test');
  });

  assert.equal(globals.logBuffer[0].message, '[360kan] [请求模拟] HTTP GET: https://example.test');
});

test('log does not double-prefix messages that already have a tag', async () => {
  globals.logLevel = 'info';
  globals.logBuffer = [];

  await runWithSourceLogContext('imgo', async () => {
    log('info', '[mango] 已有标签');
  });

  assert.equal(globals.logBuffer[0].message, '[mango] 已有标签');
});
