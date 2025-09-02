/**
 * Verification script for Daily Pool Processor implementation
 * Checks if all required files and components are in place
 */

const fs = require('fs');
const path = require('path');

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✅' : '❌'} ${filePath}`);
  return exists;
}

function checkFileContains(filePath, searchText) {
  const fullPath = path.join(process.cwd(), filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const contains = content.includes(searchText);
    console.log(`${contains ? '✅' : '❌'} ${filePath} contains "${searchText}"`);
    return contains;
  } catch (error) {
    console.log(`❌ ${filePath} - Error reading file: ${error.message}`);
    return false;
  }
}

function verifyImplementation() {
  console.log('🔍 Verifying Daily Pool Processor Implementation...\n');

  let allGood = true;

  // Check core implementation files
  console.log('📁 Core Implementation Files:');
  allGood &= checkFileExists('lib/assignment/daily-pool-processor.ts');
  allGood &= checkFileExists('lib/assignment/server-startup.ts');
  allGood &= checkFileExists('lib/assignment/init.ts');

  // Check API endpoint
  console.log('\n🌐 API Endpoints:');
  allGood &= checkFileExists('app/api/admin/pool/daily-processor/route.ts');

  // Check UI component
  console.log('\n🎨 UI Components:');
  allGood &= checkFileExists('components/AdminControls/DailyPoolProcessorControl.tsx');

  // Check test scripts
  console.log('\n🧪 Test Scripts:');
  allGood &= checkFileExists('scripts/test-daily-pool-processor.js');
  allGood &= checkFileExists('scripts/test-daily-processor-api.js');

  // Check integration points
  console.log('\n🔗 Integration Points:');
  allGood &= checkFileContains('app/layout.tsx', '@/lib/assignment/init');
  allGood &= checkFileContains('lib/assignment/startup.ts', 'initializeDailyPoolProcessor');

  // Check key functionality in implementation
  console.log('\n⚙️ Key Functionality:');
  allGood &= checkFileContains('lib/assignment/daily-pool-processor.ts', 'class DailyPoolProcessor');
  allGood &= checkFileContains('lib/assignment/daily-pool-processor.ts', 'runDailyPoolCheck');
  allGood &= checkFileContains('lib/assignment/daily-pool-processor.ts', 'initializeDailyPoolProcessor');
  allGood &= checkFileContains('lib/assignment/server-startup.ts', 'class ServerStartupService');
  allGood &= checkFileContains('app/api/admin/pool/daily-processor/route.ts', 'processDailyPoolNow');

  // Summary
  console.log('\n📊 Implementation Summary:');
  if (allGood) {
    console.log('✅ All components are in place and properly integrated!');
    console.log('\n🚀 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. The daily pool processor will auto-initialize on server startup');
    console.log('3. Access the admin interface to monitor and control the processor');
    console.log('4. Use the API endpoint for programmatic control');
  } else {
    console.log('❌ Some components are missing or not properly integrated');
    console.log('Please check the failed items above');
  }

  return allGood;
}

// Run verification
if (require.main === module) {
  verifyImplementation();
}

module.exports = { verifyImplementation };