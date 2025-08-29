#!/usr/bin/env node

import chalk from 'chalk';
import { buildMovieLibraryMap } from '../utils/libraryProcessor.js';
import { isNotHighQuality } from '../utils/dataUtils.js';
import { isRecentMovie } from '../utils/dateUtils.js';
import { getFilenameFromPath } from '../utils/stringUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';


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
 * Generate movie quality analysis report
 * @param {Array} problematicMovies - Movies with quality issues
 * @param {number} totalMovies - Total number of movies analyzed
 * @returns {string} Report content
 */
function generateMovieQualityReport(problematicMovies, totalMovies) {
  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - 15;
  
  let output = `🎬 MOVIE QUALITY AUDIT REPORT\n`;
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += `📽️  Total Movies Analyzed: ${totalMovies}\n`;
  output += `📅 Checking movies from ${cutoffYear} onwards (last 15 years)\n`;
  output += `⚠️  Movies needing quality upgrade: ${problematicMovies.length}\n`;
  output += `✅ Recent movies in good quality: ${totalMovies - problematicMovies.length}\n\n`;
  output += '='.repeat(100) + '\n\n';
  
  if (problematicMovies.length === 0) {
    output += '🎉 All recent movies are in 1080 or 4k quality!\n';
    return output;
  }
  
  output += 'Movies that should be in 1080 or 4k quality:\n\n';
  
  problematicMovies.forEach((movie, index) => {
    output += `${index + 1}. ${movie.title} (${movie.year})\n`;
    output += `   📐 Current Resolution: ${movie.resolution}\n`;
    output += `   ✨ Expected: ${movie.expectedResolutions}\n`;
    output += `   📅 Release Date: ${movie.originallyAvailableAt}\n`;
    output += `   💾 File Size: ${movie.fileSize}\n`;
    output += `   📦 Format: ${movie.container} | Codec: ${movie.videoCodec}\n`;
    
    // Show only filename, not full path
    const filename = getFilenameFromPath(movie.filename);
    output += `   📁 File: ${filename}\n`;
    
    // Show folder path for easy navigation
    const folderPath = movie.filename.substring(0, movie.filename.lastIndexOf('/'));
    output += `   📂 Path: ${folderPath}\n`;
    
    output += '='.repeat(80) + '\n';
    output += '\n';
  });
  
  return output;
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
    
    console.log(chalk.cyan('📝 Generating movie quality report...'));
    const reportContent = generateMovieQualityReport(problematicMovies, result.data.length);
    
    const filename = generateTimestampedFilename('movie-quality-audit');
    const filePath = writeOutputFile(filename, reportContent);
    
    console.log(chalk.green(`✅ Movie quality audit report saved to: ${chalk.bold(filePath)}`));
    console.log(chalk.gray(`📄 Report analyzed ${result.data.length} movies, found ${problematicMovies.length} needing quality upgrades`));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during movie quality audit:'), error.message);
    process.exit(1);
  }
}

auditMovieQuality();