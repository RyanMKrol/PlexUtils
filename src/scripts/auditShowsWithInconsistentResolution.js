#!/usr/bin/env node

/* eslint-disable no-plusplus */

import chalk from 'chalk';
import randomHex from 'random-hex';

import { fetchRawPlexTelevisionLibraryData } from '../remote';
import 'dotenv/config';

(async function main() {
  const plexTelevisionLibrary = await fetchRawPlexTelevisionLibraryData();

  for (let i = 0; i < plexTelevisionLibrary.length; i++) {
    const show = plexTelevisionLibrary[i];
    const hex = randomHex.generate();
    const chalkFunc = chalk.hex(hex).bold;

    for (let j = 0; j < show.seasons.length; j++) {
      const season = show.seasons[j];
      const { episodes } = season;

      const targetResolution = episodes[0].resolution;
      episodes.forEach((episode) => {
        if (episode.resolution !== targetResolution) {
          console.log(`Show: ${chalkFunc(show.title)}, Season: ${chalkFunc(season.title)}, Episode: ${chalkFunc(episode.episodeNumber)}\nSeason Resolution: ${targetResolution}, Episode Resolution: ${episode.resolution}`);
          console.log();
        }
      });
    }
  }
}());
