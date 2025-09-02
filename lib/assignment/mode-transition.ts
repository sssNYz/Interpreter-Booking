import prisma from "@/prisma/prisma";
import { PoolStatus } from "@prisma/client";
import type { AssignmentPolicy } from "@/types/assignment";
import { loadPolicy, updatePolicy } from "./policy";
import { bookingPool, type EnhancedPoolEntry } from "./pool";
import { getAssignmentLogger } from "./logging";

// Mode transition result interfaces
export interface ModeTransitionResult {
  success: boolean;
  oldMode: AssignmentPolicy['mode'];
  newMode: AssignmentPolicy['mode'];
  pooledBookingsAffected: number;
  immediateAssignments: number;
  poolTransition: PoolTransitionResult;
  errors: TransitionError[];
  transitionTime: Date;
  userFeedback: UserFeedback;
}

export interface PoolTransitionResult {
  processedEntries: number;
  immediateAssignments: number;
  remainingInPool: number;
  escalatedEntries: number;
  processingDetails: PoolTransitionDetail[];
  deadlineUpdates: number;
  statusChanges: number;
}

export interface PoolTransitionDetail {
  bookingId: number;
  action: 'immediate_assignment' | 'deadline_updated' | 'status_changed' | 'remained_pooled' | 'escalated';
  oldDeadline?: Date;
  newDeadline?: Date;
  oldStatus?: PoolStatus;
  newStatus?: PoolStatus;
  reason: string;
  processingTime: number;
}

export interface TransitionError {
  bookingId?: number;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface UserFeedback {
  summary: string;
  impactedBookings: Array<{
    bookingId: number;
    meetingType: string;
    startTime: Date;
    impact: string;
    action: string;
  }>;
  recommendations: string[];
  warnings: string[];
}

/**
 * Mode Transition Manager - handles switching between assignment modes with database pool handling
 */
export class ModeTransitionManager {
  private logger = getAssignmentLogger();

  /**
   * Switch assignment mode and handle existing pooled bookings
   */
  async switchMode(newMode: AssignmentPolicy['mode']): Promise<ModeTransitionResult> {
    const transitionStartTime = new Date();
    console.log(`🔄 Starting mode transition to ${newMode}...`);

    try {
      // Load current policy
      const currentPolicy = await loadPolicy();
      const oldMode = currentPolicy.mode;

      if (oldMode === newMode) {
        console.log(`ℹ️ Mode is already ${newMode}, no transition needed`);
        return {
          success: true,
          oldMode,
          newMode,
          pooledBookingsAffected: 0,
          immediateAssignments: 0,
          poolTransition: {
            processedEntries: 0,
            immediateAssignments: 0,
            remainingInPool: 0,
            escalatedEntries: 0,
            processingDetails: [],
            deadlineUpdates: 0,
            statusChanges: 0
          },
          errors: [],
          transitionTime: transitionStartTime,
          userFeedback: {
            summary: `Mode is already set to ${newMode}`,
            impactedBookings: [],
            recommendations: [],
            warnings: []
          }
        };
      }

      // Validate mode switch
      const validation = await this.validateModeSwitch(newMode);
      if (!validation.isValid) {
        throw new Error(`Mode switch validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for active pool processing
      const activeProcessingCheck = await this.checkActivePoolProcessing();
      if (activeProcessingCheck.hasActiveProcessing) {
        console.log(`⚠️ Active pool processing detected, handling gracefully...`);
        await this.handleActiveProcessingTransition(activeProcessingCheck.processingBookings);
      }

      // Handle pooled bookings transition
      const poolTransition = await this.handlePooledBookingsOnSwitch(newMode, oldMode);

      // Update the policy mode
      await updatePolicy({ mode: newMode });

      // Generate user feedback
      const userFeedback = await this.generateUserFeedback(oldMode, newMode, poolTransition);

      const result: ModeTransitionResult = {
        success: true,
        oldMode,
        newMode,
        pooledBookingsAffected: poolTransition.processedEntries,
        immediateAssignments: poolTransition.immediateAssignments,
        poolTransition,
        errors: [],
        transitionTime: transitionStartTime,
        userFeedback
      };

      console.log(`✅ Mode transition completed: ${oldMode} → ${newMode}`);
      console.log(`   📊 Affected bookings: ${poolTransition.processedEntries}`);
      console.log(`   ⚡ Immediate assignments: ${poolTransition.immediateAssignments}`);
      console.log(`   📥 Remaining in pool: ${poolTransition.remainingInPool}`);

      // Log the mode transition
      await this.logModeTransition(result);

      return result;

    } catch (error) {
      console.error(`❌ Mode transition failed:`, error);
      
      const errorResult: ModeTransitionResult = {
        success: false,
        oldMode: (await loadPolicy()).mode,
        newMode,
        pooledBookingsAffected: 0,
        immediateAssignments: 0,
        poolTransition: {
          processedEntries: 0,
          immediateAssignments: 0,
          remainingInPool: 0,
          escalatedEntries: 0,
          processingDetails: [],
          deadlineUpdates: 0,
          statusChanges: 0
        },
        errors: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          recoverable: false
        }],
        transitionTime: transitionStartTime,
        userFeedback: {
          summary: `Mode transition to ${newMode} failed`,
          impactedBookings: [],
          recommendations: ['Please try again or contact system administrator'],
          warnings: ['Mode transition was not completed']
        }
      };

      await this.logModeTransition(errorResult);
      return errorResult;
    }
  }

  /**
   * Handle pooled bookings when switching modes
   */
  async handlePooledBookingsOnSwitch(
    newMode: AssignmentPolicy['mode'],
    oldMode: AssignmentPolicy['mode']
  ): Promise<PoolTransitionResult> {
    console.log(`🔄 Handling pooled bookings transition: ${oldMode} → ${newMode}`);

    const processingDetails: PoolTransitionDetail[] = [];
    let immediateAssignments = 0;
    let deadlineUpdates = 0;
    let statusChanges = 0;
    let escalatedEntries = 0;

    try {
      // Get all current pooled bookings from database
      const pooledBookings = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: {
            not: null
          }
        },
        orderBy: {
          poolDeadlineTime: 'asc'
        }
      });

      console.log(`📊 Found ${pooledBookings.length} pooled bookings to process`);

      if (pooledBookings.length === 0) {
        return {
          processedEntries: 0,
          immediateAssignments: 0,
          remainingInPool: 0,
          escalatedEntries: 0,
          processingDetails: [],
          deadlineUpdates: 0,
          statusChanges: 0
        };
      }

      // Process each pooled booking based on mode transition
      for (const booking of pooledBookings) {
        const detailStartTime = Date.now();
        
        try {
          const transitionDetail = await this.processBookingModeTransition(
            booking,
            newMode,
            oldMode
          );

          processingDetails.push({
            ...transitionDetail,
            processingTime: Date.now() - detailStartTime
          });

          // Update counters
          switch (transitionDetail.action) {
            case 'immediate_assignment':
              immediateAssignments++;
              break;
            case 'deadline_updated':
              deadlineUpdates++;
              break;
            case 'status_changed':
              statusChanges++;
              break;
            case 'escalated':
              escalatedEntries++;
              break;
          }

        } catch (error) {
          console.error(`❌ Failed to process booking ${booking.bookingId} in mode transition:`, error);
          
          processingDetails.push({
            bookingId: booking.bookingId,
            action: 'escalated',
            reason: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            processingTime: Date.now() - detailStartTime
          });
          
          escalatedEntries++;
        }
      }

      // Count remaining pooled bookings
      const remainingInPool = await prisma.bookingPlan.count({
        where: {
          poolStatus: {
            not: null
          }
        }
      });

      return {
        processedEntries: pooledBookings.length,
        immediateAssignments,
        remainingInPool,
        escalatedEntries,
        processingDetails,
        deadlineUpdates,
        statusChanges
      };

    } catch (error) {
      console.error(`❌ Error handling pooled bookings transition:`, error);
      throw error;
    }
  }

  /**
   *