import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { logviewJsContent } from './ui/js/logview.js';

function loadLogviewHelpers(extraSandbox = {}) {
  const sandbox = {
    console,
    Date,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    logs: [],
    ...extraSandbox
  };
  const code = `${logviewJsContent}\n({\n  getLogCategory,\n  getLogCategoriesFromLogs,\n  setLogCategoryFilter,\n  getFilteredLogs,\n  parseLogLine,\n  updateLogCategoryFilters,\n  escapeLogAttr,\n  setLogs(value) { logs = value; },\n  getCurrentLogCategoryFilter() { return currentLogCategoryFilter; }\n});`;
  return vm.runInNewContext(code, sandbox);
}

test('getLogCategory groups system, utils, merge and source tags without treating timestamps or 360kan as time', () => {
  const helpers = loadLogviewHelpers();

  assert.equal(helpers.getLogCategory('[system] [Match] 开始匹配'), 'system');
  assert.equal(helpers.getLogCategory('[Utils] [HTTP] HTTP GET'), 'utils');
  assert.equal(helpers.getLogCategory('[Cache] 命中'), 'cache');
  assert.equal(helpers.getLogCategory('[Merge-Check] 合并检查'), 'merge');
  assert.equal(helpers.getLogCategory('[360kan] 搜索结果'), '360kan');
  assert.equal(helpers.getLogCategory('[2026-06-06T12:00:00+08:00] [iqiyi] JSON 续行'), 'iqiyi');
  assert.equal(helpers.getLogCategory('[12:00:00] [mango] JSON 续行'), 'mango');
  assert.equal(helpers.getLogCategory('没有标签的续行'), '_inherit_');
});

test('log category filter composes with existing level filter and keyword search', () => {
  const helpers = loadLogviewHelpers();
  helpers.setLogs([
    { timestamp: '12:00:00', type: 'info', message: '[360kan] 搜索 目标剧' },
    { timestamp: '12:00:01', type: 'warn', message: '续行 目标剧' },
    { timestamp: '12:00:02', type: 'info', message: '[iqiyi] 搜索 目标剧' },
    { timestamp: '12:00:03', type: 'error', message: '[system] 错误 目标剧' }
  ]);

  helpers.setLogCategoryFilter('360kan');
  const filtered = helpers.getFilteredLogs();
  assert.deepEqual(filtered.map(log => log.message), [
    '[360kan] 搜索 目标剧',
    '续行 目标剧'
  ]);
});

test('log category filter renderer avoids inline onclick and escapes attributes', () => {
  const listeners = [];
  const container = {
    dataset: {},
    innerHTML: '',
    contains: () => true,
    addEventListener: (eventName, handler) => listeners.push({ eventName, handler })
  };
  const documentStub = {
    getElementById: id => id === 'log-category-filters' ? container : null,
    querySelectorAll: () => []
  };
  const helpers = loadLogviewHelpers({ document: documentStub });

  helpers.setLogs([
    { timestamp: '12:00:00', type: 'info', message: '[bad" onclick="alert(1)] 测试' },
    { timestamp: '12:00:01', type: 'info', message: '[360kan] 正常' }
  ]);
  helpers.updateLogCategoryFilters();

  assert.doesNotMatch(container.innerHTML, /<button[^>]*\sonclick="/);
  assert.match(container.innerHTML, /bad&quot; onclick=&quot;alert\(1\)/);
  assert.equal(listeners.length, 1);
});

test('log category filter resets to all when selected category disappears after refresh', () => {
  const container = {
    dataset: {},
    innerHTML: '',
    contains: () => true,
    addEventListener: () => {}
  };
  const documentStub = {
    getElementById: id => id === 'log-category-filters' ? container : null,
    querySelectorAll: () => []
  };
  const helpers = loadLogviewHelpers({ document: documentStub });

  helpers.setLogs([{ timestamp: '12:00:00', type: 'info', message: '[360kan] 搜索' }]);
  helpers.setLogCategoryFilter('360kan');
  assert.equal(helpers.getCurrentLogCategoryFilter(), '360kan');

  helpers.setLogs([{ timestamp: '12:00:01', type: 'info', message: '[system] 刷新后无 360' }]);
  helpers.updateLogCategoryFilters();
  assert.equal(helpers.getCurrentLogCategoryFilter(), 'all');
});
