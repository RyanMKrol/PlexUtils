/* eslint-disable no-underscore-dangle */

import { getMediaBitrate, getMediaResolution, getMediaFileSizeMb } from '../utils/plexMediaUtils';

export default class Episode {
  _episodeNumber;

  _bitrate;

  _resolution;

  _fileSizeMb;

  constructor(showData) {
    this._episodeNumber = `Episode ${showData['@_index']}`;
    this._bitrate = getMediaBitrate(showData.Media);
    this._resolution = getMediaResolution(showData.Media);
    this._fileSizeMb = getMediaFileSizeMb(showData.Media);
  }

  // Getter for title
  get episodeNumber() {
    return this._episodeNumber;
  }

  // Getter for title
  get bitrate() {
    return this._bitrate;
  }

  // Getter for title
  get resolution() {
    return this._resolution;
  }

  // Getter for title
  get fileSize() {
    return this._fileSizeMb;
  }
}
