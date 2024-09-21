/* eslint-disable no-underscore-dangle */

import fs from 'fs';

/**
 * test
 * @param {string} filename The name of the file to store
 * @returns {string} Location of the tv cache
 */
export function getCacheLocWithFilename(filename) {
  return `src/resources/${filename}.json`;
}

/**
 * Checks or creates cache data
 * @param {string} location location of the file to cache
 * @param {Function} populateCacheFn how to create new data for the cache
 * @returns {any} Whatever you've populated in the cache
 */
export async function getCachedData(location, populateCacheFn) {
  if (fs.existsSync(location)) {
    const rawCacheData = fs.readFileSync(location, { encoding: 'utf8' });

    const data = JSON.parse(rawCacheData);
    const { cacheTtl, val } = data;

    if (typeof cacheTtl === 'undefined' || typeof data === 'undefined') {
      throw new Error('Cache is not in expected format');
    }

    if (new Date() < new Date(cacheTtl)) {
      return val;
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const newCacheData = await populateCacheFn();

  const jsonString = JSON.stringify({ cacheTtl: tomorrow, val: newCacheData }, null, 2);

  fs.writeFileSync(location, jsonString, { flag: 'w' });

  return newCacheData;
}
