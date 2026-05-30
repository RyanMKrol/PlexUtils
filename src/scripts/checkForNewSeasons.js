#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import { searchTVShow, getTVShowDetails } from '../remote/tmdb.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

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

/**
 * Generate JSON data with missing seasons information
 * @param {Array} results - Array of check results
 * @returns {Array} Array of missing season objects
 */
function generateMissingSeasonsJson(results) {
  const showsWithNewSeasons = results.filter(r => r.status === 'new_season_available');
  const missingSeasons = [];
  
  showsWithNewSeasons.forEach(result => {
    const { show, plexHighestSeason, tmdbHighestSeason, tmdbData } = result;
    const releaseYear = tmdbData.first_air_date ? tmdbData.first_air_date.split('-')[0] : show.year;
    
    // Generate an entry for each missing season
    for (let season = plexHighestSeason + 1; season <= tmdbHighestSeason; season++) {
      missingSeasons.push({
        title: show.title,
        year: releaseYear,
        season: season.toString()
      });
    }
  });
  
  return missingSeasons;
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
    
    // Always generate complete season check report first
    console.log(chalk.cyan('📝 Generating complete season check report...'));
    const completeReportContent = generateNewSeasonReport(checkResults);
    const completeFilename = generateTimestampedFilename('new-seasons-check-complete');
    const completeFilePath = writeOutputFile(completeFilename, completeReportContent);
    
    console.log(chalk.green(`✅ Complete season check report saved to: ${chalk.bold(completeFilePath)}`));
    console.log(chalk.gray(`📄 Complete report checked ${checkResults.length} shows total\n`));
    
    // Generate JSON file with missing seasons information
    console.log(chalk.cyan('📝 Generating JSON file with missing seasons...'));
    const missingSeasons = generateMissingSeasonsJson(checkResults);
    const jsonFilename = generateTimestampedFilename('missing-seasons', 'json');
    const jsonContent = JSON.stringify(missingSeasons, null, 2);
    const jsonFilePath = writeOutputFile(jsonFilename, jsonContent);
    
    console.log(chalk.green(`✅ Missing seasons JSON saved to: ${chalk.bold(jsonFilePath)}`));
    console.log(chalk.gray(`📄 JSON file contains ${missingSeasons.length} missing season entries\n`));
    
    const showsWithNewSeasons = checkResults.filter(r => r.status === 'new_season_available');
    
    if (showsWithNewSeasons.length > 0) {
      console.log(chalk.green(`🎉 Found ${showsWithNewSeasons.length} shows with new seasons available!`));
    } else {
      console.log(chalk.green('🎉 All your shows are up to date!'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during new season check:'), error.message);
    process.exit(1);
  }
}

checkForNewSeasons();