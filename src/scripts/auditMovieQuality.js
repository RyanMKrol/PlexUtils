#!/usr/bin/env node

import chalk from 'chalk';
import { buildMovieLibraryMap } from '../utils/libraryProcessor.js';
import 'dotenv/config';

/**
 * Check if a resolution is not 1080 or 4k
 * @param {string} resolution - Resolution string (e.g., "1080", "4k", "720", "480")
 * @returns {boolean} True if resolution is not 1080 or 4k
 */
function isNotHighQuality(resolution) {
  if (!resolution || resolution === 'Unknown') return true;
  
  // Check for exact values: "1080" or "4k"
  const normalizedResolution = resolution.toLowerCase().trim();
  
  return normalizedResolution !== '1080' && normalizedResolution !== '4k';
}

/**
 * Check if a movie was released in the last 15 years
 * @param {string|number} year - Year the movie was released
 * @returns {boolean} True if movie was released in the last 15 years
 */
function isRecentMovie(year) {
  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - 15; // 15 years ago
  const movieYear = parseInt(year);
  
  return !isNaN(movieYear) && movieYear >= cutoffYear;
}

/**
 * Analyze movies for quality issues
 * @param {Array} movies - Array of movie objects
 * @returns {Array} Movies that need quality upgrades
 */
function analyzeMovieQuality(movies) {
  const problematicMovies = [];
  
  movies.forEach(movie => {
    if (movie.error) return; // Skip movies with fetch errors
    
    const isRecent = isRecentMovie(movie.year);
    const hasLowResolution = isNotHighQuality(movie.resolution);
    
    if (isRecent && hasLowResolution) {
      problematicMovies.push({
        ...movie,
        issue: 'Not in 1080 or 4k quality',
        expectedResolutions: '1080 or 4k'
      });
    }
  });
  
  return problematicMovies;
}

/**
 * Display movie quality analysis results
 * @param {Array} problematicMovies - Movies with quality issues
 * @param {number} totalMovies - Total number of movies analyzed
 */
function displayMovieQualityAnalysis(problematicMovies, totalMovies) {
  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - 15;
  
  console.log(chalk.green.bold(`\n🎬 Movie Quality Analysis Summary:`));
  console.log(chalk.blue(`📽️  Total Movies Analyzed: ${totalMovies}`));
  console.log(chalk.blue(`📅 Checking movies from ${cutoffYear} onwards (last 15 years)`));
  console.log(chalk.blue(`⚠️  Movies needing quality upgrade: ${problematicMovies.length}`));
  console.log(chalk.blue(`✅ Recent movies in good quality: ${totalMovies - problematicMovies.length}\n`));
  
  if (problematicMovies.length === 0) {
    console.log(chalk.green('🎉 All recent movies are in 1080 or 4k quality!'));
    return;
  }
  
  console.log(chalk.yellow.bold('Movies that should be in 1080 or 4k quality:\n'));
  
  problematicMovies.forEach((movie, index) => {
    console.log(chalk.yellow.bold(`${index + 1}. ${movie.title} (${movie.year})`));
    console.log(chalk.red(`   📐 Current Resolution: ${movie.resolution}`));
    console.log(chalk.green(`   ✨ Expected: ${movie.expectedResolutions}`));
    console.log(chalk.gray(`   📅 Release Date: ${movie.originallyAvailableAt}`));
    console.log(chalk.gray(`   💾 File Size: ${movie.fileSize}`));
    console.log(chalk.gray(`   📦 Format: ${movie.container} | Codec: ${movie.videoCodec}`));
    
    // Show only filename, not full path
    const filename = movie.filename.split('/').pop().split('\\').pop();
    console.log(chalk.gray(`   📁 File: ${filename}`));
    
    // Show folder path for easy navigation
    const folderPath = movie.filename.substring(0, movie.filename.lastIndexOf('/'));
    console.log(chalk.gray(`   📂 Path: ${folderPath}`));
    
    console.log('='.repeat(80));
    console.log('');
  });
}

async function auditMovieQuality() {
  try {
    console.log(chalk.blue.bold('🎬 Auditing Movie Library for Quality Issues...\n'));
    
    console.log(chalk.cyan('🔄 Fetching movie library data...'));
    const startTime = Date.now();
    const result = await buildMovieLibraryMap(); // Get all movies
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} movies total`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    console.log(chalk.cyan('🔄 Analyzing movie quality...'));
    
    const problematicMovies = analyzeMovieQuality(result.data);
    
    console.log(chalk.green('✅ Analysis complete\n'));
    
    displayMovieQualityAnalysis(problematicMovies, result.data.length);
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during movie quality audit:'), error.message);
    process.exit(1);
  }
}

auditMovieQuality();