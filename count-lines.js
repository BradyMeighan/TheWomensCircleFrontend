import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File extensions to include in the count
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.json', '.md', '.toml'
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'dev-dist',
  '.git',
  '.vscode',
  '.idea'
];

// Files to exclude
const EXCLUDE_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

function shouldExcludeDir(dirName) {
  return EXCLUDE_DIRS.includes(dirName) || dirName.startsWith('.');
}

function shouldExcludeFile(fileName) {
  return EXCLUDE_FILES.includes(fileName) || fileName.startsWith('.');
}

function isCodeFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}

function countLinesInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return {
      totalLines: lines.length,
      nonEmptyLines: lines.filter(line => line.trim().length > 0).length,
      codeLines: lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('*/');
      }).length
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return { totalLines: 0, nonEmptyLines: 0, codeLines: 0 };
  }
}

function scanDirectory(dirPath, results = { files: 0, totalLines: 0, nonEmptyLines: 0, codeLines: 0, byExtension: {} }) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludeDir(item)) {
          scanDirectory(fullPath, results);
        }
      } else if (stat.isFile()) {
        if (!shouldExcludeFile(item) && isCodeFile(item)) {
          const ext = path.extname(item).toLowerCase();
          const lineCount = countLinesInFile(fullPath);
          
          results.files++;
          results.totalLines += lineCount.totalLines;
          results.nonEmptyLines += lineCount.nonEmptyLines;
          results.codeLines += lineCount.codeLines;
          
          if (!results.byExtension[ext]) {
            results.byExtension[ext] = { files: 0, totalLines: 0, nonEmptyLines: 0, codeLines: 0 };
          }
          
          results.byExtension[ext].files++;
          results.byExtension[ext].totalLines += lineCount.totalLines;
          results.byExtension[ext].nonEmptyLines += lineCount.nonEmptyLines;
          results.byExtension[ext].codeLines += lineCount.codeLines;
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }
  
  return results;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function main() {
  console.log('🔍 Counting lines of code in The Woman\'s Circle project...\n');
  
  const startTime = Date.now();
  const results = scanDirectory('.');
  const endTime = Date.now();
  
  console.log('📊 RESULTS:');
  console.log('='.repeat(50));
  console.log(`📁 Total files analyzed: ${formatNumber(results.files)}`);
  console.log(`📝 Total lines: ${formatNumber(results.totalLines)}`);
  console.log(`📄 Non-empty lines: ${formatNumber(results.nonEmptyLines)}`);
  console.log(`💻 Code lines (excluding comments): ${formatNumber(results.codeLines)}`);
  console.log(`⏱️  Scan completed in: ${endTime - startTime}ms`);
  
  console.log('\n📋 BREAKDOWN BY FILE TYPE:');
  console.log('-'.repeat(50));
  
  // Sort extensions by total lines
  const sortedExtensions = Object.entries(results.byExtension)
    .sort(([,a], [,b]) => b.totalLines - a.totalLines);
  
  for (const [ext, stats] of sortedExtensions) {
    const extName = ext || '(no extension)';
    console.log(`${extName.padEnd(10)} | Files: ${stats.files.toString().padStart(4)} | Total: ${formatNumber(stats.totalLines).padStart(8)} | Code: ${formatNumber(stats.codeLines).padStart(8)}`);
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('-'.repeat(50));
  console.log(`This project contains ${formatNumber(results.files)} code files`);
  console.log(`with a total of ${formatNumber(results.totalLines)} lines`);
  console.log(`(${formatNumber(results.codeLines)} lines of actual code)`);
  
  // Calculate some interesting metrics
  const avgLinesPerFile = results.files > 0 ? (results.totalLines / results.files).toFixed(1) : 0;
  const codePercentage = results.totalLines > 0 ? ((results.codeLines / results.totalLines) * 100).toFixed(1) : 0;
  
  console.log(`\n📈 METRICS:`);
  console.log(`Average lines per file: ${avgLinesPerFile}`);
  console.log(`Code percentage: ${codePercentage}%`);
}

// Run the script
main();
