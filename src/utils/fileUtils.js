import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Ensure the output directory exists
 * @param {string} dirPath - Directory path (default: 'out')
 */
export function ensureOutputDir(dirPath = 'out') {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write content to a file in the output directory
 * @param {string} filename - Name of the file
 * @param {string} content - Content to write
 * @param {string} dirPath - Directory path (default: 'out')
 * @returns {string} Full file path
 */
export function writeOutputFile(filename, content, dirPath = 'out') {
  ensureOutputDir(dirPath);
  const filePath = join(dirPath, filename);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Generate a timestamped filename
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension (default: 'txt')
 * @returns {string} Timestamped filename
 */
export function generateTimestampedFilename(prefix, extension = 'txt') {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${timestamp}.${extension}`;
}