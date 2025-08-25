/**
 * Find the most common value in an array
 * @param {Array} values - Array of values
 * @returns {*} Most common value
 */
export function getMostCommonValue(values) {
  const counts = {};
  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)[0]?.[0];
}

/**
 * Format bitrate from bps to human-readable format
 * @param {string} bitrate - Bitrate string like "1234567 bps"
 * @returns {string} Formatted bitrate like "1235 kbps" or "Unknown"
 */
export function formatBitrate(bitrate) {
  if (!bitrate || bitrate === 'Unknown') return 'Unknown';
  
  const numericBitrate = parseInt(bitrate.replace(' bps', ''));
  if (isNaN(numericBitrate)) return 'Unknown';
  
  return `${Math.round(numericBitrate / 1000)} kbps`;
}

/**
 * Check if a resolution is not 1080 or 4k
 * @param {string} resolution - Resolution string (e.g., "1080", "4k", "720", "480")
 * @returns {boolean} True if resolution is not 1080 or 4k
 */
export function isNotHighQuality(resolution) {
  if (!resolution || resolution === 'Unknown') return true;
  
  // Check for exact values: "1080" or "4k"
  const normalizedResolution = resolution.toLowerCase().trim();
  
  return normalizedResolution !== '1080' && normalizedResolution !== '4k';
}