#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all project.json files in libs/
const projectFiles = execSync('find libs -name "project.json" -type f', {
  encoding: 'utf8',
  cwd: __dirname,
})
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${projectFiles.length} libraries\n`);

let updated = 0;
let skipped = 0;

projectFiles.forEach((projectFile) => {
  const fullPath = path.join(__dirname, projectFile);
  const projectJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  // Skip if already has stylelint target
  if (projectJson.targets?.stylelint) {
    console.log(`⏭️  Skipped: ${projectJson.name} (already has stylelint)`);
    skipped++;
    return;
  }
  
  // Add stylelint targets
  if (!projectJson.targets) {
    projectJson.targets = {};
  }
  
  // Get the library path from project.json location
  const libPath = projectFile.replace('/project.json', '');
  
  projectJson.targets.stylelint = {
    executor: 'nx:run-commands',
    options: {
      command: `stylelint "${libPath}/**/*.scss" --allow-empty-input`,
    },
  };
  
  projectJson.targets['stylelint:fix'] = {
    executor: 'nx:run-commands',
    options: {
      command: `stylelint "${libPath}/**/*.scss" --fix --allow-empty-input`,
    },
  };
  
  // Write back
  fs.writeFileSync(fullPath, JSON.stringify(projectJson, null, 2) + '\n');
  
  console.log(`✅ Updated: ${projectJson.name}`);
  updated++;
});

console.log(`\n📊 Summary:`);
console.log(`  ✅ Updated: ${updated}`);
console.log(`  ⏭️  Skipped: ${skipped}`);
console.log(`  📦 Total: ${projectFiles.length}`);
console.log(`\n✨ Done! All libraries now have stylelint targets.`);
console.log(`\nRun: npx nx run-many --target=stylelint --all`);
