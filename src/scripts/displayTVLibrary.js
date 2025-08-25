#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import { formatBitrate } from '../utils/dataUtils.js';
import 'dotenv/config';

function displayTVLibraryFromMap(tvLibraryMap) {
  console.log(chalk.green.bold(`📊 Total TV Series: ${tvLibraryMap.length}\n`));
  
  tvLibraryMap.forEach((show, index) => {
    console.log(chalk.yellow.bold(`${index + 1}. ${show.title} (${show.year})`));
    
    if (show.error) {
      console.log(chalk.red(`   ❌ Error fetching seasons: ${show.error}`));
    } else {
      console.log(chalk.cyan(`   🗂️  Seasons: ${show.seasons.length}`));
      
      show.seasons.forEach(season => {
        if (season.error) {
          console.log(chalk.red(`      📁 ${season.title}: Error fetching episodes - ${season.error}`));
        } else {
          console.log(chalk.white(`      📁 ${season.title} (${season.episodeCount} episodes)`));
          
          // Display first 3 episodes with file details
          const episodesToShow = season.episodes.slice(0, 3);
          episodesToShow.forEach(episode => {
            const displayBitrate = formatBitrate(episode.bitrate);
            
            console.log(chalk.green(`         📺 Episode ${episode.index}: ${episode.title}`));
            console.log(chalk.gray(`            📅 Air Date: ${episode.originallyAvailableAt} | Runtime: ${episode.duration} min`));
            console.log(chalk.gray(`            🎬 Resolution: ${episode.resolution} | Bitrate: ${displayBitrate} | Size: ${episode.fileSize}`));
            console.log(chalk.gray(`            📦 Container: ${episode.container} | Video: ${episode.videoCodec} | Audio: ${episode.audioCodec} (${episode.audioChannels}ch)`));
            console.log(chalk.gray(`            📁 File: ${episode.filename}`));
          });
          
          if (season.episodes.length > 3) {
            console.log(chalk.gray(`         ... and ${season.episodes.length - 3} more episodes`));
          }
        }
      });
      
      console.log(chalk.magenta(`   📈 Total Episodes: ${show.totalEpisodes}`));
    }
    
    console.log('='.repeat(80)); // Separator line between shows
    console.log(''); // Empty line between shows
  });
}

async function displayTVLibrary() {
  try {
    console.log(chalk.blue.bold('📺 Fetching TV Library Information...\n'));
    
    console.log(chalk.cyan('🔄 Fetching all TV shows...'));
    const startTime = Date.now();
    const result = await buildTVLibraryMap(10); // Limit to first 10 for testing
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} TV series total, processing first ${result.processed} for testing\n`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    displayTVLibraryFromMap(result.data);
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching TV library:'), error.message);
    process.exit(1);
  }
}

displayTVLibrary();