#!/usr/bin/env node

/**
 * Initialize Mode-Specific Threshold Values
 * 
 * This script creates mode-specific threshold configurations for different
 * assignment modes (Balance, Normal, Urgent) and meeting types.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mode-specific threshold configurations as specified
const modeSpecificThresholds = [
  // BALANCE mode
  { meetingType: 'DR', assignmentMode: 'BALANCE', urgentThresholdDays: 7, generalThresholdDays: 30 },
  { meetingType: 'VIP', assignmentMode: 'BALANCE', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'Augent', assignmentMode: 'BALANCE', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'Weekly', assignmentMode: 'BALANCE', urgentThresholdDays: 3, generalThresholdDays: 15 },
  { meetingType: 'General', assignmentMode: 'BALANCE', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'Other', assignmentMode: 'BALANCE', urgentThresholdDays: 3, generalThresholdDays: 7 },

  // NORMAL mode
  { meetingType: 'DR', assignmentMode: 'NORMAL', urgentThresholdDays: 10, generalThresholdDays: 30 },
  { meetingType: 'VIP', assignmentMode: 'NORMAL', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'Augent', assignmentMode: 'NORMAL', urgentThresholdDays: 10, generalThresholdDays: 15 },
  { meetingType: 'Weekly', assignmentMode: 'NORMAL', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'General', assignmentMode: 'NORMAL', urgentThresholdDays: 10, generalThresholdDays: 15 },
  { meetingType: 'Other', assignmentMode: 'NORMAL', urgentThresholdDays: 7, generalThresholdDays: 10 },

  // URGENT mode
  { meetingType: 'DR', assignmentMode: 'URGENT', urgentThresholdDays: 14, generalThresholdDays: 45 },
  { meetingType: 'VIP', assignmentMode: 'URGENT', urgentThresholdDays: 7, generalThresholdDays: 15 },
  { meetingType: 'Augent', assignmentMode: 'URGENT', urgentThresholdDays: 14, generalThresholdDays: 30 },
  { meetingType: 'Weekly', assignmentMode: 'URGENT', urgentThresholdDays: 14, generalThresholdDays: 30 },
  { meetingType: 'General', assignmentMode: 'URGENT', urgentThresholdDays: 14, generalThresholdDays: 30 },
  { meetingType: 'Other', assignmentMode: 'URGENT', urgentThresholdDays: 7, generalThresholdDays: 15 }
];

async function initializeModeSpecificThresholds() {
  try {
    console.log('🚀 Initializing mode-specific threshold configurations...');
    
    // Check if configurations already exist
    const existingThresholds = await prisma.meetingTypeModeThreshold.findMany();
    
    if (existingThresholds.length > 0) {
      console.log(`✅ Found ${existingThresholds.length} existing mode-specific thresholds:`);
      existingThresholds.forEach(t => {
        console.log(`   - ${t.meetingType} (${t.assignmentMode}): Urgent: ${t.urgentThresholdDays}d, General: ${t.generalThresholdDays}d`);
      });
      console.log('ℹ️  Updating existing configurations with new values...');
      
      // Update existing configurations
      for (const threshold of modeSpecificThresholds) {
        await prisma.meetingTypeModeThreshold.upsert({
          where: {
            meetingType_assignmentMode: {
              meetingType: threshold.meetingType,
              assignmentMode: threshold.assignmentMode
            }
          },
          update: {
            urgentThresholdDays: threshold.urgentThresholdDays,
            generalThresholdDays: threshold.generalThresholdDays
          },
          create: threshold
        });
        console.log(`   ✅ Updated ${threshold.meetingType} (${threshold.assignmentMode})`);
      }
    } else {
      console.log('📝 Creating mode-specific threshold configurations...');
      
      for (const threshold of modeSpecificThresholds) {
        await prisma.meetingTypeModeThreshold.create({
          data: threshold
        });
        console.log(`   ✅ Created ${threshold.meetingType} (${threshold.assignmentMode}): Urgent: ${threshold.urgentThresholdDays}d, General: ${threshold.generalThresholdDays}d`);
      }
    }
    
    console.log('🎉 Successfully initialized mode-specific threshold configurations!');
    
    // Verify creation/update
    const finalThresholds = await prisma.meetingTypeModeThreshold.findMany({
      orderBy: [
        { assignmentMode: 'asc' },
        { meetingType: 'asc' }
      ]
    });
    
    console.log(`\n📊 Summary: ${finalThresholds.length} mode-specific threshold configurations:`);
    
    // Group by mode for better display
    const groupedByMode = finalThresholds.reduce((acc, t) => {
      if (!acc[t.assignmentMode]) acc[t.assignmentMode] = [];
      acc[t.assignmentMode].push(t);
      return acc;
    }, {});
    
    Object.entries(groupedByMode).forEach(([mode, thresholds]) => {
      console.log(`\n   ${mode} Mode:`);
      thresholds.forEach(t => {
        console.log(`     - ${t.meetingType}: Urgent: ${t.urgentThresholdDays}d, General: ${t.generalThresholdDays}d`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error initializing mode-specific thresholds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeModeSpecificThresholds();