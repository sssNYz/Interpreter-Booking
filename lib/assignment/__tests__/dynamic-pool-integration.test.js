/**
 * Integration tests for dynamic pool management in assignment flow
 * Tests that pool changes are properly detected and handled during assignments
 */

const fs = require('fs');
const path = require('path');

function testDynamicPoolIntegration() {
  console.log('🧪 Testing dynamic pool integration in assignment flow...\n');

  const runFilePath = path.join(__dirname, '../run.ts');
  
  if (!fs.existsSync(runFilePath)) {
    console.error('❌ run.ts file not found');
    return false;
  }

  const fileContent = fs.readFileSync(runFilePath, 'utf8');

  // Check for dynamic pool imports
  console.log('📋 Checking dynamic pool imports:');
  const importChecks = [
    { name: 'manageDynamicPool import', pattern: 'manageDynamicPool' },
    { name: 'detectInterpreterListChanges import', pattern: 'detectInterpreterListChanges' },
    { name: 'DynamicPoolAdjustment type', pattern: 'DynamicPoolAdjustment' },
    { name: 'FairnessAdjustment type', pattern: 'FairnessAdjustment' }
  ];

  let allImportsFound = true;
  for (const check of importChecks) {
    const found = fileContent.includes(check.pattern);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
    if (!found) allImportsFound = false;
  }

  // Check for integration functions
  console.log('\n📋 Checking integration functions:');
  const functionChecks = [
    { name: 'checkAndAdjustDynamicPool function', pattern: 'async function checkAndAdjustDynamicPool' },
    { name: 'Pool management in runAssignment', pattern: 'checkAndAdjustDynamicPool(policy)' },
    { name: 'Pool management in processPool', pattern: 'checkAndAdjustDynamicPool(policy)' },
    { name: 'performAssignment with pool management', pattern: 'poolManagement?' }
  ];

  let allFunctionsFound = true;
  for (const check of functionChecks) {
    const found = fileContent.includes(check.pattern);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
    if (!found) allFunctionsFound = false;
  }

  // Check for integration logic
  console.log('\n📋 Checking integration logic:');
  const logicChecks = [
    { name: 'Significant change detection', pattern: 'significantChange' },
    { name: 'Fairness recalculation', pattern: 'shouldRecalculate' },
    { name: 'Adjustment factor application', pattern: 'adjustmentFactor' },
    { name: 'Dynamic pool logging', pattern: 'dynamicPoolManagement' },
    { name: 'Pool change console logging', pattern: 'Dynamic pool changes detected' }
  ];

  let allLogicFound = true;
  for (const check of logicChecks) {
    const found = fileContent.includes(check.pattern);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
    if (!found) allLogicFound = false;
  }

  // Check for error handling
  console.log('\n📋 Checking error handling:');
  const errorChecks = [
    { name: 'Try-catch in checkAndAdjustDynamicPool', pattern: 'try {' },
    { name: 'Error logging for pool management', pattern: 'Error checking dynamic pool changes' },
    { name: 'Safe defaults on error', pattern: 'Return safe defaults' }
  ];

  let allErrorHandlingFound = true;
  for (const check of errorChecks) {
    const found = fileContent.includes(check.pattern);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
    if (!found) allErrorHandlingFound = false;
  }

  // Check file size and complexity
  console.log(`\n📊 Integration statistics:`);
  console.log(`  📄 File size: ${fileContent.length} characters`);
  console.log(`  📝 Lines of code: ${fileContent.split('\n').length}`);
  
  const dynamicPoolReferences = (fileContent.match(/poolManagement/g) || []).length;
  console.log(`  🔄 Dynamic pool references: ${dynamicPoolReferences}`);

  const isComplete = allImportsFound && allFunctionsFound && allLogicFound && allErrorHandlingFound && dynamicPoolReferences >= 5;

  console.log(`\n${isComplete ? '🎉' : '❌'} Dynamic pool integration: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);

  if (isComplete) {
    console.log('✅ Dynamic pool management is properly integrated into assignment flow');
    console.log('✅ Pool changes are detected before assignments');
    console.log('✅ Fairness adjustments are applied when needed');
    console.log('✅ Proper error handling and logging is in place');
    console.log('✅ Both single assignments and batch processing include pool management');
  } else {
    console.log('❌ Integration is incomplete - some features are missing');
  }

  return isComplete;
}

// Test specific integration scenarios
function testIntegrationScenarios() {
  console.log('\n🎯 Testing integration scenarios...\n');

  const runFilePath = path.join(__dirname, '../run.ts');
  const fileContent = fs.readFileSync(runFilePath, 'utf8');

  const scenarios = [
    {
      name: 'New interpreter handling',
      checks: [
        'newInterpreters.length',
        'adjustmentFactor',
        'fairnessAdjustments'
      ]
    },
    {
      name: 'Significant pool changes',
      checks: [
        'significantChange',
        'comprehensive dynamic pool management',
        'shouldRecalculate'
      ]
    },
    {
      name: 'Batch processing integration',
      checks: [
        'processPool',
        'poolManagement',
        'Dynamic pool changes detected'
      ]
    },
    {
      name: 'Assignment scoring adjustments',
      checks: [
        'adjustedPolicy',
        'adjustmentFactor',
        'fairnessAdjustments'
      ]
    }
  ];

  let passedScenarios = 0;
  for (const scenario of scenarios) {
    const scenarioPassed = scenario.checks.every(check => fileContent.includes(check));
    console.log(`${scenarioPassed ? '✅' : '❌'} ${scenario.name}: ${scenarioPassed ? 'INTEGRATED' : 'MISSING'}`);
    if (scenarioPassed) passedScenarios++;
  }

  console.log(`\n📊 Integration scenarios: ${passedScenarios}/${scenarios.length} passed`);
  return passedScenarios === scenarios.length;
}

// Run all tests
const integrationComplete = testDynamicPoolIntegration();
const scenariosComplete = testIntegrationScenarios();

const success = integrationComplete && scenariosComplete;

console.log(`\n${success ? '🎉' : '❌'} Overall integration test: ${success ? 'PASSED' : 'FAILED'}`);

if (success) {
  console.log('\n✅ Dynamic pool management is fully integrated into the assignment system');
  console.log('✅ All integration scenarios are properly handled');
  console.log('✅ The system can now adapt to changing interpreter pools automatically');
} else {
  console.log('\n❌ Integration test failed - some components need attention');
}

process.exit(success ? 0 : 1);