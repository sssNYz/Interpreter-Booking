# minAdvanceDays Parameter Removal Summary

## Overview
Successfully removed the `minAdvanceDays` parameter from the auto-assignment system as requested. The system now uses `urgentThresholdDays` (per meeting type) for all urgency calculations, simplifying the configuration and eliminating redundant parameters.

## Changes Made

### 1. Type Definitions (`types/assignment.ts`)
- ❌ Removed `minAdvanceDays: number` from `AssignmentPolicy` interface
- ✅ System now has **8 parameters** instead of 9

### 2. Policy Configuration (`lib/assignment/policy.ts`)
- ❌ Removed `minAdvanceDays: 2` from `DEFAULT_POLICY`
- ❌ Removed `minAdvanceDays` from `getModeDefaults()` return type
- ❌ Removed `minAdvanceDays` validation from `validateAndClampPolicy()`

### 3. Urgency Calculations (`lib/assignment/urgency.ts`)
- ✅ Updated `computeEnhancedUrgencyScore()` to use `urgentThresholdDays` instead of `minAdvanceDays`
- ✅ Updated `computeUrgencyScore()` to use `urgentThresholdDays` instead of `minAdvanceDays`
- ✅ Updated `isUrgent()` to use `urgentThresholdDays` instead of `minAdvanceDays`
- ✅ All urgency functions now get threshold from meeting type priority settings

### 4. Assignment Logic (`lib/assignment/run.ts`)
- ✅ Updated `computeEnhancedUrgencyScore()` call to remove `policy.minAdvanceDays` parameter

### 5. Configuration Validation (`lib/assignment/config-validation.ts`)
- ❌ Removed `minAdvanceDays` from `VALIDATION_RULES`
- ❌ Removed `minAdvanceDays` validation calls
- ❌ Removed cross-parameter validation between `minAdvanceDays` and `fairnessWindowDays`
- ✅ Updated urgency impact assessment to not consider `minAdvanceDays`

### 6. UI Components (`components/AdminControls/AutoAssignConfig.tsx`)
- ❌ Removed "Minimum Advance Days" slider from Fairness Settings section
- ✅ Updated mode defaults to not include `minAdvanceDays`

### 7. Migration Support
- ✅ Created `scripts/remove-minAdvanceDays-migration.js` for database cleanup

## Updated Parameter Count by Mode

### Total Parameters: **8** (reduced from 9)
1. `autoAssignEnabled` (boolean)
2. `mode` (string) 
3. `fairnessWindowDays` (number)
4. `maxGapHours` (number)
5. `w_fair` (number)
6. `w_urgency` (number)
7. `w_lrs` (number)
8. `drConsecutivePenalty` (number)

### Mode-Specific Locked Parameters: **5 each** (reduced from 6)
- **BALANCE/URGENT/NORMAL**: 5 parameters locked each
- **CUSTOM**: 0 parameters locked (all configurable)

## How Urgency Now Works

### Before (Confusing):
```
urgentThresholdDays: 1    // Meeting becomes "urgent" 
minAdvanceDays: 2         // Urgency scoring starts
generalThresholdDays: 7   // Pool entry

Timeline confusion:
Day 7: Pool entry
Day 2: Urgency scoring starts (but not "urgent"?)
Day 1: Meeting becomes "urgent" 
```

### After (Clear):
```
generalThresholdDays: 7   // Pool entry
urgentThresholdDays: 1    // Urgency scoring + "urgent" status

Clear timeline:
Day 7: Pool entry, no urgency
Day 1: Urgency scoring starts + meeting becomes "urgent"
```

## Benefits of This Change

1. **Simplified Configuration**: One less parameter to configure and understand
2. **Clearer Logic**: Urgency threshold serves dual purpose (scoring + status)
3. **Better UX**: Less confusing for administrators
4. **Consistent Behavior**: No more edge cases between different threshold types
5. **Maintainable Code**: Fewer parameters to validate and manage

## Testing Recommendations

1. **Verify urgency calculations work correctly** with meeting type thresholds
2. **Test all assignment modes** still function properly
3. **Check UI** no longer shows minAdvanceDays controls
4. **Validate configuration saving/loading** works without minAdvanceDays
5. **Run migration script** on existing databases if needed

## Deployment Notes

1. Deploy code changes first
2. Run migration script if database has minAdvanceDays column
3. Existing configurations will automatically use urgentThresholdDays for urgency
4. No user action required - system will work seamlessly

✅ **System is now simplified and ready for use with 8 parameters instead of 9!**