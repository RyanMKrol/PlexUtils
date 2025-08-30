#!/usr/bin/env node

import chalk from 'chalk';
import { buildTVLibraryMap } from '../utils/libraryProcessor.js';
import { getMostCommonValue } from '../utils/dataUtils.js';
import { getBaseFilename, getFilenameFromPath, cleanPrefixEpisodeNumbers } from '../utils/stringUtils.js';
import { writeOutputFile, generateTimestampedFilename } from '../utils/fileUtils.js';
import { filterIgnoredItems, presentAuditResults, getIgnoredItemCount } from '../utils/interactiveUtils.js';
import 'dotenv/config';


/**
 * Find the longest common prefix shared by at least half the filenames
 * @param {Array} strings - Array of strings
 * @returns {string} Longest common prefix shared by at least half the strings
 */
function findCommonPrefix(strings) {
  if (!strings || strings.length < 2) return '';
  
  const halfThreshold = Math.ceil(strings.length / 2);
  
  // Find the shortest string to limit our search
  const shortestString = strings.reduce((shortest, current) => 
    current.length < shortest.length ? current : shortest
  );
  
  let longestValidPrefix = '';
  
  // Start with length 1 and keep increasing until less than half share the prefix (max 10 chars)
  const maxPrefixLength = Math.min(shortestString.length, 10);
  for (let prefixLen = 1; prefixLen <= maxPrefixLength; prefixLen++) {
    const candidatePrefix = shortestString.substring(0, prefixLen);
    
    // Count how many strings share this prefix
    let matchCount = 0;
    for (let j = 0; j < strings.length; j++) {
      if (strings[j].startsWith(candidatePrefix)) {
        matchCount++;
      }
    }
    
    // If at least half share this prefix, it's valid
    if (matchCount >= halfThreshold) {
      longestValidPrefix = candidatePrefix;
    } else {
      // Less than half share it, so we've found our limit
      break;
    }
  }
  
  // Clean episode numbers from the end of the prefix
  return cleanPrefixEpisodeNumbers(longestValidPrefix);
}

/**
 * Find the longest common suffix shared by at least half the filenames
 * @param {Array} strings - Array of strings
 * @returns {string} Longest common suffix shared by at least half the strings
 */
function findCommonSuffix(strings) {
  if (!strings || strings.length < 2) return '';
  
  const halfThreshold = Math.ceil(strings.length / 2);
  
  // Find the shortest string to limit our search
  const shortestString = strings.reduce((shortest, current) => 
    current.length < shortest.length ? current : shortest
  );
  
  let longestValidSuffix = '';
  
  // Start with length 1 and keep increasing until less than half share the suffix (max 10 chars)
  const maxSuffixLength = Math.min(shortestString.length, 10);
  for (let suffixLen = 1; suffixLen <= maxSuffixLength; suffixLen++) {
    const candidateSuffix = shortestString.substring(shortestString.length - suffixLen);
    
    // Count how many strings share this suffix
    let matchCount = 0;
    for (let j = 0; j < strings.length; j++) {
      if (strings[j].endsWith(candidateSuffix)) {
        matchCount++;
      }
    }
    
    // If at least half share this suffix, it's valid
    if (matchCount >= halfThreshold) {
      longestValidSuffix = candidateSuffix;
    } else {
      // Less than half share it, so we've found our limit
      break;
    }
  }
  
  return longestValidSuffix.trim();
}

/**
 * Detect filename inconsistencies using prefix/suffix analysis
 * @param {Array} episodes - Array of episodes with filename info
 * @returns {Object} Analysis results
 */
function detectFilenameInconsistencies(episodes) {
  if (episodes.length < 2) return { outliers: [], commonPrefix: '', commonSuffix: '' };
  
  // Get base filenames without extensions (no episode pattern removal for prefix/suffix detection)
  const baseFilenames = episodes.map(ep => ({
    episode: ep,
    baseFilename: getBaseFilename(ep.filename)
  })).filter(item => item.baseFilename && item.baseFilename !== '');
  
  if (baseFilenames.length < 2) return { outliers: [], commonPrefix: '', commonSuffix: '' };
  
  // Find longest common prefix and suffix from actual filenames
  const filenames = baseFilenames.map(item => item.baseFilename);
  const commonPrefix = findCommonPrefix(filenames);
  const commonSuffix = findCommonSuffix(filenames);
  
  // Only consider prefix/suffix valid if length >= 2 characters
  const validPrefix = commonPrefix && commonPrefix.length >= 2 ? commonPrefix : '';
  const validSuffix = commonSuffix && commonSuffix.length >= 2 ? commonSuffix : '';
  
  // If no valid common prefix or suffix found, no inconsistencies to detect
  if (!validPrefix && !validSuffix) {
    return { outliers: [], commonPrefix: '', commonSuffix: '' };
  }
  
  // Find episodes that don't match the valid prefix/suffix
  const outliers = baseFilenames.filter(item => {
    const { baseFilename } = item;
    
    let matchesPrefix = true;
    let matchesSuffix = true;
    
    if (validPrefix) {
      matchesPrefix = baseFilename.startsWith(validPrefix);
    }
    
    if (validSuffix) {
      matchesSuffix = baseFilename.endsWith(validSuffix);
    }
    
    // Flag if it doesn't match the suffix (requirement 3)
    return !matchesSuffix || (validPrefix && !matchesPrefix);
  });
  
  return {
    outliers: outliers.map(item => item.episode),
    commonPrefix: validPrefix,
    commonSuffix: validSuffix,
    expectedPrefix: validPrefix,
    expectedSuffix: validSuffix
  };
}

/**
 * Analyze a season for quality abnormalities (within the season only)
 * @param {Object} season - Season object with episodes
 * @returns {Object} Analysis results
 */
function analyzeSeasonQuality(season) {
  const episodes = season.episodes.filter(ep => !ep.error);
  
  if (episodes.length <= 1) {
    // Can't detect abnormalities in seasons with 0 or 1 episodes
    return { hasAbnormalities: false, issues: [] };
  }
  
  // Extract resolution data for THIS SEASON ONLY
  const resolutions = episodes.map(ep => ep.resolution).filter(r => r !== 'Unknown');
  
  const issues = [];
  
  // Check resolution consistency WITHIN THIS SEASON
  if (resolutions.length > 1) {
    const mostCommonResolution = getMostCommonValue(resolutions);
    const resolutionOutliers = episodes.filter(ep => 
      ep.resolution !== 'Unknown' && 
      ep.resolution !== mostCommonResolution
    );
    
    // Only flag if there are actually different resolutions in this season
    if (resolutionOutliers.length > 0 && resolutionOutliers.length < episodes.length) {
      issues.push({
        type: 'resolution',
        expected: mostCommonResolution,
        outliers: resolutionOutliers.map(ep => ({
          episode: `Episode ${ep.index}: ${ep.title}`,
          actual: ep.resolution,
          filename: ep.filename
        }))
      });
    }
  }
  
  // Check filename consistency using prefix/suffix analysis WITHIN THIS SEASON
  const filenameAnalysis = detectFilenameInconsistencies(episodes);
  if (filenameAnalysis.outliers.length > 0) {
    issues.push({
      type: 'filenameConsistency',
      expectedPrefix: filenameAnalysis.expectedPrefix,
      expectedSuffix: filenameAnalysis.expectedSuffix,
      outliers: filenameAnalysis.outliers.map(ep => ({
        episode: `Episode ${ep.index}: ${ep.title}`,
        actual: getBaseFilename(ep.filename),
        filename: ep.filename
      }))
    });
  }
  
  return {
    hasAbnormalities: issues.length > 0,
    totalEpisodes: episodes.length,
    issues
  };
}

/**
 * Generate quality analysis report
 * @param {Array} results - Analysis results
 * @returns {string} Report content
 */
function generateQualityAnalysisReport(results) {
  const showsWithIssues = results.filter(result => result.hasAbnormalities);
  
  let output = `📊 TV EPISODE INCONSISTENCY AUDIT REPORT\n`;
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += `📺 Total Shows Analyzed: ${results.length}\n`;
  output += `⚠️  Shows with Inconsistencies: ${showsWithIssues.length}\n`;
  output += `✅ Shows without Issues: ${results.length - showsWithIssues.length}\n\n`;
  output += '='.repeat(100) + '\n\n';
  
  if (showsWithIssues.length === 0) {
    output += '🎉 No episode inconsistencies found in any shows!\n';
    return output;
  }
  
  showsWithIssues.forEach((show, index) => {
    output += `${index + 1}. ${show.title} (${show.year})\n`;
    
    show.seasonsWithIssues.forEach(season => {
      output += `   📁 ${season.title} - ${season.totalEpisodes} episodes\n`;
      
      // Show folder path once per season (extract from first outlier's filename)
      if (season.issues.length > 0 && season.issues[0].outliers.length > 0) {
        const firstFilename = season.issues[0].outliers[0].filename;
        const folderPath = firstFilename.substring(0, firstFilename.lastIndexOf('/'));
        output += `      📂 Path: ${folderPath}\n`;
      }
      
      season.issues.forEach(issue => {
        const typeEmoji = {
          resolution: '📐',
          filenameConsistency: '📂'
        }[issue.type] || '⚠️';
        
        const typeDisplayName = {
          resolution: 'RESOLUTION',
          filenameConsistency: 'FILENAME CONSISTENCY'
        }[issue.type] || issue.type.toUpperCase();
        
        output += `      ${typeEmoji} ${typeDisplayName} Inconsistency:\n`;
        
        if (issue.type === 'filenameConsistency') {
          const prefixInfo = issue.expectedPrefix ? `Prefix: "${issue.expectedPrefix}"` : 'No common prefix';
          const suffixInfo = issue.expectedSuffix ? `Suffix: "${issue.expectedSuffix}"` : 'No common suffix';
          output += `         Expected: ${prefixInfo}, ${suffixInfo}\n`;
        } else {
          output += `         Expected: ${issue.expected}${issue.tolerance ? ` (±${issue.tolerance})` : ''}\n`;
        }
        
        issue.outliers.forEach(outlier => {
          // Show only filename, not full path
          const filename = getFilenameFromPath(outlier.filename);
          
          if (issue.type === 'resolution') {
            output += `         🔸 ${outlier.episode}: ${outlier.actual}\n`;
            output += `            📁 ${filename}\n`;
          } else {
            output += `         📁 ${filename}\n`;
          }
        });
      });
    });
    
    output += '\n';
  });
  
  return output;
}

/**
 * Generate unique ID for a TV show issue
 * @param {Object} show - Show object with inconsistency issues
 * @returns {string} Unique identifier
 */
function getTvIssueId(show) {
  return `${show.title}:${show.year}`;
}

/**
 * Display a TV show issue to the user
 * @param {Object} show - Show object with inconsistency issues
 */
function displayTvIssue(show) {
  console.log(chalk.yellow.bold(`${show.title} (${show.year})`));
  console.log(chalk.gray(`📁 Seasons with Issues: ${show.seasonsWithIssues.length}`));
  
  show.seasonsWithIssues.forEach(season => {
    console.log(chalk.cyan(`   📁 ${season.title} - ${season.totalEpisodes} episodes`));
    
    // Show folder path once per season
    if (season.issues.length > 0 && season.issues[0].outliers.length > 0) {
      const firstFilename = season.issues[0].outliers[0].filename;
      const folderPath = firstFilename.substring(0, firstFilename.lastIndexOf('/'));
      console.log(chalk.gray(`      📂 Path: ${folderPath}`));
    }
    
    season.issues.forEach(issue => {
      const typeEmoji = {
        resolution: '📐',
        filenameConsistency: '📂'
      }[issue.type] || '⚠️';
      
      const typeDisplayName = {
        resolution: 'RESOLUTION',
        filenameConsistency: 'FILENAME CONSISTENCY'
      }[issue.type] || issue.type.toUpperCase();
      
      console.log(chalk.gray(`      ${typeEmoji} ${typeDisplayName} Inconsistency:`));
      
      if (issue.type === 'filenameConsistency') {
        const prefixInfo = issue.expectedPrefix ? `Prefix: "${issue.expectedPrefix}"` : 'No common prefix';
        const suffixInfo = issue.expectedSuffix ? `Suffix: "${issue.expectedSuffix}"` : 'No common suffix';
        console.log(chalk.gray(`         Expected: ${prefixInfo}, ${suffixInfo}`));
      } else {
        console.log(chalk.gray(`         Expected: ${issue.expected}${issue.tolerance ? ` (±${issue.tolerance})` : ''}`));
      }
      
      console.log(chalk.gray(`         Outliers: ${issue.outliers.length} episodes`));
      
      // Show first 2 outliers as examples
      issue.outliers.slice(0, 2).forEach(outlier => {
        const filename = getFilenameFromPath(outlier.filename);
        if (issue.type === 'resolution') {
          console.log(chalk.gray(`         🔸 ${outlier.episode}: ${outlier.actual} (${filename})`));
        } else {
          console.log(chalk.gray(`         📁 ${filename}`));
        }
      });
      
      if (issue.outliers.length > 2) {
        console.log(chalk.gray(`         ... and ${issue.outliers.length - 2} more`));
      }
    });
  });
}

async function auditTvEpisodeInconsistencies() {
  try {
    console.log(chalk.blue.bold('🔍 Auditing TV Library for Episode Inconsistencies...\n'));
    
    console.log(chalk.cyan('🔄 Fetching TV library data...'));
    const startTime = Date.now();
    const result = await buildTVLibraryMap(); // Limit to first 10 for testing
    const buildTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Found ${result.totalFound} TV series total, analyzing first ${result.processed} for testing`));
    console.log(chalk.green(`⚡ Data fetched in ${(buildTime / 1000).toFixed(2)} seconds\n`));
    
    console.log(chalk.cyan('🔄 Analyzing quality consistency...'));
    
    const analysisResults = result.data.map(show => {
      if (show.error) {
        return {
          title: show.title,
          year: show.year,
          hasAbnormalities: false,
          error: show.error,
          seasonsWithIssues: []
        };
      }
      
      const seasonsWithIssues = [];
      
      show.seasons.forEach(season => {
        if (season.error) return;
        
        const analysis = analyzeSeasonQuality(season);
        if (analysis.hasAbnormalities) {
          seasonsWithIssues.push({
            title: season.title,
            totalEpisodes: analysis.totalEpisodes,
            issues: analysis.issues
          });
        }
      });
      
      return {
        title: show.title,
        year: show.year,
        hasAbnormalities: seasonsWithIssues.length > 0,
        seasonsWithIssues,
        error: null
      };
    });
    
    console.log(chalk.green('✅ Analysis complete\n'));
    
    // Always generate complete audit report first
    const allShowsWithIssues = analysisResults.filter(result => result.hasAbnormalities);
    
    console.log(chalk.cyan('📝 Generating complete TV episode inconsistencies report...'));
    const completeReportContent = generateQualityAnalysisReport(allShowsWithIssues);
    const completeFilename = generateTimestampedFilename('tv-episode-inconsistencies-audit-complete');
    const completeFilePath = writeOutputFile(completeFilename, completeReportContent);
    
    console.log(chalk.green(`✅ Complete audit report saved to: ${chalk.bold(completeFilePath)}`));
    console.log(chalk.gray(`📄 Complete report contains ${allShowsWithIssues.length} shows with inconsistencies\n`));
    
    // Filter out previously ignored items
    const auditType = 'tv-inconsistencies';
    const showsWithIssues = filterIgnoredItems(auditType, allShowsWithIssues, getTvIssueId);
    
    const ignoredCount = getIgnoredItemCount(auditType);
    if (ignoredCount > 0) {
      console.log(chalk.gray(`📋 Found ${allShowsWithIssues.length} total shows with issues, ${ignoredCount} previously ignored, ${showsWithIssues.length} new/kept shows for interactive review\n`));
    } else {
      console.log(chalk.gray(`📋 Found ${showsWithIssues.length} shows with inconsistencies for interactive review\n`));
    }
    
    if (showsWithIssues.length === 0) {
      console.log(chalk.green('🎉 No TV episode inconsistencies to review interactively!'));
      if (ignoredCount > 0) {
        console.log(chalk.gray(`(${ignoredCount} shows are being ignored from interactive review)`));
      }
      return;
    }
    
    // Present items to user interactively
    console.log(chalk.blue.bold('🔍 Interactive TV Episode Inconsistency Review'));
    console.log(chalk.gray('Each show below has episodes with inconsistent quality or naming. Choose whether to keep or ignore each show from future reviews.\n'));
    
    const keptShows = await presentAuditResults(auditType, showsWithIssues, getTvIssueId, displayTvIssue);
    
    if (keptShows.length > 0) {
      console.log(chalk.cyan('\n📝 Generating actionable items report...'));
      const actionableReportContent = generateQualityAnalysisReport(keptShows);
      
      const actionableFilename = generateTimestampedFilename('tv-episode-inconsistencies-audit-actionable');
      const actionableFilePath = writeOutputFile(actionableFilename, actionableReportContent);
      
      console.log(chalk.green(`✅ Actionable items report saved to: ${chalk.bold(actionableFilePath)}`));
      console.log(chalk.gray(`📄 Actionable report contains ${keptShows.length} shows marked for attention`));
    } else {
      console.log(chalk.green('\n🎉 All TV episode inconsistencies have been addressed or ignored for future reviews!'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error during episode inconsistency audit:'), error.message);
    process.exit(1);
  }
}

auditTvEpisodeInconsistencies();