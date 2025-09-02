# Requirements Document

## Introduction

This specification outlines improvements to the existing auto-assignment system for interpreter booking. The system automatically assigns interpreters to booking requests based on scoring algorithms, workload balancing, and business rules. The current system has critical issues with concurrent bookings, DR meeting assignment rules, and assignment mode effectiveness that need to be addressed while maintaining the existing codebase structure.

## Requirements

### Requirement 1: Time Conflict Prevention in Auto-Assignment

**User Story:** As a booking administrator, I want the auto-assignment system to prevent assigning the same interpreter to overlapping time slots, so that interpreters don't get double-booked even when multiple people can book at the same time.

#### Acceptance Criteria

1. WHEN the auto-assignment system selects an interpreter THEN it SHALL check for existing approved or pending bookings at overlapping times
2. WHEN an interpreter has a time conflict THEN they SHALL be excluded from the candidate pool for that booking
3. WHEN calculating availability THEN the system SHALL consider all booking statuses that reserve interpreter time (approved, pending)
4. WHEN multiple auto-assignments run simultaneously THEN database transactions SHALL prevent race conditions
5. IF an interpreter becomes unavailable between scoring and assignment THEN the system SHALL retry with the next best candidate

### Requirement 2: DR Meeting Consecutive Assignment Rules with Fairness Window

**User Story:** As a system administrator, I want to control DR meeting assignments using a configurable fairness window to prevent interpreter burnout while ensuring coverage, so that workload is distributed fairly within the tracking period.

#### Acceptance Criteria

1. WHEN determining DR assignments THEN the system SHALL check consecutive assignment history within the fairnessWindowDays period
2. WHEN an interpreter was assigned the most recent DR meeting globally THEN they SHALL receive penalties or blocks based on mode policy
3. WHEN checking DR history THEN only assignments within the fairnessWindowDays SHALL be considered for consecutive calculations
4. IF no other interpreters are available for a DR meeting THEN the system SHALL override consecutive rules to ensure coverage
5. WHEN the fairnessWindowDays is updated THEN it SHALL affect future DR assignment calculations immediately
6. WHEN in Balance mode THEN consecutive DR assignments SHALL be hard-blocked unless no alternatives exist within the fairness window
7. WHEN in Normal mode THEN consecutive DR assignments SHALL receive penalties but remain possible if needed

### Requirement 3: Assignment Mode Pool Integration

**User Story:** As a booking administrator, I want different assignment modes to handle booking timing and fairness appropriately, so that the system can adapt to different operational needs.

#### Acceptance Criteria

1. WHEN in Balance mode THEN the system SHALL use a pool-based approach to delay assignments until threshold days
2. WHEN in Balance mode THEN assignments SHALL prioritize interpreter workload distribution over immediate assignment
3. WHEN in Urgent mode THEN bookings SHALL be assigned immediately with minimal fairness considerations
4. WHEN in Normal mode THEN the system SHALL balance immediate assignment needs with fairness considerations
5. WHEN threshold days are reached in Balance mode THEN all pooled bookings SHALL be processed with maximum fairness weighting
6. IF a booking reaches its deadline THEN it SHALL be assigned immediately regardless of mode
7. WHEN users configure Custom mode parameters THEN the system SHALL validate ranges and provide warnings for extreme values

### Requirement 4: Enhanced Scoring Algorithm

**User Story:** As a system administrator, I want the scoring algorithm to accurately reflect business priorities and constraints, so that assignments are optimal for both interpreters and clients.

#### Acceptance Criteria

1. WHEN calculating assignment scores THEN the system SHALL incorporate fairness, urgency, and rotation weights based on the current mode
2. WHEN DR penalties are applied THEN they SHALL be calculated based on consecutive assignment history and mode policy
3. WHEN multiple interpreters have similar scores THEN the system SHALL use secondary criteria like recent assignment patterns
4. WHEN an interpreter is unavailable due to conflicts THEN they SHALL be excluded from scoring entirely
5. IF scoring results in ties THEN the system SHALL use deterministic tie-breaking rules to ensure consistent results

### Requirement 5: Configuration Management and Validation

**User Story:** As a system administrator, I want to configure assignment parameters with proper validation and feedback, so that the system operates within safe and effective ranges.

#### Acceptance Criteria

1. WHEN users modify assignment mode THEN the UI SHALL update to show mode-specific parameter locks and recommendations
2. WHEN Custom mode is selected THEN users SHALL be able to modify all parameters with validation warnings
3. WHEN extreme values are entered THEN the system SHALL display warnings about potential impacts
4. WHEN configuration changes are saved THEN they SHALL be validated against business rules before application
5. IF invalid configurations are detected THEN clear error messages SHALL guide users to correct values

### Requirement 6: Improved User Interface

**User Story:** As a system administrator, I want an intuitive interface for managing auto-assignment configuration, so that I can easily understand and adjust system behavior.

#### Acceptance Criteria

1. WHEN viewing the configuration page THEN mode-specific settings SHALL be clearly organized and labeled
2. WHEN a mode is selected THEN locked parameters SHALL be visually distinguished from configurable ones
3. WHEN hovering over parameters THEN tooltips SHALL explain their impact on assignment behavior
4. WHEN configuration changes are made THEN real-time validation feedback SHALL be provided
5. WHEN viewing DR policies THEN the current consecutive assignment rules SHALL be clearly displayed
6. IF the system detects potential issues THEN warning indicators SHALL be shown with explanatory text

### Requirement 7: Dynamic Interpreter Pool Management

**User Story:** As a system administrator, I want the system to handle interpreters being added or removed dynamically, so that assignment calculations remain accurate and fair even when the interpreter pool changes.

#### Acceptance Criteria

1. WHEN new interpreters are added to the system THEN they SHALL be included in future assignment calculations immediately
2. WHEN interpreters are removed or deactivated THEN they SHALL be excluded from assignment pools but their historical data SHALL be preserved
3. WHEN calculating fairness scores THEN the system SHALL account for interpreters who may not have been available for the full fairness window period
4. WHEN the interpreter pool changes significantly THEN fairness calculations SHALL be adjusted to prevent bias against new interpreters
5. IF an interpreter's availability status changes THEN pending assignments SHALL be re-evaluated if necessary

### Requirement 8: Pool Processing and Assignment Recovery

**User Story:** As a booking administrator, I want pooled bookings to be properly processed and assigned when their deadlines approach, so that no bookings are left unassigned due to pool processing failures.

#### Acceptance Criteria

1. WHEN bookings are added to the pool THEN they SHALL be logged in POOL_PROCESSING_LOG for tracking
2. WHEN pool processing runs THEN it SHALL retrieve and process all eligible pooled bookings
3. WHEN a booking's deadline approaches THEN it SHALL be automatically assigned from the pool
4. WHEN assignment mode changes from Balance to Urgent THEN existing pooled bookings SHALL be re-evaluated for immediate assignment
5. IF pool processing fails THEN the system SHALL retry with exponential backoff and log detailed error information
6. WHEN pooled bookings are successfully assigned THEN they SHALL be removed from the pool and logged appropriately

### Requirement 9: Database Error Resolution and Logging Stability

**User Story:** As a system administrator, I want the logging system to handle database errors gracefully without crashing the assignment process, so that assignment operations continue even when logging fails.

#### Acceptance Criteria

1. WHEN dRPolicyLog creation fails THEN the error SHALL be logged but not block the assignment process
2. WHEN database connection issues occur THEN logging operations SHALL implement retry logic with fallback
3. WHEN prisma client is undefined THEN the system SHALL reinitialize the connection or use alternative logging
4. IF logging consistently fails THEN the system SHALL disable problematic logging temporarily and alert administrators
5. WHEN logging errors occur THEN they SHALL be captured in a separate error log for debugging

### Requirement 10: Assignment Mode Switching and Pool Re-evaluation

**User Story:** As a booking administrator, I want to switch assignment modes and have existing pooled bookings re-evaluated according to the new mode rules, so that urgent situations can be handled immediately without losing existing bookings.

#### Acceptance Criteria

1. WHEN assignment mode changes from Balance to Urgent THEN all pooled bookings SHALL be immediately re-evaluated for assignment
2. WHEN assignment mode changes from Urgent to Balance THEN new bookings SHALL follow pool-based processing while existing assignments remain unchanged
3. WHEN Custom mode parameters change THEN pooled bookings SHALL be re-evaluated against new thresholds
4. WHEN mode switching occurs THEN the system SHALL log the change and its impact on existing pooled bookings
5. IF immediate assignment is required due to mode change THEN the system SHALL bypass normal pool processing for affected bookings

### Requirement 11: System Monitoring and Logging

**User Story:** As a system administrator, I want comprehensive logging of assignment decisions and system behavior, so that I can troubleshoot issues and optimize performance.

#### Acceptance Criteria

1. WHEN assignments are made THEN the system SHALL log scoring details, selected interpreter, and decision rationale
2. WHEN time conflicts are detected THEN detailed conflict resolution logs SHALL be created
3. WHEN DR consecutive rules are applied THEN the system SHALL log penalty calculations and policy decisions
4. WHEN pool-based assignments are processed THEN batch processing details SHALL be logged
5. IF assignment failures occur THEN comprehensive error logs SHALL capture system state and failure reasons