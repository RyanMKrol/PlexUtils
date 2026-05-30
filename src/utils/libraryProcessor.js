import { fetchTVLibrary, fetchTVEpisodes, fetchMovieLibrary } from '../remote/index.js';

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * Extract detailed episode info from an episode <Video> node.
 * @param {Object} episode Episode node from the section flat read
 * @returns {Object} Normalised episode details
 */
function extractEpisode(episode) {
  const media = episode.Media?.[0] || episode.Media || {};
  const part = media.Part?.[0] || media.Part || {};

  return {
    title: episode['@_title'] || 'Unknown Title',
    index: episode['@_index'] || 'Unknown',
    originallyAvailableAt: episode['@_originallyAvailableAt'] || 'Unknown',
    duration: episode['@_duration'] ? Math.round(episode['@_duration'] / 60000) : 'Unknown', // minutes
    resolution: media['@_videoResolution'] || 'Unknown',
    bitrate: media['@_bitrate'] ? `${media['@_bitrate']} bps` : 'Unknown',
    fileSize: part['@_size'] ? `${(part['@_size'] / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
    container: part['@_container'] || 'Unknown',
    videoCodec: media['@_videoCodec'] || 'Unknown',
    audioCodec: media['@_audioCodec'] || 'Unknown',
    audioChannels: media['@_audioChannels'] || 'Unknown',
    filename: part['@_file'] || 'Unknown',
  };
}

/**
 * Extract detailed movie info from a movie <Video> node.
 * @param {Object} movie Movie node from the section flat read
 * @returns {Object} Normalised movie details
 */
function extractMovie(movie) {
  const media = movie.Media?.[0] || movie.Media || {};
  const part = media.Part?.[0] || media.Part || {};

  return {
    title: movie['@_title'] || 'Unknown Title',
    year: movie['@_year'] || 'Unknown',
    originallyAvailableAt: movie['@_originallyAvailableAt'] || 'Unknown',
    duration: movie['@_duration'] ? Math.round(movie['@_duration'] / 60000) : 'Unknown', // minutes
    resolution: media['@_videoResolution'] || 'Unknown',
    bitrate: media['@_bitrate'] ? `${media['@_bitrate']} bps` : 'Unknown',
    fileSize: part['@_size'] ? `${(part['@_size'] / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
    container: part['@_container'] || 'Unknown',
    videoCodec: media['@_videoCodec'] || 'Unknown',
    audioCodec: media['@_audioCodec'] || 'Unknown',
    audioChannels: media['@_audioChannels'] || 'Unknown',
    filename: part['@_file'] || 'Unknown',
    error: null,
  };
}

/**
 * Build a complete TV library map with detailed episode information.
 *
 * Uses two requests total: the show list (for canonical ordering and year) and
 * a single flat read of every episode in the section (type=4). Episodes carry
 * their show via grandparentRatingKey and their season via parentRatingKey /
 * parentIndex, so the show -> season -> episode tree is reconstructed in memory
 * instead of via a per-show, per-season request crawl.
 *
 * @param {number} limit Optional cap on number of shows to process
 * @returns {Promise<Object>} { totalFound, processed, data }
 */
async function buildTVLibraryMap(limit = null) {
  const [tvLibrary, episodesData] = await Promise.all([fetchTVLibrary(), fetchTVEpisodes()]);

  const allShows = toArray(tvLibrary.MediaContainer.Directory);
  const shows = limit ? allShows.slice(0, limit) : allShows;
  const episodes = toArray(episodesData.MediaContainer.Video);

  // Bucket every episode under its show via grandparentRatingKey.
  const episodesByShow = new Map();
  for (const ep of episodes) {
    const showKey = ep['@_grandparentRatingKey'];
    if (!episodesByShow.has(showKey)) episodesByShow.set(showKey, []);
    episodesByShow.get(showKey).push(ep);
  }

  const tvLibraryMap = shows.map((show) => {
    const showTitle = show['@_title'];
    const showYear = show['@_year'] || 'Unknown';
    const showEpisodes = episodesByShow.get(show['@_ratingKey']) || [];

    // Group this show's episodes into seasons keyed by parentRatingKey.
    const seasonMap = new Map();
    for (const ep of showEpisodes) {
      const seasonKey = ep['@_parentRatingKey'];
      if (!seasonMap.has(seasonKey)) {
        seasonMap.set(seasonKey, {
          title: ep['@_parentTitle'],
          parentIndex: Number(ep['@_parentIndex']),
          episodes: [],
        });
      }
      seasonMap.get(seasonKey).episodes.push(ep);
    }

    // Order seasons by season number, episodes by episode number.
    const seasonData = [...seasonMap.values()]
      .sort((a, b) => a.parentIndex - b.parentIndex)
      .map((season) => {
        const detailedEpisodes = season.episodes
          .slice()
          .sort((a, b) => Number(a['@_index']) - Number(b['@_index']))
          .map(extractEpisode);

        return {
          title: season.title,
          episodeCount: detailedEpisodes.length,
          episodes: detailedEpisodes,
          error: null,
        };
      });

    const totalEpisodes = seasonData.reduce((sum, s) => sum + s.episodeCount, 0);

    return {
      title: showTitle,
      year: showYear,
      seasons: seasonData,
      totalEpisodes,
      error: null,
    };
  });

  return {
    totalFound: allShows.length,
    processed: shows.length,
    data: tvLibraryMap,
  };
}

/**
 * Build a complete movie library map with detailed file information.
 *
 * The movie section listing already includes Media/Part inline, so this is a
 * single request with no per-movie detail fetch.
 *
 * @param {number} limit Optional cap on number of movies to process
 * @returns {Promise<Object>} { totalFound, processed, data }
 */
async function buildMovieLibraryMap(limit = null) {
  const movieLibrary = await fetchMovieLibrary();
  const allMovies = toArray(movieLibrary.MediaContainer.Video);
  const movies = limit ? allMovies.slice(0, limit) : allMovies;

  return {
    totalFound: allMovies.length,
    processed: movies.length,
    data: movies.map(extractMovie),
  };
}

export { buildTVLibraryMap, buildMovieLibraryMap };
