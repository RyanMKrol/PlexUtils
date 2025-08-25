import { fetchLocalXmlData, getFromRemoteHost } from '../utils/remote';

import Show from '../model/Show';
import Season from '../model/Season';
import Episode from '../model/Episode';
import Movie from '../model/Movie';

import { getCachedData, getCacheLocWithFilename } from '../utils/StoredCache';

import 'dotenv/config';

/**
 * Fetch the raw library data for my "Movies" library
 * @param tmdbId
 * @param metadataKey
 * @param show
 * @returns {Array<object>} An array of plex library items
 */
async function fetchTmdbSeasonData(show) {
  const showMetadata = await getCachedData(
    getCacheLocWithFilename(`show_metadata__${show.title}`),
    async () => fetchLocalXmlData(`https://192.168.1.130:32400${show.metadataKey}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`),
  );

  if (!showMetadata.MediaContainer.Directory.Guid) {
    throw new Error('no good response');
  }

  const data = showMetadata.MediaContainer.Directory.Guid;
  const tmdbIdObjects = data.filter(((x) => x['@_id'].includes('tmdb')));
  if (!tmdbIdObjects) {
    throw new Error('no good tmdb id');
  }

  const tmdbId = tmdbIdObjects[0]['@_id'].split('tmdb://')[1];

  const tmdbData = await getCachedData(
    getCacheLocWithFilename(`tvdb_data_${tmdbId}`),
    async () => getFromRemoteHost(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`, process.env.tmdb_API_TOKEN).then((res) => res.json()),
  );

  return tmdbData;
}

/**
 * Fetch the raw library data for my "Movies" library
 * @returns {Array<object>} An array of plex library items
 */
async function fetchRawPlexMovieLibraryData() {
  const rawFilmLibraryData = await getCachedData(
    getCacheLocWithFilename('films'),
    async () => fetchLocalXmlData(`https://192.168.1.130:32400/library/sections/4/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`),
  );

  return Promise.all(
    rawFilmLibraryData.MediaContainer.Video
      .map(async (item) => new Movie(item)),
  );
}

/**
 * Fetch the raw library data for my "TV" library
 * @returns {Array<object>} An array of plex library items
 */
async function fetchRawPlexTelevisionLibraryData() {
  const rawTelevisionLibraryData = await getCachedData(
    getCacheLocWithFilename('shows'),
    async () => fetchLocalXmlData(`https://192.168.1.130:32400/library/sections/5/all?X-Plex-Token=${process.env.PLEX_API_TOKEN}`),
  );

  return Promise.all(
    rawTelevisionLibraryData.MediaContainer.Directory
      .map(async (item) => {
        const show = new Show(item);

        const seasonsData = await getCachedData(
          getCacheLocWithFilename(show.title),
          async () => fetchUnspecifiedPlexData(show.childrenUri),
        );

        const dir = Array.isArray(seasonsData.MediaContainer.Directory)
          ? seasonsData.MediaContainer.Directory
          : [seasonsData.MediaContainer.Directory];

        const seasons = await Promise.all(dir.map(async (seasonData) => {
          const season = new Season(seasonData);
          if (season.title === 'All episodes') {
            return null;
          }
          const episodesDataRaw = await getCachedData(
            getCacheLocWithFilename(`${show.title}_${season.title}`),
            async () => fetchUnspecifiedPlexData(season.childrenUri),
          );

          const episodesData = Array.isArray(episodesDataRaw.MediaContainer.Video)
            ? episodesDataRaw.MediaContainer.Video
            : [episodesDataRaw.MediaContainer.Video];
          const episodes = episodesData.map((episodeData) => new Episode(episodeData));

          season.episodes = episodes;
          return season;
        }));

        show.seasons = seasons.filter((x) => x !== null);
        return show;
      }),
  );
}

/**
 * Fetch raw library data for a given path of a plex model
 * @param {string} path The path to the item you want more data for
 * @returns {Array<object>} An array of metadata
 */
async function fetchUnspecifiedPlexData(path) {
  return fetchLocalXmlData(`https://192.168.1.130:32400${path}?X-Plex-Token=${process.env.PLEX_API_TOKEN}`);
}

export {
  fetchTmdbSeasonData,
  fetchRawPlexMovieLibraryData,
  fetchRawPlexTelevisionLibraryData,
};
