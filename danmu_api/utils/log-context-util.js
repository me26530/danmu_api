const SOURCE_KEY_TO_LOG_NAME = {
  '360': '360kan',
  imgo: 'mango',
  bilibili1: 'bilibili',
  qq: 'tencent',
  qiyi: 'iqiyi',
};

let asyncLocalStorage = null;
let asyncLocalStoragePromise = null;
const fallbackContextStack = [];

async function resolveAsyncLocalStorage() {
  if (asyncLocalStorage) return asyncLocalStorage;
  if (asyncLocalStoragePromise) return asyncLocalStoragePromise;

  asyncLocalStoragePromise = import('node:async_hooks')
    .then(({ AsyncLocalStorage }) => {
      asyncLocalStorage = new AsyncLocalStorage();
      return asyncLocalStorage;
    })
    .catch(() => null);

  return asyncLocalStoragePromise;
}

export function toLogSourceName(sourceKey) {
  if (sourceKey === undefined || sourceKey === null || sourceKey === '') return 'system';
  const key = String(sourceKey);
  return SOURCE_KEY_TO_LOG_NAME[key] || key;
}

export async function runWithSourceLogContext(sourceKey, callback) {
  const sourceName = toLogSourceName(sourceKey);
  const storage = await resolveAsyncLocalStorage();
  if (storage && typeof storage.run === 'function') {
    return storage.run(sourceName, callback);
  }

  fallbackContextStack.push(sourceName);
  try {
    return await callback();
  } finally {
    fallbackContextStack.pop();
  }
}

export function getCurrentLogSourceName() {
  if (asyncLocalStorage && typeof asyncLocalStorage.getStore === 'function') {
    const store = asyncLocalStorage.getStore();
    if (store) return store;
  }
  return fallbackContextStack[fallbackContextStack.length - 1] || null;
}

export const sourceLogContext = {
  getStore: getCurrentLogSourceName,
  run(sourceKey, callback) {
    return runWithSourceLogContext(sourceKey, callback);
  }
};
