#!/usr/bin/env node

import chalk from 'chalk';
import { fetchTVLibrary } from '../remote/index.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import 'dotenv/config';

// Produces a plain newline-separated list of every TV show name (with year) in
// the library — intended as raw input for an LLM gap analysis. Single request.
async function listTVNames() {
  try {
    console.log(chalk.blue.bold('📺 Fetching TV show names...\n'));

    const library = await fetchTVLibrary();
    const raw = library.MediaContainer.Directory || [];
    const shows = Array.isArray(raw) ? raw : [raw];

    const names = shows.map((show) => {
      const title = show['@_title'] || 'Unknown Title';
      const year = show['@_year'];
      return year ? `${title} (${year})` : title;
    });

    const content = names.join('\n') + '\n';

    const filename = generateTimestampedFilename('tv-names');
    const filePath = writeOutputFile(filename, content);

    console.log(chalk.green(`✅ ${names.length} TV show names saved to: ${chalk.bold(filePath)}`));
  } catch (error) {
    console.error(chalk.red.bold('❌ Error fetching TV show names:'), error.message);
    process.exit(1);
  }
}

listTVNames();
