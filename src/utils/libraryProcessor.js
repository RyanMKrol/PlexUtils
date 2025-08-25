import { fetchTVLibrary, fetchShowSeasons, fetchSeasonEpisodes, fetchMovieLibrary, fetchMovieDetails } from '../remote/index.js';

/**
 * Build a complete TV library map with detailed information
 * @param {number} limit - Optional limit for number of shows to process (for testing)
 * @returns {Promise<Array>} Array of TV shows with detailed episode information
 */
async function buildTVLibraryMap(limit = null) {
  // Step 1: Fetch all TV shows
  const tvLibrary = await fetchTVLibrary();
  const allShows = tvLibrary.MediaContainer.Directory || [];
  const shows = limit ? allShows.slice(0, limit) : allShows;
  
  // Step 2: Fetch all seasons for all shows in parallel
  const showSeasonPromises = shows.map(async (show) => {
    try {
      const seasonsData = await fetchShowSeasons(show['@_key']);
      const seasonsRaw = seasonsData.MediaContainer.Directory || [];
      const allSeasons = Array.isArray(seasonsRaw) ? seasonsRaw : [seasonsRaw];
      
      // Filter out "All episodes" virtual season as it aggregates episodes from all seasons
      const seasons = allSeasons.filter(season => season['@_title'] !== 'All episodes');
      
      return {
        show,
        seasons,
        error: null
      };
    } catch (error) {
      return {
        show,
        seasons: [],
        error: error.message
      };
    }
  });
  
  const showsWithSeasons = await Promise.all(showSeasonPromises);
  
  // Step 3: Flatten all season keys and fetch episodes in parallel
  const allSeasonPromises = [];
  const seasonToShowMap = new Map();
  
  showsWithSeasons.forEach(({ show, seasons }, showIndex) => {
    seasons.forEach((season, seasonIndex) => {
      const seasonKey = season['@_key'];
      const seasonId = `${showIndex}-${seasonIndex}`;
      
      seasonToShowMap.set(seasonId, {
        showIndex,
        seasonIndex,
        showTitle: show['@_title'],
        seasonTitle: season['@_title']
      });
      
      const promise = fetchSeasonEpisodes(seasonKey)
        .then(episodesData => {
          const episodesRaw = episodesData.MediaContainer.Video || [];
          const episodes = Array.isArray(episodesRaw) ? episodesRaw : (episodesRaw ? [episodesRaw] : []);
          
          // Extract detailed episode information
          const detailedEpisodes = episodes.map(episode => {
            // Extract file/media information
            const media = episode.Media?.[0] || episode.Media || {};
            const part = media.Part?.[0] || media.Part || {};
            
            return {
              title: episode['@_title'] || 'Unknown Title',
              index: episode['@_index'] || 'Unknown',
              originallyAvailableAt: episode['@_originallyAvailableAt'] || 'Unknown',
              duration: episode['@_duration'] ? Math.round(episode['@_duration'] / 60000) : 'Unknown', // Convert to minutes
              // File information
              resolution: media['@_videoResolution'] || 'Unknown',
              bitrate: media['@_bitrate'] ? `${media['@_bitrate']} bps` : 'Unknown', // Use full bitrate in bps for precision
              fileSize: part['@_size'] ? `${(part['@_size'] / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
              container: part['@_container'] || 'Unknown',
              videoCodec: media['@_videoCodec'] || 'Unknown',
              audioCodec: media['@_audioCodec'] || 'Unknown',
              audioChannels: media['@_audioChannels'] || 'Unknown',
              filename: part['@_file'] || 'Unknown'
            };
          });
          
          return {
            seasonId,
            episodes: detailedEpisodes,
            error: null
          };
        })
        .catch(error => ({
          seasonId,
          episodes: [],
          error: error.message
        }));
      
      allSeasonPromises.push(promise);
    });
  });
  
  const allEpisodeData = await Promise.all(allSeasonPromises);
  
  // Step 4: Build the final data map
  // Create episode data map
  const episodeMap = new Map();
  allEpisodeData.forEach(({ seasonId, episodes, error }) => {
    episodeMap.set(seasonId, { episodes, count: episodes.length, error });
  });
  
  // Build final show data
  const tvLibraryMap = showsWithSeasons.map(({ show, seasons, error }, showIndex) => {
    const showTitle = show['@_title'];
    const showYear = show['@_year'] || 'Unknown';
    
    // Basic show information only
    const showDetails = {
      title: showTitle,
      year: showYear
    };
    
    if (error) {
      return {
        ...showDetails,
        seasons: [],
        totalEpisodes: 0,
        error
      };
    }
    
    let totalEpisodes = 0;
    const seasonData = seasons.map((season, seasonIndex) => {
      const seasonId = `${showIndex}-${seasonIndex}`;
      const episodeData = episodeMap.get(seasonId);
      const episodeCount = episodeData?.count || 0;
      const episodeError = episodeData?.error;
      const detailedEpisodes = episodeData?.episodes || [];
      
      totalEpisodes += episodeCount;
      
      return {
        title: season['@_title'],
        episodeCount,
        episodes: detailedEpisodes,
        error: episodeError
      };
    });
    
    return {
      ...showDetails,
      seasons: seasonData,
      totalEpisodes,
      error: null
    };
  });
  
  return {
    totalFound: allShows.length,
    processed: shows.length,
    data: tvLibraryMap
  };
}

/**
 * Build a complete movie library map with detailed information
 * @param {number} limit - Optional limit for number of movies to process (for testing)
 * @returns {Promise<Array>} Array of movies with detailed file information
 */
async function buildMovieLibraryMap(limit = null) {
  // Step 1: Fetch all movies
  const movieLibrary = await fetchMovieLibrary();
  const allMovies = movieLibrary.MediaContainer.Video || [];
  const movies = limit ? allMovies.slice(0, limit) : allMovies;
  
  // Step 2: Fetch detailed information for all movies in parallel
  const movieDetailPromises = movies.map(async (movie) => {
    try {
      const movieDetails = await fetchMovieDetails(movie['@_key']);
      const detailedMovie = movieDetails.MediaContainer.Video[0] || movieDetails.MediaContainer.Video;
      
      // Extract file/media information
      const media = detailedMovie.Media?.[0] || detailedMovie.Media || {};
      const part = media.Part?.[0] || media.Part || {};
      
      return {
        // Basic movie information
        title: movie['@_title'] || 'Unknown Title',
        year: movie['@_year'] || 'Unknown',
        originallyAvailableAt: movie['@_originallyAvailableAt'] || 'Unknown',
        duration: movie['@_duration'] ? Math.round(movie['@_duration'] / 60000) : 'Unknown', // Convert to minutes
        
        // File information
        resolution: media['@_videoResolution'] || 'Unknown',
        bitrate: media['@_bitrate'] ? `${media['@_bitrate']} bps` : 'Unknown', // Use full bitrate in bps for precision
        fileSize: part['@_size'] ? `${(part['@_size'] / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
        container: part['@_container'] || 'Unknown',
        videoCodec: media['@_videoCodec'] || 'Unknown',
        audioCodec: media['@_audioCodec'] || 'Unknown',
        audioChannels: media['@_audioChannels'] || 'Unknown',
        filename: part['@_file'] || 'Unknown',
        
        error: null
      };
    } catch (error) {
      return {
        title: movie['@_title'] || 'Unknown Title',
        year: movie['@_year'] || 'Unknown',
        originallyAvailableAt: 'Unknown',
        duration: 'Unknown',
        resolution: 'Unknown',
        bitrate: 'Unknown',
        fileSize: 'Unknown',
        container: 'Unknown',
        videoCodec: 'Unknown',
        audioCodec: 'Unknown',
        audioChannels: 'Unknown',
        filename: 'Unknown',
        error: error.message
      };
    }
  });
  
  const movieLibraryMap = await Promise.all(movieDetailPromises);
  
  return {
    totalFound: allMovies.length,
    processed: movies.length,
    data: movieLibraryMap
  };
}

export { buildTVLibraryMap, buildMovieLibraryMap };