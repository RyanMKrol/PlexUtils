#!/usr/bin/env node

import { fetchRawPlexMovieLibraryData } from '../remote';
import 'dotenv/config';

(async function main() {
  const plexMovieLibrary = await fetchRawPlexMovieLibraryData();

  const filmsWithHighAudienceRating = plexMovieLibrary.filter((film) => film.audienceRating > 8);
  const filmsIn4k = filmsWithHighAudienceRating.filter((film) => film.resolution === '4k');
  const filmsIn1080 = filmsWithHighAudienceRating.filter((film) => film.resolution === '1080');

  /**
   * Films in another resolution
   */
  const filmsInOtherResolution = filmsWithHighAudienceRating
    .filter((film) => !filmsIn4k.includes(film) && !filmsIn1080.includes(film));

  console.log('Films not in 4k or 1080p:');
  filmsInOtherResolution.forEach((film) => {
    console.log(` - ${film.title}`);
  });

  /**
   * 1080p films in a low bitrate
   */
  const desired1080pBitrate = 15000;
  const filmsIn1080WithLowBitrate = filmsIn1080
    .filter((film) => film.bitrate < desired1080pBitrate)
    .sort((a, b) => a.bitrate - b.bitrate);

  console.log(`Films in 1080p with a low bitrate < ${desired1080pBitrate}:`);
  filmsIn1080WithLowBitrate.forEach((film) => {
    console.log(` - ${film.title}, ${film.bitrate}`);
  });

  /**
   * 4k films in a low bitrate
   */
  const desired4kBitrate = 20000;
  const filmsIn4kWithLowBitrate = filmsIn4k
    .filter((film) => film.bitrate < desired4kBitrate)
    .sort((a, b) => a.bitrate - b.bitrate);

  console.log(`Films in 4k with a low bitrate < ${desired4kBitrate}:`);
  filmsIn4kWithLowBitrate.forEach((film) => {
    console.log(` - ${film.title}, ${film.bitrate}`);
  });
}());
