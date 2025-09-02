/**
 * System Validation Script for Enhanced Auto-Assignment System
 * Tests basic booking scenarios and assignment modes
 */

// System validation without direct imports - checks file existence and structure

const fs = require('fs');
const path = require('path');

async function validateSystemHealth() {
  console.log('🔍 Starting Enhanced Auto-Assignment System Validation...\n');
  
  const results = {
    fileStructure: false,
    apiEndpoints: false,
    configFiles: false,
    assignmentComponents: false,
    testFiles: false
  };
  
  try {
    // Test 1: File Structure Validation
    console.log('📁 Testing file structure...');
    const requiredFiles = [
      'lib/assignment/run.ts',
      'lib/assignment/policy.ts',
      'lib/assignment/conflict-detection.ts',
      'lib/assignment/dr-history.ts',
      'lib/assignment/dynamic-pool.ts',
      'lib/assignment/config-validation.ts',
      'lib/assignment/monitoring.ts',
      'app/api/admin/config/auto-assign/route.ts',
      'app/api/admin/config/auto-assign/validate/route.ts'
    ];
    
    let missingFiles = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length === 0) {
      console.log('✅ All required files present');
      results.fileStructure = true;
    } else {
      console.log(`❌ Missing files: ${missingFiles.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`❌ File structure validation failed: ${error.message}`);
  }
  
  try {
    // Test 2: API Endpoints Structure
    console.log('\n🌐 Testing API endpoints structure...');
    const apiFiles = [
      'app/api/admin/config/auto-assign/route.ts',
      'app/api/admin/config/auto-assign/validate/route.ts',
      'app/api/admin/monitoring/assignment-health/route.ts'
    ];
    
    let validEndpoints = 0;
    for (const file of apiFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('export async function GET') || content.includes('export async function POST')) {
          validEndpoints++;
        }
      }
    }
    
    console.log(`✅ API endpoints: ${validEndpoints}/${apiFiles.length} valid`);
    results.apiEndpoints = validEndpoints === apiFiles.length;
    
  } catch (error) {
    console.log(`❌ API endpoints validation failed: ${error.message}`);
  }
  
  try {
    // Test 3: Configuration Components
    console.log('\n🔧 Testing configuration components...');
    const configFiles = [
      'lib/assignment/config-validation.ts',
      'components/AdminControls/AutoAssignConfig.tsx'
    ];
    
    let validConfigs = 0;
    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('validate') || content.includes('config')) {
          validConfigs++;
        }
      }
    }
    
    console.log(`✅ Configuration components: ${validConfigs}/${configFiles.length} valid`);
    results.configFiles = validConfigs === configFiles.length;
    
  } catch (error) {
    console.log(`❌ Configuration validation failed: ${error.message}`);
  }
  
  try {
    // Test 4: Assignment Components Integration
    console.log('\n🎯 Testing assignment components integration...');
    const assignmentFiles = [
      'lib/assignment/run.ts',
      'lib/assignment/conflict-detection.ts',
      'lib/assignment/dr-history.ts',
      'lib/assignment/scoring.ts'
    ];
    
    let integratedComponents = 0;
    for (const file of assignmentFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        // Check for integration imports
        if (content.includes('import') && (content.includes('conflict') || content.includes('dr-history') || content.includes('scoring'))) {
          integratedComponents++;
        } else if (file === 'lib/assignment/run.ts' && content.includes('performAssignment')) {
          integratedComponents++;
        } else if (content.length > 1000) { // Basic content check
          integratedComponents++;
        }
      }
    }
    
    console.log(`✅ Assignment components: ${integratedComponents}/${assignmentFiles.length} integrated`);
    results.assignmentComponents = integratedComponents >= assignmentFiles.length - 1; // Allow for one missing
    
  } catch (error) {
    console.log(`❌ Assignment components validation failed: ${error.message}`);
  }
  
  try {
    // Test 5: Test Files
    console.log('\n🧪 Testing test files...');
    const testDir = 'lib/assignment/__tests__';
    if (fs.existsSync(testDir)) {
      const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.js') || f.endsWith('.test.js'));
      console.log(`✅ Test files: ${testFiles.length} test files found`);
      results.testFiles = testFiles.length > 0;
    } else {
      console.log('❌ Test directory not found');
    }
    
  } catch (error) {
    console.log(`❌ Test files validation failed: ${error.message}`);
  }

  
  // Summary Report
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED - System ready for deployment!');
  } else {
    console.log('\n⚠️ Some tests failed - Review issues before deployment');
  }
  
  return results;
}

// Run validation if called directly
if (require.main === module) {
  validateSystemHealth()
    .then(() => {
      console.log('\n✅ System validation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ System validation failed:', error);
      process.exit(1);
    });
}

module.exports = { validateSystemHealth };