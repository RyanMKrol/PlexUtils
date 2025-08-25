import { fetchLocalXmlData } from '../utils/remote.js';

async function fetchPlexInfo() {
  return fetchLocalXmlData(`https://192.168.1.63:32400?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchLibrarySections() {
  return fetchLocalXmlData(`https://192.168.1.63:32400/library/sections?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchTVLibrary() {
  // Use section 5 which contains all TV series
  return fetchLocalXmlData(`https://192.168.1.63:32400/library/sections/5/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchShowSeasons(showKey) {
  return fetchLocalXmlData(`https://192.168.1.63:32400${showKey}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchSeasonEpisodes(seasonKey) {
  return fetchLocalXmlData(`https://192.168.1.63:32400${seasonKey}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchMovieLibrary() {
  // Use section 4 which contains all movies
  return fetchLocalXmlData(`https://192.168.1.63:32400/library/sections/4/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

async function fetchMovieDetails(movieKey) {
  return fetchLocalXmlData(`https://192.168.1.63:32400${movieKey}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

export { 
  fetchPlexInfo, 
  fetchLibrarySections, 
  fetchTVLibrary, 
  fetchShowSeasons, 
  fetchSeasonEpisodes, 
  fetchMovieLibrary, 
  fetchMovieDetails 
};
