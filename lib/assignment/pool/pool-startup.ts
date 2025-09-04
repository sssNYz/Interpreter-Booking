import { PoolMigrationManager } from './pool-migration';
import { bookingPool } from './pool';

/**
 * Pool startup initialization
 * Handles migration from memory-based pool to database-persistent pool
 */
export class PoolStartupManager {
  private static initialized = false;

  /**
   * Initialize the database-persistent pool system
   * This should be called once during application startup
   */
  static async initializePoolSystem(): Promise<void> {
    if (this.initialized) {
      console.log('ℹ️ Pool system already initialized, skipping');
      return;
    }

    console.log('🚀 Initializing database-persistent pool system...');

    try {
      // Step 1: Ensure database indexes exist
      await PoolMigrationManager.ensurePoolIndexes();

      // Step 2: Migrate any existing memory pool data
      // In a real scenario, you might have existing memory pool data to migrate
      // For now, we'll just run the migration to clean up any inconsistent states
      await PoolMigrationManager.migrateMemoryPoolToDatabase();

      // Step 3: Get initial pool status
      const migrationStatus = await PoolMigrationManager.getMigrationStatus();
      console.log('📊 Initial pool status after migration:');
      console.log(`  - Total entries: ${migrationStatus.totalPoolEntries}`);
      console.log(`  - Entries by status:`, migrationStatus.entriesByStatus);
      if (migrationStatus.oldestEntry) {
        console.log(`  - Oldest entry: ${migrationStatus.oldestEntry.toISOString()}`);
      }

      // Step 4: Validate pool system is working
      await this.validatePoolSystem();

      this.initialized = true;
      console.log('✅ Database-persistent pool system initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize pool system:', error);
      throw error;
    }
  }

  /**
   * Validate that the pool system is working correctly
   */
  private static async validatePoolSystem(): Promise<void> {
    console.log('🔍 Validating pool system functionality...');

    try {
      // Test basic pool operations
      const stats = await bookingPool.getPoolStats();
      console.log(`✅ Pool stats retrieved: ${stats.totalInPool} total entries`);

      const readyEntries = await bookingPool.getReadyForAssignment();
      console.log(`✅ Ready entries retrieved: ${readyEntries.length} ready for assignment`);

      const deadlineEntries = await bookingPool.getDeadlineEntries();
      console.log(`✅ Deadline entries retrieved: ${deadlineEntries.length} past deadline`);

      console.log('✅ Pool system validation completed successfully');

    } catch (error) {
      console.error('❌ Pool system validation failed:', error);
      throw error;
    }
  }

  /**
   * Get the current initialization status
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force re-initialization (for testing purposes)
   */
  static async forceReinitialize(): Promise<void> {
    this.initialized = false;
    await this.initializePoolSystem();
  }

  /**
   * Get comprehensive pool system status
   */
  static async getSystemStatus(): Promise<{
    initialized: boolean;
    migrationStatus: any;
    poolStats: any;
    systemHealth: 'healthy' | 'warning' | 'error';
    issues: string[];
  }> {
    const issues: string[] = [];
    let systemHealth: 'healthy' | 'warning' | 'error' = 'healthy';

    try {
      const migrationStatus = await PoolMigrationManager.getMigrationStatus();
      const poolStats = await bookingPool.getPoolStats();

      // Check for potential issues
      if (poolStats.failedEntries > 0) {
        issues.push(`${poolStats.failedEntries} failed pool entries need attention`);
        systemHealth = 'warning';
      }

      if (poolStats.currentlyProcessing > 10) {
        issues.push(`High number of processing entries (${poolStats.currentlyProcessing}) - possible stuck processes`);
        systemHealth = 'warning';
      }

      if (migrationStatus.averageProcessingAttempts > 2) {
        issues.push(`High average processing attempts (${migrationStatus.averageProcessingAttempts.toFixed(2)}) - possible system issues`);
        systemHealth = 'warning';
      }

      return {
        initialized: this.initialized,
        migrationStatus,
        poolStats,
        systemHealth,
        issues
      };

    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      return {
        initialized: this.initialized,
        migrationStatus: null,
        poolStats: null,
        systemHealth: 'error',
        issues: [`System status check failed: ${error.message}`]
      };
    }
  }
}

/**
 * Convenience function to initialize pool system
 * Can be called from application startup
 */
export async function initializePoolSystem(): Promise<void> {
  return PoolStartupManager.initializePoolSystem();
}

/**
 * Convenience function to get pool system status
 */
export async function getPoolSystemStatus(): Promise<any> {
  return PoolStartupManager.getSystemStatus();
}