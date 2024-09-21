/**
 * Pulls the bitrate from a plex media object
 * @param {object} media Plex Media object
 * @returns {string} The bitrate of the video
 */
function getMediaBitrate(media) {
  return Number.parseInt(media['@_bitrate'], 10);
}

/**
 * Pulls the resolution from a plex media object
 * @param {object} media Plex Media object
 * @returns {string} The resolution of the video
 */
function getMediaResolution(media) {
  return media['@_videoResolution'];
}

/**
 * Pulls the size of the media in Megabits
 * @param {object} media Plex Media object
 * @returns {number} The size of the file in Mb to 2 dp
 */
function getMediaFileSizeMb(media) {
  if (Array.isArray(media.Part)) {
    console.log('Media has mulitple parts, cannot determine filesize');
    return 0;
  }

  const sizeMb = media.Part['@_size'] / 1000000;

  // rounds number to 2dp
  return Math.round(sizeMb * 100) / 100;
}

export { getMediaBitrate, getMediaResolution, getMediaFileSizeMb };
