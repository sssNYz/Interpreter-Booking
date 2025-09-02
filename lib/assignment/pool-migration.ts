import prisma from "@/prisma/prisma";
import { PoolStatus } from "@prisma/client";

/**
 * Migration utility to handle transition from memory-based pool to database-persistent pool
 */
export class PoolMigrationManager {
  /**
   * Migrate any existing in-memory pool data to database
   * This is called during system startup to ensure data consistency
   */
  static async migrateMemoryPoolToDatabase(memoryPoolData?: Map<number, any>): Promise<void> {
    console.log('🔄 Starting pool migration from memory to database...');
    
    try {
      // If memory pool data is provided, migrate it
      if (memoryPoolData && memoryPoolData.size > 0) {
        console.log(`📦 Migrating ${memoryPoolData.size} entries from memory pool to database`);
        
        for (const [bookingId, poolEntry] of memoryPoolData.entries()) {
          await this.migratePoolEntry(bookingId, poolEntry);
        }
        
        console.log(`✅ Successfully migrated ${memoryPoolData.size} pool entries to database`);
      }
      
      // Clean up any inconsistent pool states
      await this.cleanupInconsistentPoolStates();
      
      // Validate pool data integrity
      await this.validatePoolDataIntegrity();
      
      console.log('✅ Pool migration completed successfully');
    } catch (error) {
      console.error('❌ Pool migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate a single pool entry from memory to database
   */
  private static async migratePoolEntry(bookingId: number, poolEntry: any): Promise<void> {
    try {
      // Check if booking exists in database
      const existingBooking = await prisma.bookingPlan.findUnique({
        where: { bookingId },
        select: { bookingId: true, poolStatus: true }
      });

      if (!existingBooking) {
        console.warn(`⚠️ Booking ${bookingId} not found in database, skipping migration`);
        return;
      }

      // Only migrate if not already in database pool
      if (existingBooking.poolStatus === null) {
        await prisma.bookingPlan.update({
          where: { bookingId },
          data: {
            poolStatus: PoolStatus.waiting,
            poolEntryTime: poolEntry.poolEntryTime || new Date(),
            poolDeadlineTime: poolEntry.deadlineTime || poolEntry.decisionWindowTime || new Date(),
            poolProcessingAttempts: 0
          }
        });

        console.log(`📥 Migrated booking ${bookingId} to database pool`);
      } else {
        console.log(`ℹ️ Booking ${bookingId} already in database pool, skipping`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate pool entry ${bookingId}:`, error);
      // Continue with other entries rather than failing the entire migration
    }
  }

  /**
   * Clean up any inconsistent pool states in the database
   */
  private static async cleanupInconsistentPoolStates(): Promise<void> {
    console.log('🧹 Cleaning up inconsistent pool states...');
    
    try {
      // Reset any processing entries that might be stuck (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const stuckProcessingResult = await prisma.bookingPlan.updateMany({
        where: {
          poolStatus: PoolStatus.processing,
          updatedAt: {
            lt: oneHourAgo
          }
        },
        data: {
          poolStatus: PoolStatus.waiting
        }
      });

      if (stuckProcessingResult.count > 0) {
        console.log(`🔄 Reset ${stuckProcessingResult.count} stuck processing entries`);
      }

      // Clean up pool entries for completed or cancelled bookings
      const cleanupResult = await prisma.bookingPlan.updateMany({
        where: {
          poolStatus: {
            not: null
          },
          bookingStatus: {
            in: ['approve', 'cancel', 'complet']
          }
        },
        data: {
          poolStatus: null,
          poolEntryTime: null,
          poolDeadlineTime: null,
          poolProcessingAttempts: 0
        }
      });

      if (cleanupResult.count > 0) {
        console.log(`🧹 Cleaned up ${cleanupResult.count} pool entries for completed/cancelled bookings`);
      }

    } catch (error) {
      console.error('❌ Failed to cleanup inconsistent pool states:', error);
      throw error;
    }
  }

  /**
   * Validate pool data integrity after migration
   */
  private static async validatePoolDataIntegrity(): Promise<void> {
    console.log('🔍 Validating pool data integrity...');
    
    try {
      // Check for pool entries without required fields
      const invalidEntries = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: {
            not: null
          },
          OR: [
            { poolEntryTime: null },
            { poolDeadlineTime: null }
          ]
        },
        select: { bookingId: true, poolStatus: true }
      });

      if (invalidEntries.length > 0) {
        console.warn(`⚠️ Found ${invalidEntries.length} pool entries with missing required fields`);
        
        // Fix invalid entries by setting default values
        for (const entry of invalidEntries) {
          await prisma.bookingPlan.update({
            where: { bookingId: entry.bookingId },
            data: {
              poolEntryTime: new Date(),
              poolDeadlineTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // Default to 1 day from now
            }
          });
        }
        
        console.log(`🔧 Fixed ${invalidEntries.length} invalid pool entries`);
      }

      // Get final pool statistics
      const poolStats = await prisma.bookingPlan.groupBy({
        by: ['poolStatus'],
        where: {
          poolStatus: {
            not: null
          }
        },
        _count: true
      });

      console.log('📊 Pool migration validation complete:');
      poolStats.forEach(stat => {
        console.log(`  - ${stat.poolStatus}: ${stat._count} entries`);
      });

    } catch (error) {
      console.error('❌ Failed to validate pool data integrity:', error);
      throw error;
    }
  }

  /**
   * Create database indexes for pool operations if they don't exist
   */
  static async ensurePoolIndexes(): Promise<void> {
    console.log('🔧 Ensuring pool database indexes exist...');
    
    const indexes = [
      { name: 'idx_pool_status', sql: 'CREATE INDEX idx_pool_status ON BOOKING_PLAN(POOL_STATUS)' },
      { name: 'idx_pool_deadline', sql: 'CREATE INDEX idx_pool_deadline ON BOOKING_PLAN(POOL_DEADLINE_TIME)' },
      { name: 'idx_pool_ready', sql: 'CREATE INDEX idx_pool_ready ON BOOKING_PLAN(POOL_STATUS, POOL_DEADLINE_TIME)' },
      { name: 'idx_pool_entry_time', sql: 'CREATE INDEX idx_pool_entry_time ON BOOKING_PLAN(POOL_ENTRY_TIME)' },
      { name: 'idx_pool_processing', sql: 'CREATE INDEX idx_pool_processing ON BOOKING_PLAN(POOL_STATUS, POOL_ENTRY_TIME)' }
    ];
    
    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(index.sql);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        if (error.message.includes('Duplicate key name')) {
          console.log(`ℹ️ Index ${index.name} already exists, skipping`);
        } else {
          console.error(`❌ Failed to create index ${index.name}:`, error.message);
          // Continue with other indexes rather than failing completely
        }
      }
    }
    
    console.log('✅ Pool database indexes ensured');
  }

  /**
   * Get migration status and statistics
   */
  static async getMigrationStatus(): Promise<{
    totalPoolEntries: number;
    entriesByStatus: Record<string, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    averageProcessingAttempts: number;
  }> {
    try {
      const totalPoolEntries = await prisma.bookingPlan.count({
        where: {
          poolStatus: {
            not: null
          }
        }
      });

      const entriesByStatus = await prisma.bookingPlan.groupBy({
        by: ['poolStatus'],
        where: {
          poolStatus: {
            not: null
          }
        },
        _count: true
      });

      const statusCounts: Record<string, number> = {};
      entriesByStatus.forEach(entry => {
        if (entry.poolStatus) {
          statusCounts[entry.poolStatus] = entry._count;
        }
      });

      const oldestEntry = await prisma.bookingPlan.findFirst({
        where: {
          poolStatus: {
            not: null
          }
        },
        orderBy: {
          poolEntryTime: 'asc'
        },
        select: {
          poolEntryTime: true
        }
      });

      const newestEntry = await prisma.bookingPlan.findFirst({
        where: {
          poolStatus: {
            not: null
          }
        },
        orderBy: {
          poolEntryTime: 'desc'
        },
        select: {
          poolEntryTime: true
        }
      });

      const avgAttempts = await prisma.bookingPlan.aggregate({
        where: {
          poolStatus: {
            not: null
          }
        },
        _avg: {
          poolProcessingAttempts: true
        }
      });

      return {
        totalPoolEntries,
        entriesByStatus: statusCounts,
        oldestEntry: oldestEntry?.poolEntryTime || null,
        newestEntry: newestEntry?.poolEntryTime || null,
        averageProcessingAttempts: avgAttempts._avg.poolProcessingAttempts || 0
      };
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      return {
        totalPoolEntries: 0,
        entriesByStatus: {},
        oldestEntry: null,
        newestEntry: null,
        averageProcessingAttempts: 0
      };
    }
  }
}