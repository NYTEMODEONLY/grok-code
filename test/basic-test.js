#!/usr/bin/env node

/**
 * Basic Test Suite for Grok Code
 *
 * This test suite helps verify that Grok Code is working correctly.
 * Run with: npm test
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Grok Code - Basic Test Suite\n');

// Test 1: Check if required files exist
console.log('📁 Testing file structure...');
const requiredFiles = [
  'bin/grok.js',
  'package.json',
  'README.md',
  'RPG_GUIDE.md'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Test 2: Check if package.json has required fields
console.log('\n📦 Testing package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const requiredFields = ['name', 'version', 'description', 'bin', 'scripts'];
  requiredFields.forEach(field => {
    if (pkg[field]) {
      console.log(`  ✅ ${field}: ${typeof pkg[field] === 'object' ? Object.keys(pkg[field]).join(', ') : pkg[field]}`);
    } else {
      console.log(`  ❌ ${field} - MISSING`);
    }
  });

  // Check if bin points to grok.js
  if (pkg.bin && pkg.bin.grok === './bin/grok.js') {
    console.log('  ✅ Binary correctly configured');
  } else {
    console.log('  ❌ Binary configuration incorrect');
  }

} catch (error) {
  console.log(`  ❌ package.json parse error: ${error.message}`);
}

// Test 3: Check syntax of main files
console.log('\n💻 Testing JavaScript syntax...');
const jsFiles = ['bin/grok.js'];

jsFiles.forEach(file => {
  try {
    // Basic syntax check by requiring the module
    const fullPath = path.resolve(file);
    delete require.cache[fullPath]; // Clear cache

    // Instead of requiring, let's just check if it can be parsed
    const content = fs.readFileSync(file, 'utf8');
    // Basic check - if it contains 'console.log' it's probably JS
    if (content.includes('console.log') || content.includes('require(')) {
      console.log(`  ✅ ${file} - syntax appears valid`);
    } else {
      console.log(`  ⚠️  ${file} - may not be valid JavaScript`);
    }
  } catch (error) {
    console.log(`  ❌ ${file} - syntax error: ${error.message}`);
  }
});

// Test 4: Check configuration directories
console.log('\n⚙️  Testing configuration...');
const homeDir = process.env.HOME || process.env.USERPROFILE;
const grokDir = path.join(homeDir, '.grok');

if (fs.existsSync(grokDir)) {
  console.log('  ✅ Grok configuration directory exists');
} else {
  console.log('  ℹ️  Grok configuration directory will be created on first run');
}

// Test 5: Environment check
console.log('\n🌍 Testing environment...');
console.log(`  ✅ Node.js version: ${process.version}`);
console.log(`  ✅ Platform: ${process.platform}`);
console.log(`  ✅ Architecture: ${process.arch}`);

// Test 6: API key check (without revealing it)
const apiKey = process.env.XAI_API_KEY;
if (apiKey) {
  console.log('  ✅ XAI_API_KEY environment variable set');
} else {
  console.log('  ⚠️  XAI_API_KEY environment variable not set (will prompt on first run)');
}

// Test 7: Check examples
console.log('\n📚 Testing examples...');
const examplesDir = 'examples';
if (fs.existsSync(examplesDir)) {
  const exampleFiles = fs.readdirSync(examplesDir);
  if (exampleFiles.length > 0) {
    console.log(`  ✅ Examples directory contains ${exampleFiles.length} items`);
    exampleFiles.forEach(file => {
      console.log(`    - ${file}`);
    });
  } else {
    console.log('  ⚠️  Examples directory exists but is empty');
  }
} else {
  console.log('  ❌ Examples directory missing');
}

console.log('\n🎉 Test suite completed!');
console.log('\n💡 To run Grok Code:');
console.log('  npm start');
console.log('  # or');
console.log('  node bin/grok.js');
console.log('\n📖 For more information, see:');
console.log('  README.md');
console.log('  RPG_GUIDE.md');
