# Mode-Specific Threshold Implementation

## Overview

This implementation adds support for different threshold values based on assignment modes (Balance, Normal, Urgent) as requested. Each meeting type now has specific urgent and general threshold values for each assignment mode.

## Configuration Values

### Balance Mode
- **DR**: urgentThresholdDays: 7, generalThresholdDays: 30
- **VIP**: urgentThresholdDays: 7, generalThresholdDays: 15
- **Augent**: urgentThresholdDays: 7, generalThresholdDays: 15
- **Weekly**: urgentThresholdDays: 3, generalThresholdDays: 15
- **General**: urgentThresholdDays: 7, generalThresholdDays: 15
- **Other**: urgentThresholdDays: 3, generalThresholdDays: 7

### Normal Mode
- **DR**: urgentThresholdDays: 10, generalThresholdDays: 30
- **VIP**: urgentThresholdDays: 7, generalThresholdDays: 15
- **Augent**: urgentThresholdDays: 10, generalThresholdDays: 15
- **Weekly**: urgentThresholdDays: 7, generalThresholdDays: 15
- **General**: urgentThresholdDays: 10, generalThresholdDays: 15
- **Other**: urgentThresholdDays: 7, generalThresholdDays: 10

### Urgent Mode
- **DR**: urgentThresholdDays: 14, generalThresholdDays: 45
- **VIP**: urgentThresholdDays: 7, generalThresholdDays: 15
- **Augent**: urgentThresholdDays: 14, generalThresholdDays: 30
- **Weekly**: urgentThresholdDays: 14, generalThresholdDays: 30
- **General**: urgentThresholdDays: 14, generalThresholdDays: 30
- **Other**: urgentThresholdDays: 7, generalThresholdDays: 15

## Implementation Details

### Database Changes

1. **New Table**: `MEETING_TYPE_MODE_THRESHOLD`
   - Stores mode-specific threshold configurations
   - Unique constraint on (meetingType, assignmentMode)
   - Includes created/updated timestamps

2. **Schema Update**: Added to `prisma/schema.prisma`
   - New model `MeetingTypeModeThreshold`
   - Proper relationships and constraints

### Code Changes

1. **New Utility Module**: `lib/assignment/mode-thresholds.ts`
   - `getModeSpecificThreshold()`: Retrieves thresholds for a specific mode/type
   - `getAllModeThresholds()`: Gets all thresholds for a mode
   - `updateModeThreshold()`: Updates threshold configuration
   - Includes caching for performance
   - Fallback to default values if configuration missing

2. **Updated Pool Logic**: `lib/assignment/pool.ts`
   - Modified `addToPoolEnhanced()` to use mode-specific thresholds
   - Updated `calculateThresholdDays()` function
   - Modified `shouldAssignImmediately()` function
   - Updated `convertToEnhancedEntries()` function

3. **Type Definitions**: `types/assignment.ts`
   - Added `MeetingTypeModeThreshold` interface
   - Maintains backward compatibility

### Scripts and Tools

1. **Initialization Script**: `scripts/init-mode-specific-thresholds.js`
   - Creates/updates mode-specific threshold configurations
   - Handles existing data gracefully
   - Provides detailed logging

2. **Migration Script**: `prisma/migrations/add_mode_specific_thresholds.sql`
   - SQL migration to create the new table
   - Inserts default configuration values
   - Uses `INSERT IGNORE` for safe execution

3. **Test Script**: `scripts/test-mode-specific-thresholds.js`
   - Validates all threshold configurations
   - Tests utility functions
   - Comprehensive error reporting

## Usage

### Setup

1. **Run Database Migration**:
   ```bash
   # Apply the schema changes
   npx prisma db push
   
   # Or run the SQL migration directly
   mysql -u username -p database_name < prisma/migrations/add_mode_specific_thresholds.sql
   ```

2. **Initialize Threshold Data**:
   ```bash
   node scripts/init-mode-specific-thresholds.js
   ```

3. **Verify Configuration**:
   ```bash
   node scripts/test-mode-specific-thresholds.js
   ```

### API Usage

```typescript
import { getModeSpecificThreshold } from '@/lib/assignment/mode-thresholds';

// Get thresholds for a specific meeting type and mode
const thresholds = await getModeSpecificThreshold('DR', 'BALANCE');
console.log(thresholds); // { urgentThresholdDays: 7, generalThresholdDays: 30 }

// Update threshold configuration
await updateModeThreshold('VIP', 'URGENT', 5, 12);
```

## Backward Compatibility

- Existing `MeetingTypePriority` table remains unchanged
- Falls back to original priority values if mode-specific not found
- CUSTOM mode uses original threshold values by default
- All existing APIs continue to work

## Performance Considerations

- **Caching**: Mode-specific thresholds are cached for 5 minutes
- **Fallback Logic**: Graceful degradation if database unavailable
- **Batch Operations**: Efficient handling of multiple threshold lookups

## Testing

The implementation includes comprehensive testing:

1. **Database Integrity**: Verifies all configurations are present
2. **Value Accuracy**: Confirms threshold values match specifications
3. **Function Testing**: Validates utility functions work correctly
4. **Error Handling**: Tests fallback scenarios

## Future Enhancements

1. **Admin Interface**: Add UI for managing mode-specific thresholds
2. **Dynamic Updates**: Real-time threshold updates without restart
3. **Analytics**: Track threshold effectiveness by mode
4. **Validation Rules**: Add business rule validation for threshold values

## Troubleshooting

### Common Issues

1. **Missing Configurations**: Run initialization script
2. **Cache Issues**: Clear cache using `clearThresholdCache()`
3. **Database Errors**: Check table exists and has proper permissions
4. **Type Mismatches**: Ensure meeting types match enum values

### Debugging

Enable detailed logging by setting environment variable:
```bash
DEBUG=assignment:thresholds node your-script.js
```

## Migration Notes

- Safe to run on existing systems
- No data loss risk
- Gradual rollout possible (mode by mode)
- Rollback available by removing new table