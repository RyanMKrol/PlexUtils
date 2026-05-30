#!/usr/bin/env node

import chalk from 'chalk';
import { fetchMovieLibrary } from '../remote/index.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

// Produces a plain newline-separated list of every movie name (with year) in
// the library — intended as raw input for an LLM gap analysis. Single request.
async function listMovieNames() {
  try {
    console.log(chalk.blue.bold('🎬 Fetching movie names...\n'));

    const library = await fetchMovieLibrary();
    const raw = library.MediaContainer.Video || [];
    const movies = Array.isArray(raw) ? raw : [raw];

    const names = movies.map((movie) => {
      const title = movie['@_title'] || 'Unknown Title';
      const year = movie['@_year'];
      return year ? `${title} (${year})` : title;
    });

    const content = names.join('\n') + '\n';

    const filename = generateTimestampedFilename('movie-names');
    const filePath = writeOutputFile(filename, content);

    console.log(chalk.green(`✅ ${names.length} movie names saved to: ${chalk.bold(filePath)}`));
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching movie names:'), error.message);
    process.exit(1);
  }
}

listMovieNames();
