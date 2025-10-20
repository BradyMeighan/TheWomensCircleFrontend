#!/usr/bin/env node

/**
 * Deployment Preparation Script
 * This script helps prepare the repository for Cloudflare Pages deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing repository for Cloudflare Pages deployment...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Check if backend folder exists (it shouldn't for frontend deployment)
if (fs.existsSync('backend')) {
  console.log('⚠️  Warning: backend folder detected. For Cloudflare Pages deployment, you should:');
  console.log('   1. Create a separate repository for frontend only');
  console.log('   2. Copy all files EXCEPT the backend folder');
  console.log('   3. Push to your GitHub repository\n');
}

// Verify required files exist
const requiredFiles = [
  '_headers',
  '_redirects',
  '.env.production',
  'vite.config.ts',
  'package.json'
];

console.log('📋 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Please ensure all files are present before deployment.');
  process.exit(1);
}

// Check package.json scripts
console.log('\n📦 Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.scripts && packageJson.scripts['build:production']) {
  console.log('✅ build:production script found');
} else {
  console.log('❌ build:production script missing');
}

// Check environment file
console.log('\n🔧 Checking environment configuration...');
if (fs.existsSync('.env.production')) {
  const envContent = fs.readFileSync('.env.production', 'utf8');
  if (envContent.includes('VITE_API_URL')) {
    console.log('✅ VITE_API_URL configured');
  } else {
    console.log('❌ VITE_API_URL not found in .env.production');
  }
}

// Test build
console.log('\n🔨 Testing production build...');
console.log('Run: npm run build:production');
console.log('This will verify your build works before deployment.\n');

// Final checklist
console.log('📝 Pre-deployment checklist:');
console.log('   □ Remove backend folder from repository');
console.log('   □ Commit all changes to GitHub');
console.log('   □ Test build locally: npm run build:production');
console.log('   □ Verify backend CORS allows your domain');
console.log('   □ Set up Cloudflare Pages project');
console.log('   □ Configure environment variables in Cloudflare');

console.log('\n🎉 Repository appears ready for Cloudflare Pages deployment!');
console.log('📖 See CLOUDFLARE_DEPLOYMENT_GUIDE.md for detailed instructions.');
