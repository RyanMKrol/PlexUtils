#!/usr/bin/env node

import util from 'util';
import { fetchRawPlexMovieLibraryData, fetchRawPlexTelevisionLibraryData } from '../remote';
import 'dotenv/config';

(async function main() {
  const plexMovieLibrary = await fetchRawPlexMovieLibraryData();
  const plexTelevisionLibrary = await fetchRawPlexTelevisionLibraryData();

  console.log(util.inspect(plexTelevisionLibrary, { depth: null, colors: true }));
  console.log(util.inspect(plexMovieLibrary, { depth: null, colors: true }));
}());
