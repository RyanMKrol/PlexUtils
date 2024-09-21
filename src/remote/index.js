import { getFromRemoteHost, fetchLocalXmlData } from '../utils/remote';

import 'dotenv/config';
/**
 * Fetch the raw library data for my "Movies" library
 * @returns {Array<object>} An array of plex library items
 */
async function fetchRawPlexMovieLibraryData() {
  return fetchLocalXmlData(`https://192.168.1.130:32400/library/sections/4/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

/**
 * Fetch the raw library data for my "TV" library
 * @returns {Array<object>} An array of plex library items
 */
async function fetchRawPlexTelevisionLibraryData() {
  return fetchLocalXmlData(`https://192.168.1.130:32400/library/sections/5/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

/**
 * Fetch raw library data for a given piece of metadata in my "TV" library
 * @param {string} path The path to the metadata we want from the TV library
 * @returns {Array<object>} An array of metadata
 */
async function fetchRawPlexTelevisionMetadata(path) {
  return fetchLocalXmlData(`https://192.168.1.130:32400${path}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

export {
  fetchRawPlexMovieLibraryData,
  fetchRawPlexTelevisionLibraryData,
  fetchRawPlexTelevisionMetadata,
};
