/**
 * Clean show title by removing year appendages like "(2007)" or "(2020)"
 * @param {string} title - Original show title
 * @returns {string} Cleaned title without year appendages
 */
export function cleanShowTitle(title) {
  if (!title) return title;
  
  // Remove year patterns like (2007), (2020), etc. at the end of the title
  // This handles formats like "Benidorm (2007)" -> "Benidorm"
  return title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

/**
 * Extract filename without path and extension
 * @param {string} filename - Full filename with path
 * @returns {string} Base filename
 */
export function getBaseFilename(filename) {
  if (!filename || filename === 'Unknown') return '';
  
  // Get just the filename without path
  const baseName = filename.split('/').pop().split('\\').pop();
  
  // Remove file extension
  return baseName.replace(/\.[^.]+$/, '');
}

/**
 * Extract just the filename from a full path (with extension)
 * @param {string} filepath - Full file path
 * @returns {string} Filename with extension
 */
export function getFilenameFromPath(filepath) {
  if (!filepath) return '';
  return filepath.split('/').pop().split('\\').pop();
}

/**
 * Clean numbers from the end of a prefix
 * @param {string} prefix - Prefix to clean
 * @returns {string} Cleaned prefix
 */
export function cleanPrefixEpisodeNumbers(prefix) {
  if (!prefix) return '';
  
  // Remove any trailing numbers and common episode patterns
  const patterns = [
    /[eE]\d{1,2}$/,  // E0, E1, E01, E10, e0, e1, etc.
    /\d+$/           // Any trailing numbers
  ];
  
  let cleaned = prefix;
  patterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  return cleaned.trim();
}