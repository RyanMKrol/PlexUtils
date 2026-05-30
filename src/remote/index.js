import { fetchLocalXmlData } from '../utils/remote.js';

/**
 * Build a fully-qualified Plex URL with the auth token applied.
 *
 * Reads PLEX_HOST and PLEX_API_TOKEN lazily (at call time, not module load)
 * so that dotenv has a chance to populate process.env first. PLEX_HOST lets
 * the server address be updated in .env when its IP changes (DHCP) without
 * touching code, e.g. PLEX_HOST=https://192.168.1.12:32400
 *
 * @param {string} path Path beginning with "/" (or a Plex key)
 * @returns {string} Full URL including the X-Plex-Token query param
 */
function plexUrl(path) {
  const host = process.env.PLEX_HOST;
  const token = process.env.PLEX_API_TOKEN;

  if (!host) {
    throw new Error('PLEX_HOST is not set. Add it to your .env (e.g. PLEX_HOST=https://192.168.1.12:32400)');
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${host}${path}${separator}X-Plex-Token=${token}`;
}

async function fetchPlexInfo() {
  return fetchLocalXmlData(plexUrl('/'));
}

async function fetchLibrarySections() {
  return fetchLocalXmlData(plexUrl('/library/sections'));
}

async function fetchTVLibrary() {
  // Use section 5 which contains all TV series
  return fetchLocalXmlData(plexUrl('/library/sections/5/all'));
}

async function fetchShowSeasons(showKey) {
  return fetchLocalXmlData(plexUrl(showKey));
}

async function fetchSeasonEpisodes(seasonKey) {
  return fetchLocalXmlData(plexUrl(seasonKey));
}

async function fetchMovieLibrary() {
  // Use section 4 which contains all movies
  return fetchLocalXmlData(plexUrl('/library/sections/4/all'));
}

async function fetchMovieDetails(movieKey) {
  return fetchLocalXmlData(plexUrl(movieKey));
}

export {
  fetchPlexInfo,
  fetchLibrarySections,
  fetchTVLibrary,
  fetchShowSeasons,
  fetchSeasonEpisodes,
  fetchMovieLibrary,
  fetchMovieDetails,
};
