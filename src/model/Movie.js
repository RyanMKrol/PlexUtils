/* eslint-disable no-underscore-dangle */

import { getMediaBitrate, getMediaResolution, getMediaFileSizeMb } from '../utils/plexMediaUtils';

export default class Movie {
  _title;

  _bitrate;

  _resolution;

  _fileSizeMb;

  _audienceRating;

  constructor(showData) {
    this._title = showData['@_title'];
    this._bitrate = getMediaBitrate(showData.Media);
    this._resolution = getMediaResolution(showData.Media);
    this._fileSizeMb = getMediaFileSizeMb(showData.Media);
    this._audienceRating = parseFloat(showData['@_audienceRating']);
  }

  // Getter for title
  get title() {
    return this._title;
  }

  // Getter for bitrate
  get bitrate() {
    return this._bitrate;
  }

  // Getter for resolution
  get resolution() {
    return this._resolution;
  }

  // Getter for fileSizeMb
  get fileSizeMb() {
    return this._fileSizeMb;
  }

  // Getter for audienceRating
  get audienceRating() {
    return this._audienceRating;
  }
}
