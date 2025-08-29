#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import { RateLimiter, retryWithBackoff } from '../utils/apiUtils.js';
import { cleanShowTitle } from '../utils/stringUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

// Create a global rate limiter instance
const rateLimiter = new RateLimiter(30); // 30 requests per second

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
 * Generate new season check report
 * @param {Array} results - Array of check results
 * @returns {string} Report content
 */
function generateNewSeasonReport(results) {
  const showsWithNewSeasons = results.filter(r => r.status === 'new_season_available');
  const upToDateShows = results.filter(r => r.status === 'up_to_date');
  const endedShows = results.filter(r => r.status === 'ended');
  const errorShows = results.filter(r => r.status === 'not_found' || r.status === 'details_error');
  
  let output = `📺 NEW SEASON CHECK REPORT\n`;
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += `🔍 Total Shows Checked: ${results.length}\n`;
  output += `🆕 Shows with New Seasons: ${showsWithNewSeasons.length}\n`;
  output += `✅ Shows Up to Date: ${upToDateShows.length}\n`;
  output += `🏁 Ended/Canceled Shows: ${endedShows.length}\n`;
  output += `⚠️  Shows with Errors: ${errorShows.length}\n\n`;
  output += '='.repeat(100) + '\n\n';
  
  if (showsWithNewSeasons.length > 0) {
    output += '🎉 SHOWS WITH NEW SEASONS AVAILABLE:\n\n';
    
    showsWithNewSeasons.forEach((result, index) => {
      output += `${index + 1}. ${result.show.title} (${result.show.year})\n`;
      output += `   🆕 ${result.message}\n`;
      output += `   📅 Latest season aired: ${result.tmdbData.last_air_date || 'Unknown'}\n`;
      output += `   🔗 TMDB: https://www.themoviedb.org/tv/${result.tmdbData.id}\n`;
      output += `   📊 Missing ${result.missingSeasonsCount} season(s)\n`;
      output += '='.repeat(80) + '\n\n';
    });
  } else {
    output += '📺 All your shows are up to date!\n\n';
  }
  
  if (upToDateShows.length > 0) {
    output += '✅ SHOWS UP TO DATE:\n\n';
    upToDateShows.forEach((result, index) => {
      output += `${index + 1}. ${result.show.title} (${result.show.year})\n`;
    });
    output += '\n';
  }
  
  if (endedShows.length > 0) {
    output += '🏁 ENDED/CANCELED SHOWS:\n\n';
    endedShows.forEach((result, index) => {
      output += `${index + 1}. ${result.show.title} (${result.show.year}) - ${result.message}\n`;
    });
    output += '\n';
  }
  
  if (errorShows.length > 0) {
    output += '⚠️  SHOWS WITH ISSUES:\n\n';
    errorShows.forEach((result, index) => {
      output += `${index + 1}. ${result.show.title} (${result.show.year}) - ${result.message}\n`;
    });
    output += '\n';
  }
  
  return output;
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
    
    console.log(chalk.cyan('📝 Generating new season report...'));
    const reportContent = generateNewSeasonReport(checkResults);
    
    const filename = generateTimestampedFilename('new-seasons-check');
    const filePath = writeOutputFile(filename, reportContent);
    
    const showsWithNewSeasons = checkResults.filter(r => r.status === 'new_season_available');
    console.log(chalk.green(`✅ New season report saved to: ${chalk.bold(filePath)}`));
    console.log(chalk.gray(`📄 Report checked ${checkResults.length} shows, found ${showsWithNewSeasons.length} with new seasons available`));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during new season check:'), error.message);
    process.exit(1);
  }
}

checkForNewSeasons();