#!/usr/bin/env node

/**
 * Initialize Meeting Type Priorities
 * 
 * This script creates default meeting type priorities in the database
 * if they don't already exist.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultPriorities = [
  { meetingType: 'DR', priorityValue: 5, urgentThresholdDays: 1, generalThresholdDays: 7 },
  { meetingType: 'VIP', priorityValue: 4, urgentThresholdDays: 2, generalThresholdDays: 14 },
  { meetingType: 'Weekly', priorityValue: 3, urgentThresholdDays: 3, generalThresholdDays: 30 },
  { meetingType: 'General', priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
  { meetingType: 'Augent', priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
  { meetingType: 'Other', priorityValue: 1, urgentThresholdDays: 5, generalThresholdDays: 45 }
];

async function initializeMeetingPriorities() {
  try {
    console.log('🚀 Initializing meeting type priorities...');
    
    // Check if priorities already exist
    const existingPriorities = await prisma.meetingTypePriority.findMany();
    
    if (existingPriorities.length > 0) {
      console.log(`✅ Found ${existingPriorities.length} existing priorities:`);
      existingPriorities.forEach(p => {
        console.log(`   - ${p.meetingType}: Priority ${p.priorityValue}, Urgent: ${p.urgentThresholdDays}d, General: ${p.generalThresholdDays}d`);
      });
      console.log('ℹ️  No action needed - priorities already exist');
      return;
    }
    
    console.log('📝 Creating default meeting type priorities...');
    
    for (const priority of defaultPriorities) {
      await prisma.meetingTypePriority.create({
        data: priority
      });
      console.log(`   ✅ Created ${priority.meetingType}: Priority ${priority.priorityValue}`);
    }
    
    console.log('🎉 Successfully initialized meeting type priorities!');
    
    // Verify creation
    const newPriorities = await prisma.meetingTypePriority.findMany({
      orderBy: { priorityValue: 'desc' }
    });
    
    console.log(`\n📊 Summary: Created ${newPriorities.length} meeting type priorities:`);
    newPriorities.forEach(p => {
      console.log(`   - ${p.meetingType}: Priority ${p.priorityValue}, Urgent: ${p.urgentThresholdDays}d, General: ${p.generalThresholdDays}d`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing meeting type priorities:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeMeetingPriorities();