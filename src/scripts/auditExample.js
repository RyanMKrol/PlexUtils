#!/usr/bin/env node

import util from 'util';
import fetchPlexInfo from '../remote/index.js';
import 'dotenv/config';

(async function main() {
  const data = await fetchPlexInfo();

  console.log(util.inspect(data, { depth: null, colors: true }));
}());
