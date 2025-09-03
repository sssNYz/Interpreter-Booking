/**
 * Mode-Specific Threshold Management
 * 
 * Handles retrieval and caching of mode-specific threshold configurations
 * for different assignment modes and meeting types.
 */

import { PrismaClient } from '@prisma/client';
import { MeetingTypeModeThreshold, MeetingTypePriority } from '../../types/assignment';

const prisma = new PrismaClient();

// Cache for mode-specific thresholds to avoid repeated database queries
let thresholdCache: Map<string, MeetingTypeModeThreshold> = new Map();
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get threshold configuration for a specific meeting type and assignment mode
 */
export async function getModeSpecificThreshold(
  meetingType: string,
  assignmentMode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
): Promise<{ urgentThresholdDays: number; generalThresholdDays: number }> {
  
  // Check cache first
  const cacheKey = `${meetingType}-${assignmentMode}`;
  const now = Date.now();
  
  if (now < cacheExpiry && thresholdCache.has(cacheKey)) {
    const cached = thresholdCache.get(cacheKey)!;
    return {
      urgentThresholdDays: cached.urgentThresholdDays,
      generalThresholdDays: cached.generalThresholdDays
    };
  }
  
  try {
    // Try to get mode-specific threshold first
    const modeThreshold = await prisma.meetingTypeModeThreshold.findUnique({
      where: {
        meetingType_assignmentMode: {
          meetingType: meetingType as any,
          assignmentMode
        }
      }
    });
    
    if (modeThreshold) {
      // Cache the result
      const cacheEntry: MeetingTypeModeThreshold = {
        id: modeThreshold.id,
        meetingType: modeThreshold.meetingType,
        assignmentMode: assignmentMode,
        urgentThresholdDays: modeThreshold.urgentThresholdDays,
        generalThresholdDays: modeThreshold.generalThresholdDays,
        createdAt: modeThreshold.createdAt,
        updatedAt: modeThreshold.updatedAt
      };
      thresholdCache.set(cacheKey, cacheEntry);
      if (now >= cacheExpiry) {
        cacheExpiry = now + CACHE_DURATION;
      }
      
      return {
        urgentThresholdDays: modeThreshold.urgentThresholdDays,
        generalThresholdDays: modeThreshold.generalThresholdDays
      };
    }
    
    // Fallback to default meeting type priority if mode-specific not found
    const defaultPriority = await prisma.meetingTypePriority.findUnique({
      where: { meetingType: meetingType as any }
    });
    
    if (defaultPriority) {
      return {
        urgentThresholdDays: defaultPriority.urgentThresholdDays,
        generalThresholdDays: defaultPriority.generalThresholdDays
      };
    }
    
    // Final fallback - default values
    console.warn(`No threshold configuration found for ${meetingType} in ${assignmentMode} mode, using defaults`);
    return getDefaultThresholds(meetingType, assignmentMode);
    
  } catch (error) {
    console.error(`Error getting mode-specific threshold for ${meetingType} in ${assignmentMode} mode:`, error);
    return getDefaultThresholds(meetingType, assignmentMode);
  }
}

/**
 * Get all mode-specific thresholds for a given assignment mode
 */
export async function getAllModeThresholds(
  assignmentMode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
): Promise<MeetingTypeModeThreshold[]> {
  try {
    const results = await prisma.meetingTypeModeThreshold.findMany({
      where: { assignmentMode },
      orderBy: { meetingType: 'asc' }
    });
    
    return results.map(result => ({
      id: result.id,
      meetingType: result.meetingType,
      assignmentMode: assignmentMode,
      urgentThresholdDays: result.urgentThresholdDays,
      generalThresholdDays: result.generalThresholdDays,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }));
  } catch (error) {
    console.error(`Error getting all thresholds for ${assignmentMode} mode:`, error);
    return [];
  }
}

/**
 * Update mode-specific threshold configuration
 */
export async function updateModeThreshold(
  meetingType: string,
  assignmentMode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM',
  urgentThresholdDays: number,
  generalThresholdDays: number
): Promise<MeetingTypeModeThreshold> {
  try {
    const updated = await prisma.meetingTypeModeThreshold.upsert({
      where: {
        meetingType_assignmentMode: {
          meetingType: meetingType as any,
          assignmentMode
        }
      },
      update: {
        urgentThresholdDays,
        generalThresholdDays
      },
      create: {
        meetingType: meetingType as any,
        assignmentMode,
        urgentThresholdDays,
        generalThresholdDays
      }
    });
    
    // Clear cache to force refresh
    clearThresholdCache();
    
    return {
      id: updated.id,
      meetingType: updated.meetingType,
      assignmentMode: assignmentMode,
      urgentThresholdDays: updated.urgentThresholdDays,
      generalThresholdDays: updated.generalThresholdDays,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  } catch (error) {
    console.error(`Error updating mode threshold for ${meetingType} in ${assignmentMode} mode:`, error);
    throw error;
  }
}

/**
 * Clear the threshold cache
 */
export function clearThresholdCache(): void {
  thresholdCache.clear();
  cacheExpiry = 0;
}

/**
 * Get default threshold values based on meeting type and mode
 */
function getDefaultThresholds(
  meetingType: string,
  assignmentMode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
): { urgentThresholdDays: number; generalThresholdDays: number } {
  
  // Default fallback values based on your specifications
  const defaults = {
    BALANCE: {
      DR: { urgentThresholdDays: 7, generalThresholdDays: 30 },
      VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      Augent: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      Weekly: { urgentThresholdDays: 3, generalThresholdDays: 15 },
      General: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      Other: { urgentThresholdDays: 3, generalThresholdDays: 7 }
    },
    NORMAL: {
      DR: { urgentThresholdDays: 10, generalThresholdDays: 30 },
      VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      Augent: { urgentThresholdDays: 10, generalThresholdDays: 15 },
      Weekly: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      General: { urgentThresholdDays: 10, generalThresholdDays: 15 },
      Other: { urgentThresholdDays: 7, generalThresholdDays: 10 }
    },
    URGENT: {
      DR: { urgentThresholdDays: 14, generalThresholdDays: 45 },
      VIP: { urgentThresholdDays: 7, generalThresholdDays: 15 },
      Augent: { urgentThresholdDays: 14, generalThresholdDays: 30 },
      Weekly: { urgentThresholdDays: 14, generalThresholdDays: 30 },
      General: { urgentThresholdDays: 14, generalThresholdDays: 30 },
      Other: { urgentThresholdDays: 7, generalThresholdDays: 15 }
    },
    CUSTOM: {
      // CUSTOM mode falls back to original values
      DR: { urgentThresholdDays: 1, generalThresholdDays: 7 },
      VIP: { urgentThresholdDays: 2, generalThresholdDays: 14 },
      Augent: { urgentThresholdDays: 3, generalThresholdDays: 30 },
      Weekly: { urgentThresholdDays: 3, generalThresholdDays: 30 },
      General: { urgentThresholdDays: 3, generalThresholdDays: 30 },
      Other: { urgentThresholdDays: 5, generalThresholdDays: 45 }
    }
  };
  
  const modeDefaults = defaults[assignmentMode] || defaults.NORMAL;
  return (modeDefaults as any)[meetingType] || (modeDefaults as any).Other;
}