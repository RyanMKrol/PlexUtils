#!/usr/bin/env node

import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a script and return a promise that resolves when it completes
 * @param {string} scriptPath - Path to the script to run
 * @param {string} scriptName - Display name for the script
 * @returns {Promise} Promise that resolves with success/failure
 */
function runScript(scriptPath, scriptName) {
  return new Promise((resolve) => {
    console.log(chalk.blue.bold(`\n🚀 Running ${scriptName}...`));
    console.log(chalk.gray('=' + '='.repeat(60)));
    
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ ${scriptName} completed successfully\n`));
        resolve({ success: true, name: scriptName });
      } else {
        console.log(chalk.red(`❌ ${scriptName} failed with code ${code}\n`));
        resolve({ success: false, name: scriptName, code });
      }
    });
    
    child.on('error', (error) => {
      console.log(chalk.red(`❌ ${scriptName} failed with error: ${error.message}\n`));
      resolve({ success: false, name: scriptName, error: error.message });
    });
  });
}

/**
 * Display final summary of all audit results
 * @param {Array} results - Array of script execution results
 */
function displaySummary(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(chalk.green.bold('\n🎯 Audit Summary:'));
  console.log(chalk.gray('=' + '='.repeat(60)));
  console.log(chalk.blue(`📊 Total Audits Run: ${results.length}`));
  console.log(chalk.green(`✅ Successful: ${successful.length}`));
  console.log(chalk.red(`❌ Failed: ${failed.length}\n`));
  
  if (successful.length > 0) {
    console.log(chalk.green.bold('Successful Audits:'));
    successful.forEach(result => {
      console.log(chalk.green(`  ✅ ${result.name}`));
    });
    console.log('');
  }
  
  if (failed.length > 0) {
    console.log(chalk.red.bold('Failed Audits:'));
    failed.forEach(result => {
      const errorInfo = result.code ? `(exit code: ${result.code})` : result.error ? `(${result.error})` : '';
      console.log(chalk.red(`  ❌ ${result.name} ${errorInfo}`));
    });
    console.log('');
  }
  
  if (failed.length === 0) {
    console.log(chalk.green.bold('🎉 All audits completed successfully!'));
  } else {
    console.log(chalk.yellow.bold('⚠️  Some audits failed. Check the output above for details.'));
  }
}

async function runAllAudits() {
  try {
    console.log(chalk.blue.bold('🔍 Running All Plex Library Audits...\n'));
    
    const startTime = Date.now();
    
    // Define all audit scripts to run
    const auditScripts = [
      {
        path: join(__dirname, 'auditTvEpisodeInconsistencies.js'),
        name: 'TV Episode Inconsistencies Audit'
      },
      {
        path: join(__dirname, 'auditMovieQuality.js'),
        name: 'Movie Quality Audit'
      }
    ];
    
    console.log(chalk.cyan(`📋 Scheduled ${auditScripts.length} audit scripts to run:\n`));
    auditScripts.forEach((script, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${script.name}`));
    });
    
    const results = [];
    
    // Run each audit script sequentially
    for (const script of auditScripts) {
      const result = await runScript(script.path, script.name);
      results.push(result);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(chalk.blue(`⚡ Total execution time: ${(totalTime / 1000).toFixed(2)} seconds`));
    
    displaySummary(results);
    
    // Exit with error code if any audits failed
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Error running audit scripts:'), error.message);
    process.exit(1);
  }
}

runAllAudits();