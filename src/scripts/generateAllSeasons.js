#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { RateLimiter, retryWithBackoff } from '../utils/apiUtils.js';
import { cleanShowTitle } from '../utils/stringUtils.js';
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
 * Process a single show to get all its seasons
 * @param {Object} inputShow - Show data from input file
 * @returns {Promise<Array>} Array of season objects
 */
async function processShow(inputShow) {
  console.log(chalk.cyan(`🔍 Processing: ${inputShow.title} (${inputShow.year})`));
  
  // Search for show on TMDB
  let tmdbSearchResult = await searchTVShow(inputShow.title, inputShow.year);
  
  // If no results with year, try without year as fallback
  if (!tmdbSearchResult && inputShow.year) {
    console.log(chalk.gray(`   🔄 Retrying search without year filter...`));
    tmdbSearchResult = await searchTVShow(inputShow.title);
  }
  
  if (!tmdbSearchResult) {
    console.log(chalk.red(`❌ Could not find "${inputShow.title}" on TMDB`));
    return [];
  }
  
  console.log(chalk.gray(`   ✅ Found on TMDB: "${tmdbSearchResult.name}" (${tmdbSearchResult.first_air_date?.split('-')[0]})`));
  
  // Get detailed information
  const tmdbDetails = await getTVShowDetails(tmdbSearchResult.id);
  if (!tmdbDetails) {
    console.log(chalk.red(`❌ Could not get details for "${inputShow.title}"`));
    return [];
  }
  
  // Generate season objects for all regular seasons (excluding season 0/specials)
  const seasons = [];
  const regularSeasons = tmdbDetails.seasons.filter(season => season.season_number > 0);
  
  for (const season of regularSeasons) {
    seasons.push({
      title: inputShow.title,
      year: inputShow.year,
      season: season.season_number
    });
  }
  
  console.log(chalk.green(`   ✅ Found ${seasons.length} seasons for "${inputShow.title}"`));
  return seasons;
}

async function generateAllSeasons() {
  try {
    console.log(chalk.blue.bold('📺 Generating All Seasons Data...\n'));
    
    // Read input file
    const inputPath = path.resolve('in/input.json');
    console.log(chalk.cyan(`📖 Reading input from: ${inputPath}`));
    
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    if (!Array.isArray(inputData)) {
      throw new Error('Input file must contain an array of show objects');
    }
    
    console.log(chalk.green(`✅ Found ${inputData.length} shows to process\n`));
    
    // Process all shows in parallel - the rate limiter will handle throttling
    console.log(chalk.cyan('🔄 Processing shows and fetching season data...\n'));
    const processPromises = inputData.map(show => processShow(show));
    const results = await Promise.all(processPromises);
    
    // Flatten the results array
    const allSeasons = results.flat();
    
    console.log(chalk.green('\n✅ Processing complete\n'));
    
    // Create output directory if it doesn't exist
    const outputDir = path.resolve('out');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write output file
    const outputPath = path.resolve('out/seasons.json');
    console.log(chalk.cyan(`📝 Writing output to: ${outputPath}`));
    
    fs.writeFileSync(outputPath, JSON.stringify(allSeasons, null, 2));
    
    console.log(chalk.green(`✅ Output saved successfully!`));
    console.log(chalk.gray(`📄 Generated ${allSeasons.length} season entries from ${inputData.length} shows`));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during season generation:'), error.message);
    process.exit(1);
  }
}

generateAllSeasons();