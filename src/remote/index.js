import { fetchLocalXmlData } from '../utils/remote';

import Show from '../model/Show';
import Season from '../model/Season';
import Episode from '../model/Episode';

import { getCachedData, getCacheLocWithFilename } from '../utils/StoredCache';

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

        show.seasons = seasons;
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
  fetchRawPlexMovieLibraryData,
  fetchRawPlexTelevisionLibraryData,
};
