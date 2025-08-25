#!/usr/bin/env node

/* eslint-disable no-plusplus */

import chalk from 'chalk';
import { fetchRawPlexTelevisionLibraryData } from '../remote';

import 'dotenv/config';

(async function main() {
  const plexTelevisionLibrary = await fetchRawPlexTelevisionLibraryData();

  for (let i = 0; i < plexTelevisionLibrary.length; i++) {
    const show = plexTelevisionLibrary[i];

    for (let j = 0; j < show.seasons.length; j++) {
      const season = show.seasons[j];
      const { episodes } = season;

      const avgBitrate = episodes.reduce((acc, val) => acc + val.bitrate, 0) / episodes.length;

      const maxAcceptableVariance = 0.7;
      const minBitrate = avgBitrate * maxAcceptableVariance;

      const episodesBelowThreshold = episodes.filter((episode) => episode.bitrate < minBitrate);

      if (episodesBelowThreshold.length > 0) {
        episodesBelowThreshold.forEach((episode) => {
          console.log(`Show: ${chalk.whiteBright.bgRedBright.bold(show.title)}, Season: ${chalk.whiteBright.bgRedBright.bold(season.title)}, Episode: ${chalk.whiteBright.bgRedBright.bold(episode.episodeNumber)}\nAvg Bitrate: ${avgBitrate}, Episode Bitrate: ${episode.bitrate}`);
          console.log();
        });
      }
    }
  }
}());
