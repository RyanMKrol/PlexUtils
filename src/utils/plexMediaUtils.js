import util from 'util';

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
  const mediaArray = Array.isArray(media) ? media : [media];

  /**
   * If we have multiple media items with a bitrate property, that
   * suggests we have duplicate media, and need to clear them up!
   */
  const mediaItemsWithBitrate = mediaArray.filter((item) => typeof item['@_bitrate'] !== 'undefined');
  if (mediaItemsWithBitrate.length > 1) {
    throw new Error(
      `More than one complete media exists, clean up your duplicates!\n
    ${util.inspect(mediaItemsWithBitrate, { depth: null, colors: true })}`,
    );
  }

  const sizeMb = mediaItemsWithBitrate[0].Part['@_size'] / 1000000;

  // rounds number to 2dp
  return Math.round(sizeMb * 100) / 100;
}

export { getMediaBitrate, getMediaResolution, getMediaFileSizeMb };
