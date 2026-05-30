import chalk from 'chalk';
import { RateLimiter, retryWithBackoff } from '../utils/apiUtils.js';
import { cleanShowTitle } from '../utils/stringUtils.js';

// TMDB (themoviedb.org) is the only third-party API this project calls, so we
// throttle ourselves to be a good citizen. A single module-level rate limiter
// is shared by every caller within a process, with exponential backoff on 429s.
//
// Note: the token env var is historically named TVDB_API_TOKEN, but the calls
// go to TMDB. TMDB_API_TOKEN is preferred; TVDB_API_TOKEN is accepted as a
// fallback for backwards compatibility.
const TMDB_BASE = 'https://api.themoviedb.org/3';
const rateLimiter = new RateLimiter(30); // 30 requests per second

function getApiKey() {
  const apiKey = process.env.TMDB_API_TOKEN || process.env.TVDB_API_TOKEN;
  if (!apiKey) {
    throw new Error('TMDB_API_TOKEN (or TVDB_API_TOKEN) environment variable is required');
  }
  return apiKey;
}

async function tmdbFetch(url) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      accept: 'application/json',
    },
  });
}

/**
 * Search for a TV show on TMDB.
 * @param {string} showName Name of the TV show to search for
 * @param {string|number|null} year First-air year (optional, improves accuracy)
 * @returns {Promise<Object|null>} Best-match TMDB show, or null
 */
async function searchTVShow(showName, year = null) {
  return rateLimiter.execute(async () => {
    const yearInfo = year && year !== 'Unknown' ? ` (${year})` : '';
    const context = `"${showName}"${yearInfo}`;

    return retryWithBackoff(async () => {
      const cleanedShowName = cleanShowTitle(showName);

      if (cleanedShowName !== showName) {
        console.log(chalk.gray(`   🧹 Cleaned title: "${showName}" -> "${cleanedShowName}"`));
      }

      const encodedShowName = encodeURIComponent(cleanedShowName);
      let searchUrl = `${TMDB_BASE}/search/tv?query=${encodedShowName}&language=en-US`;

      if (year && year !== 'Unknown') {
        searchUrl += `&first_air_date_year=${year}`;
      }

      console.log(chalk.gray(`   🔗 API Request: ${searchUrl}`));

      const response = await tmdbFetch(searchUrl);

      if (!response.ok) {
        if (response.status === 429) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        console.error(chalk.yellow(`⚠️  TMDB API error for "${showName}": ${response.status} ${response.statusText}`));
        return null;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.log(chalk.gray(`   🔍 No TMDB match found for: ${showName}${yearInfo}`));
        return null;
      }

      return data.results[0];
    }, 5, context).catch((error) => {
      console.error(chalk.red(`❌ Error searching for "${showName}" after retries:`, error.message));
      return null;
    });
  });
}

/**
 * Get detailed TV show information (including seasons) from TMDB.
 * @param {number} tmdbId TMDB ID of the show
 * @returns {Promise<Object|null>} Detailed show info, or null
 */
async function getTVShowDetails(tmdbId) {
  return rateLimiter.execute(async () => {
    const context = `TMDB ID ${tmdbId}`;

    return retryWithBackoff(async () => {
      const detailsUrl = `${TMDB_BASE}/tv/${tmdbId}?language=en-US`;

      console.log(chalk.gray(`   🔗 API Request: ${detailsUrl}`));

      const response = await tmdbFetch(detailsUrl);

      if (!response.ok) {
        if (response.status === 429) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        console.error(chalk.yellow(`⚠️  TMDB details API error for ID ${tmdbId}: ${response.status}`));
        return null;
      }

      return response.json();
    }, 5, context).catch((error) => {
      console.error(chalk.red(`❌ Error getting details for TMDB ID ${tmdbId} after retries:`, error.message));
      return null;
    });
  });
}

export { searchTVShow, getTVShowDetails };
