#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import { formatBitrate } from '../utils/dataUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

function generateTVLibraryReport(tvLibraryMap) {
  let output = `📺 TV LIBRARY REPORT\n`;
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total TV Series: ${tvLibraryMap.length}\n\n`;
  output += '='.repeat(100) + '\n\n';
  
  tvLibraryMap.forEach((show, index) => {
    output += `${index + 1}. ${show.title} (${show.year})\n`;
    
    if (show.error) {
      output += `   ❌ Error fetching seasons: ${show.error}\n`;
    } else {
      output += `   🗂️  Seasons: ${show.seasons.length}\n`;
      
      show.seasons.forEach(season => {
        if (season.error) {
          output += `      📁 ${season.title}: Error fetching episodes - ${season.error}\n`;
        } else {
          output += `      📁 ${season.title} (${season.episodeCount} episodes)\n`;
          
          // Display first 3 episodes with file details
          const episodesToShow = season.episodes.slice(0, 3);
          episodesToShow.forEach(episode => {
            const displayBitrate = formatBitrate(episode.bitrate);
            
            output += `         📺 Episode ${episode.index}: ${episode.title}\n`;
            output += `            📅 Air Date: ${episode.originallyAvailableAt} | Runtime: ${episode.duration} min\n`;
            output += `            🎬 Resolution: ${episode.resolution} | Bitrate: ${displayBitrate} | Size: ${episode.fileSize}\n`;
            output += `            📦 Container: ${episode.container} | Video: ${episode.videoCodec} | Audio: ${episode.audioCodec} (${episode.audioChannels}ch)\n`;
            output += `            📁 File: ${episode.filename}\n`;
          });
          
          if (season.episodes.length > 3) {
            output += `         ... and ${season.episodes.length - 3} more episodes\n`;
          }
        }
      });
      
      output += `   📈 Total Episodes: ${show.totalEpisodes}\n`;
    }
    
    output += '='.repeat(80) + '\n';
    output += '\n';
  });
  
  return output;
}

async function displayTVLibrary() {
  try {
    console.log(chalk.blue.bold('📺 Fetching TV Library Information...\n'));
    
    console.log(chalk.cyan('🔄 Fetching all TV shows...'));
    const startTime = Date.now();
    const result = await buildTVLibraryMap();
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} TV series total`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    console.log(chalk.cyan('📝 Generating TV library report...'));
    const reportContent = generateTVLibraryReport(result.data);
    
    const filename = generateTimestampedFilename('tv-library-report');
    const filePath = writeOutputFile(filename, reportContent);
    
    console.log(chalk.green(`✅ TV library report saved to: ${chalk.bold(filePath)}`));
    console.log(chalk.gray(`📄 Report contains ${result.data.length} TV series with detailed episode information`));
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching TV library:'), error.message);
    process.exit(1);
  }
}

displayTVLibrary();