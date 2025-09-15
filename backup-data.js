const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function backupData() {
  try {
    console.log('Starting data backup...');
    
    // Backup ENHANCED_ASSIGNMENT_CONFIG
    const enhancedConfig = await prisma.$queryRaw`SELECT * FROM ENHANCED_ASSIGNMENT_CONFIG`;
    fs.writeFileSync('enhanced_assignment_config_backup.json', JSON.stringify(enhancedConfig, null, 2));
    console.log(`Backed up ${enhancedConfig.length} records from ENHANCED_ASSIGNMENT_CONFIG`);
    
    // Backup CONFIGURATION_CHANGE
    const configChange = await prisma.$queryRaw`SELECT * FROM CONFIGURATION_CHANGE`;
    fs.writeFileSync('configuration_change_backup.json', JSON.stringify(configChange, null, 2));
    console.log(`Backed up ${configChange.length} records from CONFIGURATION_CHANGE`);
    
    // Backup ENHANCED_ASSIGNMENT_LOG
    const enhancedLog = await prisma.$queryRaw`SELECT * FROM ENHANCED_ASSIGNMENT_LOG`;
    fs.writeFileSync('enhanced_assignment_log_backup.json', JSON.stringify(enhancedLog, null, 2));
    console.log(`Backed up ${enhancedLog.length} records from ENHANCED_ASSIGNMENT_LOG`);
    
    console.log('Backup completed successfully!');
  } catch (error) {
    console.error('Backup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backupData();