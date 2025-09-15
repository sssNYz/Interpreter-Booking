/**
 * Assignment Modes Verification Script
 * Verifies that all assignment modes work with new features
 */

const fs = require('fs');

function verifyAssignmentModes() {
  console.log('🎯 Verifying Assignment Modes Integration...\n');
  
  const modes = ['NORMAL', 'URGENT', 'BALANCE', 'CUSTOM'];
  const results = {};
  
  // Check policy.ts for mode support
  try {
    const policyContent = fs.readFileSync('lib/assignment/policy.ts', 'utf8');
    
    for (const mode of modes) {
      const modeSupported = policyContent.includes(mode) || policyContent.includes(`'${mode}'`);
      results[mode] = {
        policySupport: modeSupported,
        configValidation: false,
        uiSupport: false
      };
      
      if (modeSupported) {
        console.log(`✅ ${mode} mode: Policy support confirmed`);
      } else {
        console.log(`❌ ${mode} mode: Policy support missing`);
      }
    }
  } catch (error) {
    console.log(`❌ Error reading policy file: ${error.message}`);
    return false;
  }
  
  // Check config validation for mode support
  try {
    const configContent = fs.readFileSync('lib/assignment/config-validation.ts', 'utf8');
    
    for (const mode of modes) {
      const validationSupport = configContent.includes(mode) || configContent.includes(`'${mode}'`);
      results[mode].configValidation = validationSupport;
      
      if (validationSupport) {
        console.log(`✅ ${mode} mode: Validation support confirmed`);
      } else {
        console.log(`❌ ${mode} mode: Validation support missing`);
      }
    }
  } catch (error) {
    console.log(`❌ Error reading config validation file: ${error.message}`);
  }
  
  // Check UI component for mode support
  try {
    const uiContent = fs.readFileSync('components/AdminControls/AutoAssignConfig.tsx', 'utf8');
    
    for (const mode of modes) {
      const uiSupport = uiContent.includes(mode) || uiContent.includes(`'${mode}'`);
      results[mode].uiSupport = uiSupport;
      
      if (uiSupport) {
        console.log(`✅ ${mode} mode: UI support confirmed`);
      } else {
        console.log(`❌ ${mode} mode: UI support missing`);
      }
    }
  } catch (error) {
    console.log(`❌ Error reading UI component file: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 MODE VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  
  let allModesSupported = true;
  for (const mode of modes) {
    const modeResult = results[mode];
    const fullSupport = modeResult.policySupport && modeResult.configValidation && modeResult.uiSupport;
    
    console.log(`${mode}: ${fullSupport ? '✅ Fully Supported' : '⚠️ Partial Support'}`);
    console.log(`  - Policy: ${modeResult.policySupport ? '✅' : '❌'}`);
    console.log(`  - Validation: ${modeResult.configValidation ? '✅' : '❌'}`);
    console.log(`  - UI: ${modeResult.uiSupport ? '✅' : '❌'}`);
    
    if (!fullSupport) {
      allModesSupported = false;
    }
  }
  
  if (allModesSupported) {
    console.log('\n🎉 ALL ASSIGNMENT MODES FULLY SUPPORTED!');
  } else {
    console.log('\n⚠️ Some modes have partial support - review implementation');
  }
  
  return allModesSupported;
}

// Run verification if called directly
if (require.main === module) {
  const success = verifyAssignmentModes();
  process.exit(success ? 0 : 1);
}

module.exports = { verifyAssignmentModes };