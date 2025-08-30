#!/usr/bin/env node

import chalk from 'chalk';
import { buildMovieLibraryMap } from '../utils/libraryProcessor.js';
import { isNotHighQuality } from '../utils/dataUtils.js';
import { isRecentMovie } from '../utils/dateUtils.js';
import { getFilenameFromPath } from '../utils/stringUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import { filterIgnoredItems, presentAuditResults, getIgnoredItemCount } from '../utils/interactiveUtils.js';
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

/**
 * Generate unique ID for a movie issue
 * @param {Object} movie - Movie object with quality issue
 * @returns {string} Unique identifier
 */
function getMovieIssueId(movie) {
  return `${movie.title}:${movie.year}:${movie.resolution}`;
}

/**
 * Display a movie quality issue to the user
 * @param {Object} movie - Movie object with quality issue
 */
function displayMovieIssue(movie) {
  console.log(chalk.yellow.bold(`${movie.title} (${movie.year})`));
  console.log(chalk.gray(`📐 Current Resolution: ${movie.resolution}`));
  console.log(chalk.gray(`✨ Expected: ${movie.expectedResolutions}`));
  console.log(chalk.gray(`📅 Release Date: ${movie.originallyAvailableAt}`));
  console.log(chalk.gray(`💾 File Size: ${movie.fileSize}`));
  console.log(chalk.gray(`📦 Format: ${movie.container} | Codec: ${movie.videoCodec}`));
  
  const filename = getFilenameFromPath(movie.filename);
  console.log(chalk.gray(`📁 File: ${filename}`));
  
  const folderPath = movie.filename.substring(0, movie.filename.lastIndexOf('/'));
  console.log(chalk.gray(`📂 Path: ${folderPath}`));
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
    
    const allProblematicMovies = analyzeMovieQuality(result.data);
    
    console.log(chalk.green('✅ Analysis complete\n'));
    
    // Always generate complete audit report first
    console.log(chalk.cyan('📝 Generating complete movie quality audit report...'));
    const completeReportContent = generateMovieQualityReport(allProblematicMovies, result.data.length);
    const completeFilename = generateTimestampedFilename('movie-quality-audit-complete');
    const completeFilePath = writeOutputFile(completeFilename, completeReportContent);
    
    console.log(chalk.green(`✅ Complete audit report saved to: ${chalk.bold(completeFilePath)}`));
    console.log(chalk.gray(`📄 Complete report contains ${allProblematicMovies.length} movies with quality issues\n`));
    
    // Filter out previously ignored items
    const auditType = 'movie-quality';
    const problematicMovies = filterIgnoredItems(auditType, allProblematicMovies, getMovieIssueId);
    
    const ignoredCount = getIgnoredItemCount(auditType);
    if (ignoredCount > 0) {
      console.log(chalk.gray(`📋 Found ${allProblematicMovies.length} total issues, ${ignoredCount} previously ignored, ${problematicMovies.length} new/kept items for interactive review\n`));
    } else {
      console.log(chalk.gray(`📋 Found ${problematicMovies.length} items for interactive review\n`));
    }
    
    if (problematicMovies.length === 0) {
      console.log(chalk.green('🎉 No movie quality issues to review interactively!'));
      if (ignoredCount > 0) {
        console.log(chalk.gray(`(${ignoredCount} items are being ignored from interactive review)`));
      }
      return;
    }
    
    // Present items to user interactively
    console.log(chalk.blue.bold('🔍 Interactive Movie Quality Review'));
    console.log(chalk.gray('Each movie below needs a quality upgrade. Choose whether to keep or ignore each item from future reviews.\n'));
    
    const keptItems = await presentAuditResults(auditType, problematicMovies, getMovieIssueId, displayMovieIssue);
    
    if (keptItems.length > 0) {
      console.log(chalk.cyan('\n📝 Generating actionable items report...'));
      const actionableReportContent = generateMovieQualityReport(keptItems, result.data.length);
      
      const actionableFilename = generateTimestampedFilename('movie-quality-audit-actionable');
      const actionableFilePath = writeOutputFile(actionableFilename, actionableReportContent);
      
      console.log(chalk.green(`✅ Actionable items report saved to: ${chalk.bold(actionableFilePath)}`));
      console.log(chalk.gray(`📄 Actionable report contains ${keptItems.length} movies marked for quality upgrades`));
    } else {
      console.log(chalk.green('\n🎉 All quality issues have been addressed or ignored for future reviews!'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during movie quality audit:'), error.message);
    process.exit(1);
  }
}

auditMovieQuality();