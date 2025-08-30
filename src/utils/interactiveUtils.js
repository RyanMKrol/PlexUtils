import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

/**
 * Ensure the tmp directory exists
 */
function ensureTmpDir() {
  const tmpDir = join(process.cwd(), 'tmp');
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
}

/**
 * Get the file path for storing ignored items for a specific audit type
 * @param {string} auditType - Type of audit (e.g., 'movie-quality', 'tv-inconsistencies')
 * @returns {string} File path for ignored items
 */
function getIgnoreFilePath(auditType) {
  ensureTmpDir();
  return join(process.cwd(), 'tmp', `ignored-${auditType}.json`);
}

/**
 * Load ignored items for a specific audit type
 * @param {string} auditType - Type of audit
 * @returns {Set} Set of ignored item identifiers
 */
export function loadIgnoredItems(auditType) {
  const filePath = getIgnoreFilePath(auditType);
  if (!existsSync(filePath)) {
    return new Set();
  }
  
  try {
    const data = readFileSync(filePath, 'utf8');
    const ignoredArray = JSON.parse(data);
    return new Set(ignoredArray);
  } catch (error) {
    console.warn(`Warning: Could not load ignored items for ${auditType}:`, error.message);
    return new Set();
  }
}

/**
 * Save ignored items for a specific audit type
 * @param {string} auditType - Type of audit
 * @param {Set} ignoredItems - Set of ignored item identifiers
 */
export function saveIgnoredItems(auditType, ignoredItems) {
  const filePath = getIgnoreFilePath(auditType);
  const ignoredArray = Array.from(ignoredItems);
  
  try {
    writeFileSync(filePath, JSON.stringify(ignoredArray, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving ignored items for ${auditType}:`, error.message);
  }
}

/**
 * Add an item to the ignored list
 * @param {string} auditType - Type of audit
 * @param {string} itemId - Unique identifier for the item
 */
export function addIgnoredItem(auditType, itemId) {
  const ignored = loadIgnoredItems(auditType);
  ignored.add(itemId);
  saveIgnoredItems(auditType, ignored);
}

/**
 * Check if an item is ignored
 * @param {string} auditType - Type of audit
 * @param {string} itemId - Unique identifier for the item
 * @returns {boolean} True if item is ignored
 */
export function isItemIgnored(auditType, itemId) {
  const ignored = loadIgnoredItems(auditType);
  return ignored.has(itemId);
}

/**
 * Filter out ignored items from a list of audit results
 * @param {string} auditType - Type of audit
 * @param {Array} items - Array of items to filter
 * @param {Function} getItemId - Function to extract unique ID from each item
 * @returns {Array} Filtered array without ignored items
 */
export function filterIgnoredItems(auditType, items, getItemId) {
  const ignored = loadIgnoredItems(auditType);
  return items.filter(item => !ignored.has(getItemId(item)));
}

/**
 * Prompt user for yes/no input
 * @param {string} question - Question to ask the user
 * @returns {Promise<boolean>} True if user answered yes
 */
function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Present audit results to user interactively
 * @param {string} auditType - Type of audit
 * @param {Array} items - Array of items to present
 * @param {Function} getItemId - Function to extract unique ID from each item
 * @param {Function} displayItem - Function to display item details to user
 * @returns {Promise<Array>} Array of items that were not ignored
 */
export async function presentAuditResults(auditType, items, getItemId, displayItem) {
  if (items.length === 0) {
    return [];
  }
  
  console.log(`\n🔍 Found ${items.length} items for review.\n`);
  console.log('For each item, you can choose to:');
  console.log('  • (y) Keep this item - will be shown again in future audits');
  console.log('  • (n) Ignore this item - will not be shown in future audits\n');
  
  const keptItems = [];
  const ignored = loadIgnoredItems(auditType);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = getItemId(item);
    
    console.log(`\n=== Item ${i + 1} of ${items.length} ===`);
    displayItem(item);
    
    const shouldKeep = await askYesNo('Keep this item for action');
    
    if (shouldKeep) {
      keptItems.push(item);
    } else {
      ignored.add(itemId);
      console.log('✓ Item will be ignored in future audits');
    }
  }
  
  // Save the updated ignored items
  saveIgnoredItems(auditType, ignored);
  
  console.log(`\n📊 Summary: ${keptItems.length} items kept, ${items.length - keptItems.length} items ignored`);
  
  return keptItems;
}

/**
 * Get count of ignored items for an audit type
 * @param {string} auditType - Type of audit
 * @returns {number} Number of ignored items
 */
export function getIgnoredItemCount(auditType) {
  const ignored = loadIgnoredItems(auditType);
  return ignored.size;
}