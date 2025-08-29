#!/usr/bin/env node

import chalk from 'chalk';
import { buildMovieLibraryMap } from '../utils/libraryProcessor.js';
import { formatBitrate } from '../utils/dataUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

function generateMovieLibraryReport(movieLibraryMap) {
  let output = `🎬 MOVIE LIBRARY REPORT\n`;
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total Movies: ${movieLibraryMap.length}\n\n`;
  output += '='.repeat(100) + '\n\n';
  
  movieLibraryMap.forEach((movie, index) => {
    output += `${index + 1}. ${movie.title} (${movie.year})\n`;
    
    if (movie.error) {
      output += `   ❌ Error fetching movie details: ${movie.error}\n`;
    } else {
      const displayBitrate = formatBitrate(movie.bitrate);
      
      output += `   📅 Release Date: ${movie.originallyAvailableAt} | Runtime: ${movie.duration} min\n`;
      output += `   🎬 Resolution: ${movie.resolution} | Bitrate: ${displayBitrate} | Size: ${movie.fileSize}\n`;
      output += `   📦 Container: ${movie.container} | Video: ${movie.videoCodec} | Audio: ${movie.audioCodec} (${movie.audioChannels}ch)\n`;
      output += `   📁 File: ${movie.filename}\n`;
    }
    
    output += '='.repeat(80) + '\n';
    output += '\n';
  });
  
  return output;
}

async function displayMovieLibrary() {
  try {
    console.log(chalk.blue.bold('🎬 Fetching Movie Library Information...\n'));
    
    console.log(chalk.cyan('🔄 Fetching all movies...'));
    const startTime = Date.now();
    const result = await buildMovieLibraryMap(); 
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} movies total`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    console.log(chalk.cyan('📝 Generating movie library report...'));
    const reportContent = generateMovieLibraryReport(result.data);
    
    const filename = generateTimestampedFilename('movie-library-report');
    const filePath = writeOutputFile(filename, reportContent);
    
    console.log(chalk.green(`✅ Movie library report saved to: ${chalk.bold(filePath)}`));
    console.log(chalk.gray(`📄 Report contains ${result.data.length} movies with detailed information`));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching movie library:'), error.message);
    process.exit(1);
  }
}

displayMovieLibrary();