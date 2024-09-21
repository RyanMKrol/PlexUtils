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

/**
 * Fetch the library details for my Plex library
 * @returns {Array<object>} An array of plex library items
 */
async function fetchPlexTelevisionLibrarySeasonInformation() {
  const data = await fetchRawPlexTelevisionLibraryData();

  const libData = data.MediaContainer.Directory.map((item) => ({
    title: item['@_title'],
    year: item['@_year'],
    episode_count: item['@_leafCount'],
    season_count: item['@_childCount'],
  }));

  return libData;
}

/**
 * Fetch the ID for a TV show
 * @param {string} title Title of TV show to fetch an ID for
 * @param {string} startYear The year that the show started airing
 * @returns {string} ID of given TV show
 */
async function fetchTvItemId(title, startYear) {
  const response = await getFromRemoteHost(`https://api.themoviedb.org/3/search/tv?query=${title}&first_air_date_year=${startYear}`, process.env.TMDB_API_TOKEN);
  const data = await response.json();

  if (data.total_results === 0) {
    return null;
  }

  return data.results[0].id;
}

/**
 * Fetches details of a TV show
 * @param {string} id The ID of the TV show to fetch details for
 * @returns {object} Data around a TV show
 */
async function fetchTvItemDetails(id) {
  const response = await getFromRemoteHost(`https://api.themoviedb.org/3/tv/${id}`, process.env.TMDB_API_TOKEN);
  const data = await response.json();

  if (typeof data.id === 'undefined') {
    return null;
  }

  return {
    episodes: data.number_of_episodes,
    seasons: data.number_of_seasons,
    status: data.status,
  };
}

/**
 * Fetches the video metadata for every episode in every season provided
 * @param {Array<string>} seasonMetadataPaths Array of season metadata paths
 * @returns {Array<object>} Array of episode video metadata
 */
async function fetchEpisodesVideoMetadata(seasonMetadataPaths) {
  // paths to get information about each show's season's episodes
  const episodesMetadataPaths = await fetchSeasonsEpisodesMetadataPaths(seasonMetadataPaths);

  // metadata for each episode
  return fetchAndParseEpisodeVideoMetadata(episodesMetadataPaths);
}

/**
 * For each show, fetches the path to fetch further metadata about each season within the show
 * @param {Array<string>} showsMetadataPaths Array of paths to get information about each season
 * @returns {Array<string>} Paths to get metadata for each season
 */
async function fetchSeasonsEpisodesMetadataPaths(showsMetadataPaths) {
  return Promise.all(showsMetadataPaths.map((path) => fetchRawPlexTelevisionMetadata(path)
    .then(async (data) => {
      const title = data.MediaContainer['@_title2'];
      const showSeasonsMetadata = Array.isArray(data.MediaContainer.Directory)
        ? data.MediaContainer.Directory
        : [data.MediaContainer.Directory];

      // when there are a lot of seasons in a show, an artificial season
      // for "all episodes" is plugged into the array, let's remove those
      const showSeasonsMetadataAllSeason = showSeasonsMetadata.filter((metadata) => {
        const maybeSeasonTitle = metadata['@_title'];
        const isSeasonActualSeason = !!metadata['@_type'];

        if (!isSeasonActualSeason && maybeSeasonTitle.toLowerCase() !== 'all episodes') {
          console.error(`We're skipping something we haven't seen before: ${maybeSeasonTitle}, for show with name ${title}`);
        }

        return isSeasonActualSeason;
      });

      return showSeasonsMetadataAllSeason.map((x) => x['@_key']);
    }))).then((data) => data.flat());
}

/**
 * Fetches an array of metadata for every episode's videos for all of the seasons'
 * metadata paths provided
 * @param {Array<string>} seasonsEpisodeMetadataPaths The paths of every season's metadata link
 * to get information about the episodes within a season
 * @returns {Array<object>} An array of every episode's video metadata
 */
async function fetchAndParseEpisodeVideoMetadata(seasonsEpisodeMetadataPaths) {
  return Promise.all(seasonsEpisodeMetadataPaths.map(
    (path) => fetchRawPlexTelevisionMetadata(path).then(async (data) => data.MediaContainer.Video),
  ))
    .then((data) => data.flat());
}

export {
  fetchRawPlexMovieLibraryData,
  fetchRawPlexTelevisionLibraryData,
  fetchPlexTelevisionLibrarySeasonInformation,
  fetchTvItemId,
  fetchTvItemDetails,
  fetchEpisodesVideoMetadata,
};
