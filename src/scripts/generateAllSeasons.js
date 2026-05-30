#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { searchTVShow, getTVShowDetails } from '../remote/tmdb.js';
import 'dotenv/config';

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