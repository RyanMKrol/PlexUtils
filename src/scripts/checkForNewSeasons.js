#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import 'dotenv/config';

/**
 * Rate limiter class to handle API request throttling
 */
class RateLimiter {
  constructor(maxRequestsPerSecond = 30) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.requests = [];
    this.running = 0;
    this.queue = [];
  }
  
  /**
   * Execute a function with rate limiting
   * @param {Function} fn - Function to execute
   * @returns {Promise} Promise that resolves when function completes
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }
  
  processQueue() {
    if (this.queue.length === 0 || this.running >= this.maxRequestsPerSecond) {
      return;
    }
    
    const now = Date.now();
    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= this.maxRequestsPerSecond) {
      // Wait until we can make another request
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      setTimeout(() => this.processQueue(), waitTime + 1);
      return;
    }
    
    const { fn, resolve, reject } = this.queue.shift();
    this.requests.push(now);
    this.running++;
    
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        // Process next item in queue after a small delay
        setTimeout(() => this.processQueue(), 10);
      });
    
    // Try to process more items immediately
    setTimeout(() => this.processQueue(), 0);
  }
}

// Create a global rate limiter instance
const rateLimiter = new RateLimiter(30); // 30 requests per second

/**
 * Clean show title by removing year appendages like "(2007)" or "(2020)"
 * @param {string} title - Original show title
 * @returns {string} Cleaned title without year appendages
 */
function cleanShowTitle(title) {
  if (!title) return title;
  
  // Remove year patterns like (2007), (2020), etc. at the end of the title
  // This handles formats like "Benidorm (2007)" -> "Benidorm"
  return title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

/**
 * Retry function with exponential backoff for API calls
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 5)
 * @param {string} context - Context for logging (e.g., show name)
 * @returns {Promise} Result of the function or throws after max retries
 */
async function retryWithBackoff(fn, maxRetries = 5, context = 'API call') {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message.includes('rate limit') || error.message.includes('429');
      
      if (!isRateLimit || attempt === maxRetries) {
        // If not a rate limit error, or we've exhausted retries, throw the error
        throw error;
      }
      
      // Calculate exponential backoff delay (1s, 2s, 4s, 8s, 16s, max 60s)
      const baseDelay = 1000; // 1 second base
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 60000); // Max 60 seconds
      
      console.log(chalk.yellow(`⚠️  Rate limit hit for ${context} (attempt ${attempt}/${maxRetries})`));
      console.log(chalk.gray(`   🕒 Waiting ${delay / 1000} seconds before retry...`));
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Search for a TV show on TMDB
 * @param {string} showName - Name of the TV show to search for
 * @param {string|number} year - Year the show first aired (optional but recommended)
 * @returns {Promise<Object|null>} TMDB show data or null if not found
 */
async function searchTVShow(showName, year = null) {
  const apiKey = process.env.TVDB_API_TOKEN;
  if (!apiKey) {
    throw new Error('TVDB_API_TOKEN environment variable is required');
  }
  
  return rateLimiter.execute(async () => {
    const yearInfo = year && year !== 'Unknown' ? ` (${year})` : '';
    const context = `"${showName}"${yearInfo}`;
    
    return retryWithBackoff(async () => {
      const cleanedShowName = cleanShowTitle(showName);
      
      // Log if we cleaned the title
      if (cleanedShowName !== showName) {
        console.log(chalk.gray(`   🧹 Cleaned title: "${showName}" -> "${cleanedShowName}"`));
      }
      
      const encodedShowName = encodeURIComponent(cleanedShowName);
      let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodedShowName}&language=en-US`;
      
      // Add year parameter if provided to improve search accuracy
      if (year && year !== 'Unknown') {
        searchUrl += `&first_air_date_year=${year}`;
      }
      
      console.log(chalk.gray(`   🔗 API Request: ${searchUrl}`));
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          // Create an error object with status for retry logic
          const error = new Error(`Rate limit exceeded`);
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
      
      // Return the first (best) match
      return data.results[0];
      
    }, 5, context).catch(error => {
      console.error(chalk.red(`❌ Error searching for "${showName}" after retries:`, error.message));
      return null;
    });
  });
}

/**
 * Get detailed TV show information including seasons
 * @param {number} tmdbId - TMDB ID of the show
 * @returns {Promise<Object|null>} Detailed show information or null if error
 */
async function getTVShowDetails(tmdbId) {
  const apiKey = process.env.TVDB_API_TOKEN;
  
  return rateLimiter.execute(async () => {
    const context = `TMDB ID ${tmdbId}`;
    
    return retryWithBackoff(async () => {
      const detailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`;
      
      console.log(chalk.gray(`   🔗 API Request: ${detailsUrl}`));
      
      const response = await fetch(detailsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          // Create an error object with status for retry logic
          const error = new Error(`Rate limit exceeded`);
          error.status = 429;
          throw error;
        }
        console.error(chalk.yellow(`⚠️  TMDB details API error for ID ${tmdbId}: ${response.status}`));
        return null;
      }
      
      return await response.json();
      
    }, 5, context).catch(error => {
      console.error(chalk.red(`❌ Error getting details for TMDB ID ${tmdbId} after retries:`, error.message));
      return null;
    });
  });
}

/**
 * Get the highest regular season number from Plex data
 * Excludes "Specials" seasons and other non-numeric seasons
 * @param {Array} plexSeasons - Array of Plex season objects
 * @returns {number} Highest regular season number
 */
function getHighestPlexSeason(plexSeasons) {
  let highestSeason = 0;
  
  for (const season of plexSeasons) {
    const seasonTitle = season.title.toLowerCase();
    
    // Skip specials, extras, and other non-regular seasons
    if (seasonTitle.includes('special') || 
        seasonTitle.includes('extra') || 
        seasonTitle.includes('bonus') ||
        seasonTitle === 'all episodes') {
      continue;
    }
    
    // Extract season number from title like "Season 1", "Season 10", etc.
    const seasonMatch = seasonTitle.match(/season\s+(\d+)/);
    if (seasonMatch) {
      const seasonNum = parseInt(seasonMatch[1]);
      if (seasonNum > highestSeason) {
        highestSeason = seasonNum;
      }
    }
  }
  
  return highestSeason;
}

/**
 * Get the highest regular season number from TMDB data
 * Excludes season 0 (specials) and only counts aired seasons
 * @param {Array} tmdbSeasons - Array of TMDB season objects
 * @returns {number} Highest regular season number that has aired
 */
function getHighestTMDBSeason(tmdbSeasons) {
  let highestSeason = 0;
  
  for (const season of tmdbSeasons) {
    // Skip season 0 (specials) and seasons that haven't aired yet
    if (season.season_number === 0) continue;
    if (!season.air_date) continue;
    
    // Check if season has already aired
    const airDate = new Date(season.air_date);
    const now = new Date();
    if (airDate > now) continue;
    
    if (season.season_number > highestSeason) {
      highestSeason = season.season_number;
    }
  }
  
  return highestSeason;
}

/**
 * Check if a show has new seasons available
 * @param {Object} plexShow - Show data from Plex
 * @returns {Promise<Object>} Analysis results
 */
async function checkShowForNewSeasons(plexShow) {
  console.log(chalk.cyan(`🔍 Checking: ${plexShow.title} (${plexShow.year})`));
  
  // Search for show on TMDB with year for better accuracy
  let tmdbSearchResult = await searchTVShow(plexShow.title, plexShow.year);
  
  // If no results with year, try without year as fallback
  if (!tmdbSearchResult && plexShow.year && plexShow.year !== 'Unknown') {
    console.log(chalk.gray(`   🔄 Retrying search without year filter...`));
    tmdbSearchResult = await searchTVShow(plexShow.title);
  }
  
  if (!tmdbSearchResult) {
    return {
      show: plexShow,
      status: 'not_found',
      message: 'Show not found on TMDB'
    };
  }
  
  console.log(chalk.gray(`   ✅ Found on TMDB: "${tmdbSearchResult.name}" (${tmdbSearchResult.first_air_date?.split('-')[0]})`));
  
  // Get detailed information
  const tmdbDetails = await getTVShowDetails(tmdbSearchResult.id);
  if (!tmdbDetails) {
    return {
      show: plexShow,
      status: 'details_error',
      message: 'Could not get TMDB details'
    };
  }
  
  // Check if show is still running
  if (tmdbDetails.status === 'Ended' || tmdbDetails.status === 'Canceled') {
    console.log(chalk.gray(`   📺 ${plexShow.title}: Show status: ${tmdbDetails.status} - no new seasons expected`));
    return {
      show: plexShow,
      status: 'ended',
      message: `Show ${tmdbDetails.status.toLowerCase()}`
    };
  }
  
  // Compare season counts
  const plexHighestSeason = getHighestPlexSeason(plexShow.seasons);
  const tmdbHighestSeason = getHighestTMDBSeason(tmdbDetails.seasons);
  
  console.log(chalk.gray(`   📊 ${plexShow.title}: Plex has: Season ${plexHighestSeason}, TMDB has: Season ${tmdbHighestSeason}`));
  
  if (tmdbHighestSeason > plexHighestSeason) {
    console.log(chalk.green(`   🆕 ${plexShow.title}: Season ${tmdbHighestSeason} available! (you have up to Season ${plexHighestSeason})`));
    return {
      show: plexShow,
      status: 'new_season_available',
      tmdbData: tmdbDetails,
      plexHighestSeason,
      tmdbHighestSeason,
      missingSeasonsCount: tmdbHighestSeason - plexHighestSeason,
      message: `Season ${tmdbHighestSeason} available (you have up to Season ${plexHighestSeason})`
    };
  } else {
    console.log(chalk.gray(`   ✅ ${plexShow.title}: Show is up to date`));
    return {
      show: plexShow,
      status: 'up_to_date',
      message: 'Show is up to date'
    };
  }
}

/**
 * Display results of new season check
 * @param {Array} results - Array of check results
 */
function displayNewSeasonResults(results) {
  const showsWithNewSeasons = results.filter(r => r.status === 'new_season_available');
  const upToDateShows = results.filter(r => r.status === 'up_to_date');
  const endedShows = results.filter(r => r.status === 'ended');
  const errorShows = results.filter(r => r.status === 'not_found' || r.status === 'details_error');
  
  console.log(chalk.green.bold(`\n📺 New Season Check Summary:`));
  console.log(chalk.blue(`🔍 Total Shows Checked: ${results.length}`));
  console.log(chalk.green(`🆕 Shows with New Seasons: ${showsWithNewSeasons.length}`));
  console.log(chalk.blue(`✅ Shows Up to Date: ${upToDateShows.length}`));
  console.log(chalk.gray(`🏁 Ended/Canceled Shows: ${endedShows.length}`));
  console.log(chalk.yellow(`⚠️  Shows with Errors: ${errorShows.length}\n`));
  
  if (showsWithNewSeasons.length > 0) {
    console.log(chalk.green.bold('🎉 Shows with New Seasons Available:\n'));
    
    showsWithNewSeasons.forEach((result, index) => {
      console.log(chalk.yellow.bold(`${index + 1}. ${result.show.title} (${result.show.year})`));
      console.log(chalk.green(`   🆕 ${result.message}`));
      console.log(chalk.cyan(`   📅 Latest season aired: ${result.tmdbData.last_air_date || 'Unknown'}`));
      console.log(chalk.gray(`   🔗 TMDB: https://www.themoviedb.org/tv/${result.tmdbData.id}`));
      console.log('');
    });
  } else {
    console.log(chalk.blue('📺 All your shows are up to date!'));
  }
  
  if (errorShows.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  Shows with Issues:'));
    errorShows.forEach((result, index) => {
      console.log(chalk.gray(`${index + 1}. ${result.show.title} (${result.show.year}) - ${result.message}`));
    });
  }
}

async function checkForNewSeasons() {
  try {
    console.log(chalk.blue.bold('📺 Checking TV Library for New Seasons...\n'));
    
    console.log(chalk.cyan('🔄 Fetching TV library data...'));
    const startTime = Date.now();
    const result = await buildTVLibraryMap(); // Process all shows
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} TV series total, processing all shows`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    console.log(chalk.cyan('🔄 Checking for new seasons on TMDB...\n'));
    
    const validShows = result.data.filter(show => !show.error);
    console.log(chalk.gray(`📊 Processing ${validShows.length} shows with parallel processing (30 requests/second rate limit)\n`));
    
    // Process all shows in parallel - the rate limiter will handle throttling
    const checkPromises = validShows.map(show => checkShowForNewSeasons(show));
    const checkResults = await Promise.all(checkPromises);
    
    console.log(chalk.green('\n✅ Season check complete\n'));
    
    displayNewSeasonResults(checkResults);
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during new season check:'), error.message);
    process.exit(1);
  }
}

checkForNewSeasons();