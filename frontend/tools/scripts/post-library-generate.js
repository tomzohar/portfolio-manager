#!/usr/bin/env node

/**
 * Post-library generation script
 * Automatically adds stylelint targets to newly generated libraries
 * 
 * Usage: Run automatically by NX after library generation
 */

const fs = require('fs');
const path = require('path');

function addStylelintToLibrary(projectJsonPath) {
  try {
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    
    // Skip if already has stylelint
    if (projectJson.targets?.stylelint) {
      console.log('  ⏭️  Stylelint already configured');
      return;
    }
    
    // Get project root from sourceRoot
    const projectRoot = projectJson.sourceRoot?.replace('/src', '') || '';
    
    if (!projectRoot) {
      console.log('  ⚠️  Could not determine project root');
      return;
    }
    
    // Add targets
    if (!projectJson.targets) {
      projectJson.targets = {};
    }
    
    projectJson.targets.stylelint = {
      executor: 'nx:run-commands',
      options: {
        command: `stylelint "${projectRoot}/**/*.scss" --allow-empty-input`,
      },
    };
    
    projectJson.targets['stylelint:fix'] = {
      executor: 'nx:run-commands',
      options: {
        command: `stylelint "${projectRoot}/**/*.scss" --fix --allow-empty-input`,
      },
    };
    
    // Write back
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2) + '\n');
    console.log('  ✅ Stylelint targets added');
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

// Get project.json path from command line argument
const projectJsonPath = process.argv[2];

if (!projectJsonPath) {
  console.error('Usage: node post-library-generate.js <path-to-project.json>');
  process.exit(1);
}

console.log(`\n📦 Adding stylelint to new library...`);
addStylelintToLibrary(projectJsonPath);
console.log('');

module.exports = { addStylelintToLibrary };
