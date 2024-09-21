/**
 * Pulls the Media object from a plex video object
 * @param {object} video Plex Video object
 * @returns {object} The Media of the video
 */
function getMedia(video) {
  return video.Media;
}

/**
 * Pulls the title from a plex video object
 * @param {object} video Plex Video object
 * @returns {string} The title of the video
 */
function getTitle(video) {
  return video['@_title'];
}

/**
 * Pulls the grandparent node's title from a plex video object
 * @param {object} video Plex Video object
 * @returns {string} The grandparent node of the video object's title
 */
function getGrandparentTitle(video) {
  return video['@_grandparentTitle'];
}

/**
 * Pulls the parent node's title from a plex video object
 * @param {object} video Plex Video object
 * @returns {string} The parent node of the video object's title
 */
function getParentTitle(video) {
  return video['@_parentTitle'];
}

export {
  getMedia, getTitle, getGrandparentTitle, getParentTitle,
};
