#!/usr/bin/env node

import chalk from 'chalk';
import { buildMovieLibraryMap } from '../utils/libraryProcessor.js';
import 'dotenv/config';

function displayMovieLibraryFromMap(movieLibraryMap) {
  console.log(chalk.green.bold(`🎬 Total Movies: ${movieLibraryMap.length}\n`));
  
  movieLibraryMap.forEach((movie, index) => {
    console.log(chalk.yellow.bold(`${index + 1}. ${movie.title} (${movie.year})`));
    
    if (movie.error) {
      console.log(chalk.red(`   ❌ Error fetching movie details: ${movie.error}`));
    } else {
      const displayBitrate = movie.bitrate !== 'Unknown' ? 
        `${Math.round(parseInt(movie.bitrate.replace(' bps', '')) / 1000)} kbps` : 
        'Unknown';
      
      console.log(chalk.gray(`   📅 Release Date: ${movie.originallyAvailableAt} | Runtime: ${movie.duration} min`));
      console.log(chalk.gray(`   🎬 Resolution: ${movie.resolution} | Bitrate: ${displayBitrate} | Size: ${movie.fileSize}`));
      console.log(chalk.gray(`   📦 Container: ${movie.container} | Video: ${movie.videoCodec} | Audio: ${movie.audioCodec} (${movie.audioChannels}ch)`));
      console.log(chalk.gray(`   📁 File: ${movie.filename}`));
    }
    
    console.log('='.repeat(80)); // Separator line between movies
    console.log(''); // Empty line between movies
  });
}

async function displayMovieLibrary() {
  try {
    console.log(chalk.blue.bold('🎬 Fetching Movie Library Information...\n'));
    
    console.log(chalk.cyan('🔄 Fetching all movies...'));
    const startTime = Date.now();
    const result = await buildMovieLibraryMap(10); // Limit to first 10 for testing
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} movies total, processing first ${result.processed} for testing\n`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    displayMovieLibraryFromMap(result.data);
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching movie library:'), error.message);
    process.exit(1);
  }
}

displayMovieLibrary();