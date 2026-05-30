import { fetchLocalXmlData, probePlexIdentity, scanForPlexHost } from '../utils/remote.js';

// Cached resolved base URL (e.g. https://192.168.1.12:32400) so host discovery
// runs at most once per process.
let resolvedHost = null;

/**
 * Resolve the Plex server's base URL.
 *
 * 1. Try PLEX_HOST from .env and confirm it's actually a live Plex server.
 * 2. If that fails (e.g. the IP changed via DHCP), scan the local subnet for a
 *    host answering on :32400. If PLEX_MACHINE_ID is set, only a server with
 *    that machine identifier is accepted, so we never latch onto the wrong Plex.
 *
 * The resolved URL is cached for the lifetime of the process.
 * @returns {Promise<string>} Base URL including scheme, host and port
 */
async function resolvePlexHost() {
  if (resolvedHost) return resolvedHost;

  const token = process.env.PLEX_API_TOKEN;
  const expectedMachineId = process.env.PLEX_MACHINE_ID || null;

  if (!token) {
    throw new Error('PLEX_API_TOKEN is not set. Add it to your .env');
  }

  // 1. Prefer the configured host when it's reachable.
  const envHost = process.env.PLEX_HOST;
  if (envHost && (await probePlexIdentity(envHost, token, expectedMachineId))) {
    resolvedHost = envHost;
    return resolvedHost;
  }

  // 2. Fall back to scanning the LAN.
  if (envHost) {
    console.warn(`⚠️  PLEX_HOST (${envHost}) is unreachable — scanning the local network for Plex...`);
  } else {
    console.warn('⚠️  PLEX_HOST is not set — scanning the local network for Plex...');
  }

  const discovered = await scanForPlexHost(token, expectedMachineId);
  if (!discovered) {
    throw new Error(
      'Could not find a Plex server on the local network. Check the server is on, '
      + 'or set PLEX_HOST in .env manually.',
    );
  }

  console.warn(`✅ Found Plex at ${discovered}. Update PLEX_HOST in .env to skip the scan next time.`);
  resolvedHost = discovered;
  return resolvedHost;
}

/**
 * Build a fully-qualified Plex URL with the auth token applied.
 * @param {string} path Path beginning with "/" (or a Plex key)
 * @returns {Promise<string>} Full URL including the X-Plex-Token query param
 */
async function plexUrl(path) {
  const host = await resolvePlexHost();
  const token = process.env.PLEX_API_TOKEN;
  const separator = path.includes('?') ? '&' : '?';
  return `${host}${path}${separator}X-Plex-Token=${token}`;
}

async function fetchPlexInfo() {
  return fetchLocalXmlData(await plexUrl('/'));
}

async function fetchLibrarySections() {
  return fetchLocalXmlData(await plexUrl('/library/sections'));
}

async function fetchTVLibrary() {
  // Use section 5 which contains all TV series
  return fetchLocalXmlData(await plexUrl('/library/sections/5/all'));
}

async function fetchShowSeasons(showKey) {
  return fetchLocalXmlData(await plexUrl(showKey));
}

async function fetchSeasonEpisodes(seasonKey) {
  return fetchLocalXmlData(await plexUrl(seasonKey));
}

// Flat read of every episode in the TV section in a single request.
// type=4 asks Plex for episode-level items (each one carries its show via
// grandparentTitle/grandparentRatingKey and its season via parentTitle/
// parentIndex), with Media/Part nested inline. This replaces the per-show,
// per-season crawl that fetchShowSeasons + fetchSeasonEpisodes performed.
async function fetchTVEpisodes() {
  return fetchLocalXmlData(await plexUrl('/library/sections/5/all?type=4'));
}

async function fetchMovieLibrary() {
  // Use section 4 which contains all movies
  return fetchLocalXmlData(await plexUrl('/library/sections/4/all'));
}

async function fetchMovieDetails(movieKey) {
  return fetchLocalXmlData(await plexUrl(movieKey));
}

export {
  resolvePlexHost,
  fetchPlexInfo,
  fetchLibrarySections,
  fetchTVLibrary,
  fetchShowSeasons,
  fetchSeasonEpisodes,
  fetchTVEpisodes,
  fetchMovieLibrary,
  fetchMovieDetails,
};
