#!/usr/bin/env node

/* eslint-disable no-plusplus */
/* eslint-disable*/

import chalk from 'chalk';
import { fetchRawPlexTelevisionLibraryData, fetchTmdbSeasonData } from '../remote';

import 'dotenv/config';

(async function main() {
  const plexTelevisionLibrary = (await fetchRawPlexTelevisionLibraryData());
  const auditedShows = [];
  for (let i = 0; i < plexTelevisionLibrary.length; i++) {
    const show = plexTelevisionLibrary[i];

    const tmdbShowData = await fetchTmdbSeasonData(show);
    const releasedSeasons = Math.min((tmdbShowData.seasons.filter((season) => season.air_date !== null)).length, tmdbShowData.number_of_seasons)
    console.log(show.title, releasedSeasons)
    if (show.seasons.length !== releasedSeasons) {
      auditedShows.push({ show, releasedSeasons });
    }
  }
  const longest = auditedShows.reduce((acc, {show}) => {
    const newAcc = acc < show.title.length ? show.title.length : acc;
    return newAcc;
  }, 0);

  console.log({longest})
  auditedShows.forEach(({ show, releasedSeasons }) => {
    console.log(`Show: ${chalk.whiteBright.bold((show.title + ",").padEnd(longest+1, ' '))} Seasons on Plex: ${chalk.whiteBright.bgRedBright.bold(show.seasons.length)}, Actual Seasons: ${chalk.whiteBright.bgRedBright.bold(releasedSeasons)}`);
  });
}());
