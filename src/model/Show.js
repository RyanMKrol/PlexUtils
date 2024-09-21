/* eslint-disable no-underscore-dangle */

export default class Show {
  _title;

  _childrenUri;

  _audienceRating;

  _seasons;

  constructor(showData) {
    this._title = showData['@_title'];
    this._childrenUri = showData['@_key'];
    this._audienceRating = parseFloat(showData['@_audienceRating']);
  }

  // Getter for title
  get title() {
    return this._title;
  }

  // Getter for childrenUri
  get childrenUri() {
    return this._childrenUri;
  }

  // Getter for audience rating
  get audienceRating() {
    return this._audienceRating;
  }

  // Getter and Setter for seasons
  get seasons() {
    return this._seasons;
  }

  set seasons(newSeasons) {
    this._seasons = newSeasons;
  }
}
