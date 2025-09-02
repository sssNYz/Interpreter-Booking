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
   * Process individual booking for mode transition
   */
  private async processBookingModeTransition(
    booking: any,
    newMode: AssignmentPolicy['mode'],
    oldMode: AssignmentPolicy['mode']
  ): Promise<PoolTransitionDetail> {
    const { getMeetingTypePriority } = await import('./policy');
    const priority = await getMeetingTypePriority(booking.meetingType);
    
    if (!priority) {
      return {
        bookingId: booking.bookingId,
        action: 'escalated',
        reason: `No priority configuration found for meeting type: ${booking.meetingType}`,
        processingTime: 0
      };
    }

    const now = new Date();
    const daysUntilMeeting = Math.floor((booking.timeStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Mode-specific transition logic
    switch (newMode) {
      case 'URGENT':
        return await this.handleUrgentModeTransition(booking, priority, daysUntilMeeting);
      
      case 'BALANCE':
        return await this.handleBalanceModeTransition(booking, priority, daysUntilMeeting, oldMode);
      
      case 'NORMAL':
      case 'CUSTOM':
        return await this.handleNormalModeTransition(booking, priority, daysUntilMeeting);
      
      default:
        return {
          bookingId: booking.bookingId,
          action: 'remained_pooled',
          reason: `Unknown mode: ${newMode}`,
          processingTime: 0
        };
    }
  }

  /**
   * Handle transition to Urgent mode - immediate processing of urgent entries
   */
  private async handleUrgentModeTransition(
    booking: any,
    priority: any,
    daysUntilMeeting: number
  ): Promise<PoolTransitionDetail> {
    const oldDeadline = booking.poolDeadlineTime;
    
    // In urgent mode, process immediately if within urgent threshold or very close
    const shouldProcessImmediately = daysUntilMeeting <= Math.max(priority.urgentThresholdDays, 1);
    
    if (shouldProcessImmediately) {
      // Update deadline to now for immediate processing
      const newDeadline = new Date();
      
      await prisma.bookingPlan.update({
        where: { bookingId: booking.bookingId },
        data: {
          poolStatus: PoolStatus.ready,
          poolDeadlineTime: newDeadline
        }
      });

      return {
        bookingId: booking.bookingId,
        action: 'immediate_assignment',
        oldDeadline,
        newDeadline,
        oldStatus: booking.poolStatus,
        newStatus: PoolStatus.ready,
        reason: `Urgent mode: booking within ${priority.urgentThresholdDays} days threshold, marked for immediate processing`
      };
    } else {
      // Update deadline to be more aggressive for urgent mode
      const newDeadline = new Date(booking.timeStart.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
      
      await prisma.bookingPlan.update({
        where: { bookingId: booking.bookingId },
        data: {
          poolDeadlineTime: newDeadline
        }
      });

      return {
        bookingId: booking.bookingId,
        action: 'deadline_updated',
        oldDeadline,
        newDeadline,
        reason: `Urgent mode: deadline moved earlier for faster processing`
      };
    }
  }

  /**
   * Handle transition to Balance mode - batch optimization
   */
  private async handleBalanceModeTransition(
    booking: any,
    priority: any,
    daysUntilMeeting: number,
    oldMode: AssignmentPolicy['mode']
  ): Promise<PoolTransitionDetail> {
    const oldDeadline = booking.poolDeadlineTime;
    
    // Check if booking is at deadline and needs immediate processing
    const isAtDeadline = daysUntilMeeting <= priority.urgentThresholdDays;
    
    if (isAtDeadline) {
      // Keep urgent bookings for immediate processing
      await prisma.bookingPlan.update({
        where: { bookingId: booking.bookingId },
        data: {
          poolStatus: PoolStatus.ready
        }
      });

      return {
        bookingId: booking.bookingId,
        action: 'immediate_assignment',
        oldStatus: booking.poolStatus,
        newStatus: PoolStatus.ready,
        reason: `Balance mode: booking at deadline (${daysUntilMeeting} days), marked for immediate processing`
      };
    } else {
      // For balance mode, extend deadline to allow for batch optimization
      const balanceThreshold = Math.max(priority.generalThresholdDays, 3);
      const newDeadline = new Date(booking.timeStart.getTime() - (priority.urgentThresholdDays + 1) * 24 * 60 * 60 * 1000);
      
      // Only update if the new deadline is different
      if (Math.abs(newDeadline.getTime() - oldDeadline.getTime()) > 60000) { // 1 minute tolerance
        await prisma.bookingPlan.update({
          where: { bookingId: booking.bookingId },
          data: {
            poolDeadlineTime: newDeadline,
            poolStatus: PoolStatus.waiting
          }
        });

        return {
          bookingId: booking.bookingId,
          action: 'deadline_updated',
          oldDeadline,
          newDeadline,
          oldStatus: booking.poolStatus,
          newStatus: PoolStatus.waiting,
          reason: `Balance mode: deadline adjusted for batch optimization (threshold: ${balanceThreshold} days)`
        };
      } else {
        return {
          bookingId: booking.bookingId,
          action: 'remained_pooled',
          reason: `Balance mode: deadline already optimal for batch processing`
        };
      }
    }
  }

  /**
   * Handle transition to Normal/Custom mode - standard processing
   */
  private async handleNormalModeTransition(
    booking: any,
    priority: any,
    daysUntilMeeting: number
  ): Promise<PoolTransitionDetail> {
    const oldDeadline = booking.poolDeadlineTime;
    
    // Use standard thresholds for normal mode
    const normalDeadline = new Date(booking.timeStart.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
    
    // Check if booking should be processed immediately
    const shouldProcessImmediately = daysUntilMeeting <= priority.urgentThresholdDays;
    
    if (shouldProcessImmediately) {
      await prisma.bookingPlan.update({
        where: { bookingId: booking.bookingId },
        data: {
          poolStatus: PoolStatus.ready,
          poolDeadlineTime: normalDeadline
        }
      });

      return {
        bookingId: booking.bookingId,
        action: 'immediate_assignment',
        oldDeadline,
        newDeadline: normalDeadline,
        oldStatus: booking.poolStatus,
        newStatus: PoolStatus.ready,
        reason: `Normal mode: booking within urgent threshold (${priority.urgentThresholdDays} days)`
      };
    } else {
      // Update deadline if significantly different
      if (Math.abs(normalDeadline.getTime() - oldDeadline.getTime()) > 60000) { // 1 minute tolerance
        await prisma.bookingPlan.update({
          where: { bookingId: booking.bookingId },
          data: {
            poolDeadlineTime: normalDeadline
          }
        });

        return {
          bookingId: booking.bookingId,
          action: 'deadline_updated',
          oldDeadline,
          newDeadline: normalDeadline,
          reason: `Normal mode: deadline updated to standard threshold`
        };
      } else {
        return {
          bookingId: booking.bookingId,
          action: 'remained_pooled',
          reason: `Normal mode: deadline already at standard threshold`
        };
      }
    }
  }

  /**
   * Validate mode switch before execution
   */
  private async validateModeSwitch(newMode: AssignmentPolicy['mode']): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate mode is supported
    const validModes: AssignmentPolicy['mode'][] = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
    if (!validModes.includes(newMode)) {
      errors.push(`Invalid mode: ${newMode}. Supported modes: ${validModes.join(', ')}`);
    }

    // Check system state
    try {
      const poolStats = await bookingPool.getPoolStats();
      
      if (poolStats.currentlyProcessing > 0) {
        warnings.push(`${poolStats.currentlyProcessing} bookings are currently being processed. Mode switch will handle them gracefully.`);
      }

      if (poolStats.failedEntries > 0) {
        warnings.push(`${poolStats.failedEntries} failed pool entries detected. Consider resolving these before mode switch.`);
      }

      // Mode-specific validations
      if (newMode === 'URGENT' && poolStats.totalInPool > 50) {
        warnings.push(`Large pool size (${poolStats.totalInPool}) may cause system load when switching to Urgent mode.`);
      }

      if (newMode === 'BALANCE' && poolStats.totalInPool < 5) {
        warnings.push(`Small pool size (${poolStats.totalInPool}) may not benefit from Balance mode optimization.`);
      }

    } catch (error) {
      warnings.push(`Could not validate pool state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for active pool processing that needs graceful handling
   */
  private async checkActivePoolProcessing(): Promise<{
    hasActiveProcessing: boolean;
    processingBookings: number[];
    processingStartTime?: Date;
  }> {
    try {
      const processingBookings = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: PoolStatus.processing
        },
        select: {
          bookingId: true,
          poolEntryTime: true
        }
      });

      return {
        hasActiveProcessing: processingBookings.length > 0,
        processingBookings: processingBookings.map(b => b.bookingId),
        processingStartTime: processingBookings.length > 0 ? 
          processingBookings.reduce((earliest, booking) => 
            !earliest || (booking.poolEntryTime && booking.poolEntryTime < earliest) ? 
            booking.poolEntryTime : earliest, undefined as Date | undefined) : undefined
      };
    } catch (error) {
      console.error('❌ Error checking active pool processing:', error);
      return {
        hasActiveProcessing: false,
        processingBookings: []
      };
    }
  }

  /**
   * Handle graceful transition when pool processing is active
   */
  private async handleActiveProcessingTransition(processingBookings: number[]): Promise<void> {
    console.log(`🔄 Handling ${processingBookings.length} actively processing bookings...`);

    // Wait a short time for current processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if any are still processing and reset them to waiting
    const stillProcessing = await prisma.bookingPlan.findMany({
      where: {
        bookingId: { in: processingBookings },
        poolStatus: PoolStatus.processing
      }
    });

    if (stillProcessing.length > 0) {
      console.log(`⚠️ Resetting ${stillProcessing.length} stuck processing bookings to waiting status`);
      
      await prisma.bookingPlan.updateMany({
        where: {
          bookingId: { in: stillProcessing.map(b => b.bookingId) }
        },
        data: {
          poolStatus: PoolStatus.waiting
        }
      });
    }
  }

  /**
   * Generate user feedback for mode transition
   */
  private async generateUserFeedback(
    oldMode: AssignmentPolicy['mode'],
    newMode: AssignmentPolicy['mode'],
    poolTransition: PoolTransitionResult
  ): Promise<UserFeedback> {
    const impactedBookings: UserFeedback['impactedBookings'] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Get details of impacted bookings
    for (const detail of poolTransition.processingDetails) {
      if (detail.action !== 'remained_pooled') {
        try {
          const booking = await prisma.bookingPlan.findUnique({
            where: { bookingId: detail.bookingId },
            select: {
              bookingId: true,
              meetingType: true,
              timeStart: true
            }
          });

          if (booking) {
            impactedBookings.push({
              bookingId: booking.bookingId,
              meetingType: booking.meetingType,
              startTime: booking.timeStart,
              impact: this.getImpactDescription(detail.action, oldMode, newMode),
              action: detail.reason
            });
          }
        } catch (error) {
          console.error(`❌ Error getting booking details for feedback:`, error);
        }
      }
    }

    // Generate mode-specific recommendations
    switch (newMode) {
      case 'URGENT':
        recommendations.push('Monitor system load as Urgent mode processes bookings immediately');
        if (poolTransition.immediateAssignments > 10) {
          warnings.push(`${poolTransition.immediateAssignments} bookings marked for immediate processing - expect increased system activity`);
        }
        break;

      case 'BALANCE':
        recommendations.push('Balance mode will optimize fairness through batch processing');
        if (poolTransition.deadlineUpdates > 0) {
          recommendations.push(`${poolTransition.deadlineUpdates} booking deadlines adjusted for batch optimization`);
        }
        break;

      case 'NORMAL':
        recommendations.push('Normal mode provides balanced assignment processing');
        break;

      case 'CUSTOM':
        recommendations.push('Custom mode uses your configured parameters - monitor results and adjust as needed');
        break;
    }

    // Generate warnings based on transition results
    if (poolTransition.escalatedEntries > 0) {
      warnings.push(`${poolTransition.escalatedEntries} bookings could not be processed and were escalated`);
    }

    if (poolTransition.remainingInPool > 20) {
      warnings.push(`${poolTransition.remainingInPool} bookings remain in pool - monitor processing progress`);
    }

    const summary = this.generateTransitionSummary(oldMode, newMode, poolTransition);

    return {
      summary,
      impactedBookings,
      recommendations,
      warnings
    };
  }

  /**
   * Get impact description for booking action
   */
  private getImpactDescription(
    action: PoolTransitionDetail['action'],
    oldMode: AssignmentPolicy['mode'],
    newMode: AssignmentPolicy['mode']
  ): string {
    switch (action) {
      case 'immediate_assignment':
        return `Marked for immediate processing due to ${newMode} mode`;
      case 'deadline_updated':
        return `Assignment deadline adjusted for ${newMode} mode optimization`;
      case 'status_changed':
        return `Pool status updated for ${newMode} mode processing`;
      case 'escalated':
        return 'Could not be processed during mode transition';
      default:
        return `Remained in pool with ${newMode} mode settings`;
    }
  }

  /**
   * Generate transition summary
   */
  private generateTransitionSummary(
    oldMode: AssignmentPolicy['mode'],
    newMode: AssignmentPolicy['mode'],
    poolTransition: PoolTransitionResult
  ): string {
    const { processedEntries, immediateAssignments, remainingInPool, escalatedEntries } = poolTransition;

    let summary = `Successfully switched from ${oldMode} to ${newMode} mode. `;

    if (processedEntries === 0) {
      summary += 'No pooled bookings were affected.';
    } else {
      summary += `Processed ${processedEntries} pooled bookings: `;
      
      const parts: string[] = [];
      if (immediateAssignments > 0) parts.push(`${immediateAssignments} marked for immediate assignment`);
      if (remainingInPool > 0) parts.push(`${remainingInPool} remain in pool with updated settings`);
      if (escalatedEntries > 0) parts.push(`${escalatedEntries} escalated due to processing issues`);
      
      summary += parts.join(', ') + '.';
    }

    return summary;
  }

  /**
   * Log mode transition for audit and monitoring
   */
  private async logModeTransition(result: ModeTransitionResult): Promise<void> {
    try {
      await this.logger.logModeTransition({
        timestamp: result.transitionTime,
        oldMode: result.oldMode,
        newMode: result.newMode,
        success: result.success,
        pooledBookingsAffected: result.pooledBookingsAffected,
        immediateAssignments: result.immediateAssignments,
        poolTransition: result.poolTransition,
        errors: result.errors,
        userFeedback: result.userFeedback
      });

      console.log(`📝 Mode transition logged: ${result.oldMode} → ${result.newMode} (${result.success ? 'SUCCESS' : 'FAILED'})`);
    } catch (error) {
      console.error('❌ Failed to log mode transition:', error);
    }
  }
}

// Export singleton instance
export const modeTransitionManager = new ModeTransitionManager();