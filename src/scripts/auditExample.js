#!/usr/bin/env node
import { fetchRawPlexMovieLibraryData, fetchRawPlexTelevisionLibraryData } from '../remote';

import 'dotenv/config';

(async function main() {
  console.log('Auditing Duplicate Files...');

  const plexMovieLibrary = await fetchRawPlexMovieLibraryData();
  const plexTelevisionLibrary = await fetchRawPlexTelevisionLibraryData();

  console.log({ plexMovieLibrary, plexTelevisionLibrary });
}());
