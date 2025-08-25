/**
 * Check if a movie/show was released in the last N years
 * @param {string|number} year - Year the content was released
 * @param {number} yearsBack - Number of years back to consider as "recent" (default: 15)
 * @returns {boolean} True if content was released in the specified timeframe
 */
export function isRecentContent(year, yearsBack = 15) {
  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - yearsBack;
  const contentYear = parseInt(year);
  
  return !isNaN(contentYear) && contentYear >= cutoffYear;
}

/**
 * Check if a movie was released in the last 15 years
 * @param {string|number} year - Year the movie was released
 * @returns {boolean} True if movie was released in the last 15 years
 */
export function isRecentMovie(year) {
  return isRecentContent(year, 15);
}

/**
 * Get the current year
 * @returns {number} Current year
 */
export function getCurrentYear() {
  return new Date().getFullYear();
}

/**
 * Parse year from various formats
 * @param {string|number} yearInput - Year in various formats
 * @returns {number|null} Parsed year or null if invalid
 */
export function parseYear(yearInput) {
  if (!yearInput || yearInput === 'Unknown') return null;
  
  const year = parseInt(yearInput);
  if (isNaN(year)) return null;
  
  // Basic validation - should be a reasonable year
  if (year < 1900 || year > getCurrentYear() + 10) return null;
  
  return year;
}