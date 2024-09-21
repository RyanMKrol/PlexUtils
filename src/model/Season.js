/* eslint-disable no-underscore-dangle */

export default class Season {
  _title;

  _childrenUri;

  _episodes;

  constructor(showData) {
    this._title = showData['@_title'];
    this._childrenUri = showData['@_key'];
  }

  // Getter for title
  get title() {
    return this._title;
  }

  // Getter for childrenUri
  get childrenUri() {
    return this._childrenUri;
  }

  // Getter and Setter for childrenUri
  get episodes() {
    return this._episodes;
  }

  set episodes(newEpisodes) {
    this._episodes = newEpisodes;
  }
}
