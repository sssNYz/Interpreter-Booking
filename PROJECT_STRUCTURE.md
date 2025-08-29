# Interpreter-Booking Project Structure

## Project Overview
This is a Next.js-based interpreter booking system with TypeScript, featuring user authentication, booking management, admin controls, and an intelligent auto-assignment engine for interpreters.

## Root Directory Structure
```
Interpreter-Booking/
├── 📁 app/                    # Next.js App Router (Main Application)
├── 📁 components/             # Reusable UI Components
├── 📁 data/                   # Mock Data and Static Data Files
├── 📁 hooks/                  # Custom React Hooks
├── 📁 lib/                    # Utility Libraries and Authentication
├── 📁 prisma/                 # Database Schema and Migrations
├── 📁 public/                 # Static Assets
├── 📁 scripts/                # Build and Utility Scripts
├── 📁 types/                  # TypeScript Type Definitions
├── 📁 utils/                  # Utility Functions
├── 📄 package.json            # Node.js Dependencies
├── 📄 next.config.ts          # Next.js Configuration
├── 📄 tsconfig.json           # TypeScript Configuration
├── 📄 PROJECT_STRUCTURE.md    # This Documentation
├── 📄 AUTO_ASSIGNMENT_README.md # Auto-Assignment System Documentation
├── 📄 BOOKING_STATUS_RULE.md   # Booking Status Rules
└── 📄 README.md               # Project Documentation
```

## Detailed Structure Breakdown

### 📁 app/ - Next.js Application Routes
```
app/
├── 📁 AdminPage/              # Admin Panel Pages
│   ├── 📁 auto-assign-config/ # Auto-Assignment Configuration
│   │   └── 📄 page.tsx        # Assignment Policy Settings
│   ├── 📁 booking-manage-page/
│   │   └── 📄 page.tsx        # Booking Management Interface
│   └── 📁 user-manage-page/
│       └── 📄 page.tsx        # User Management Interface
├── 📁 api/                    # API Routes (Backend Endpoints)
│   ├── 📁 admin/
│   │   ├── 📁 config/
│   │   │   └── 📁 auto-assign/ # Auto-Assignment Configuration API
│   │   │       └── 📄 route.ts
│   │   └── 📁 fix-booking-time/
│   ├── 📁 assignment/         # Interpreter Assignment APIs
│   │   └── 📁 run/
│   │       └── 📄 route.ts    # Auto-Assignment Execution
│   ├── 📁 booking-data/       # Booking-related API endpoints
│   │   ├── 📁 get-booking/
│   │   ├── 📁 get-booking-by-owner/
│   │   ├── 📁 get-booking-byDate/
│   │   └── 📁 post-booking-data/
│   ├── 📁 employees/          # Employee management APIs
│   │   ├── 📁 get-employees/
│   │   ├── 📁 get-employees-byCode/
│   │   └── 📁 put-employees-role/
│   ├── 📁 login/              # Authentication APIs
│   ├── 📁 logout/
│   └── 📁 session/
├── 📄 BookingPage/page.tsx    # Main Booking Interface
├── 📄 introduce-page/page.tsx # Introduction/Onboarding Page
├── 📄 login/page.tsx          # Login Page
├── 📄 layout.tsx              # Root Layout Component
└── 📄 page.tsx                # Home Page
```

### 📁 components/ - Reusable UI Components
```
components/
├── 📁 AdminControls/          # Admin-specific Control Components
│   ├── 📄 AutoAssignConfig.tsx # Auto-Assignment Configuration Interface
│   ├── 📄 AssignmentCandidates.tsx # Interpreter Selection Interface
│   ├── 📄 booking-manage.tsx  # Booking Management Controls
│   ├── 📄 overview.tsx        # Admin Dashboard Overview
│   └── 📄 user-manage.tsx     # User Management Controls
├── 📁 AdminForm/              # Admin Form Components
│   ├── 📄 booking-form.tsx    # Admin Booking Form
│   └── 📄 user-set-role.tsx   # User Role Assignment Form
├── 📁 BookingCalendar/        # Calendar-related Components
│   ├── 📄 booking-calendar.tsx # Main Calendar Component
│   └── 📄 day-row.tsx         # Individual Day Row Component
├── 📁 BookingForm/            # Booking Form Components
│   ├── 📄 booking-form.tsx    # Main Booking Form
│   ├── 📁 components/
│   │   └── 📄 TimeRangeSelector.tsx # Time Selection Component
│   └── 📁 sections/           # Form Sections
│       ├── 📄 InviteEmailsSection.tsx    # Email Invitation Section
│       ├── 📄 MeetingDetailsSection.tsx # Meeting Details Section
│       └── 📄 PersonalInfoSection.tsx   # Personal Information Section
├── 📁 BookingHistory/         # Booking History Components
│   └── 📄 booking-history.tsx # History Display Component
├── 📁 BookingRules/           # Booking Rules Components
│   └── 📄 booking-rules.tsx   # Rules Display Component
├── 📁 LoginForm/              # Authentication Components
│   └── 📄 login-form.tsx      # Login Form Component
├── 📁 navbar/                 # Navigation Components
│   └── 📄 page.tsx            # Navigation Bar
├── 📁 slidebar/               # Sidebar Components
│   └── 📄 app-sidebar.tsx     # Application Sidebar
├── 📄 calendar-04.tsx         # Calendar Component Variant 1
├── 📄 calendar-22.tsx         # Calendar Component Variant 2
├── 📄 ClientShell.tsx         # Client Application Shell
└── 📁 ui/                     # Base UI Components (shadcn/ui)
    ├── 📄 alert.tsx           # Alert Component
    ├── 📄 avatar.tsx          # Avatar Component
    ├── 📄 badge.tsx           # Badge Component
    ├── 📄 button.tsx          # Button Component
    ├── 📄 calendar.tsx        # Calendar Component
    ├── 📄 card.tsx            # Card Component
    ├── 📄 checkbox.tsx        # Checkbox Component
    ├── 📄 collapsible.tsx     # Collapsible Component
    ├── 📄 command.tsx         # Command Component
    ├── 📄 dialog.tsx          # Dialog Component
    ├── 📄 dropdown-menu.tsx   # Dropdown Menu Component
    ├── 📄 hover-card.tsx      # Hover Card Component
    ├── 📄 input.tsx           # Input Component
    ├── 📄 label.tsx           # Label Component
    ├── 📄 navigation-menu.tsx # Navigation Menu Component
    ├── 📄 pagination.tsx      # Pagination Component
    ├── 📄 popover.tsx         # Popover Component
    ├── 📄 radio-group.tsx     # Radio Group Component
    ├── 📄 scroll-area.tsx     # Scroll Area Component
    ├── 📄 select.tsx          # Select Component
    ├── 📄 separator.tsx       # Separator Component
    ├── 📄 sheet.tsx           # Sheet Component
    ├── 📄 sidebar.tsx         # Sidebar Component
    ├── 📄 skeleton.tsx        # Skeleton Component
    ├── 📄 sonner.tsx          # Toast Component
    ├── 📄 switch.tsx          # Switch Component
    ├── 📄 table.tsx           # Table Component
    ├── 📄 textarea.tsx        # Textarea Component
    └── 📄 toggle.tsx          # Toggle Component
```

### 📁 data/ - Data Files
```
data/
├── 📄 mockData.json           # Mock Data for Development
├── 📄 recentBookingsData.json # Recent Bookings Data
└── 📄 weeklyData.json         # Weekly Schedule Data
```

### 📁 hooks/ - Custom React Hooks
```
hooks/
├── 📄 use-bar-slot-data.ts    # Bar Slot Data Hook
├── 📄 use-booking.ts          # Booking Management Hook
├── 📄 use-mobile.ts           # Mobile Detection Hook
└── 📄 use-slot-data.ts        # Slot Data Management Hook
```

### 📁 lib/ - Utility Libraries
```
lib/
├── 📁 assignment/             # Auto-Assignment Engine
│   ├── 📄 fairness.ts         # Fairness Algorithms
│   ├── 📄 lrs.ts              # Linear Ranking System
│   ├── 📄 policy.ts           # Assignment Policies
│   ├── 📄 run.ts              # Main Assignment Execution
│   ├── 📄 scoring.ts          # Interpreter Scoring Logic
│   └── 📄 urgency.ts          # Urgency Calculations
├── 📁 auth/
│   └── 📄 session.ts          # Session Management
└── 📄 utils.ts                # General Utility Functions
```

### 📁 prisma/ - Database Layer
```
prisma/
├── 📁 migrations/             # Database Migration Files
│   ├── 📁 20241219120000_add_dr_type_and_other_type/
│   ├── 📁 20250731051316_admin_interpreter_booking_list_email/
│   ├── 📁 add_skip_weekends_field/
│   ├── 📁 drop_high_priority.sql
│   └── 📄 migration_lock.toml
├── 📄 prisma.ts               # Prisma Client Configuration
└── 📄 schema.prisma           # Database Schema Definition
```

### 📁 scripts/ - Utility Scripts
```
scripts/
├── 📄 check-config.js         # Configuration Validation Script
├── 📄 migrate-auto-assignment.sql # Auto-Assignment Migration
├── 📄 test-booking-status.js  # Booking Status Testing
└── 📄 test-fixed-scoring.js   # Scoring Algorithm Testing
```

### 📁 types/ - TypeScript Type Definitions
```
types/
├── 📄 admin.ts                # Admin-related Types
├── 📄 api.ts                  # API-related Types
├── 📄 assignment.ts           # Auto-Assignment Types
├── 📄 auth.ts                 # Authentication Types
├── 📄 booking-requests.ts     # Booking Request Types
├── 📄 booking.ts              # Booking-related Types
├── 📄 interpreter-types.ts    # Interpreter-specific Types
├── 📄 props.ts                # Component Props Types
└── 📄 user.ts                 # User-related Types
```

### 📁 utils/ - Utility Functions
```
utils/
├── 📄 calendar.ts             # Calendar Utility Functions
├── 📄 constants.ts            # Application Constants
├── 📄 status.tsx              # Status-related Utilities
├── 📄 time.ts                 # Time-related Utilities
└── 📄 users.ts                # User-related Utilities
```

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **State Management**: React 19 Hooks
- **UI Components**: Radix UI primitives

### Backend
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL with Prisma 6 ORM
- **Authentication**: Session-based auth with 30-minute timeout
- **API**: Next.js API Routes

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint 9
- **Type Checking**: TypeScript
- **Database Migrations**: Prisma Migrate
- **Build Tool**: Next.js 15

## Key Features

1. **User Authentication**: Login/logout system with session management
2. **Booking Management**: Calendar-based booking system with time slot selection
3. **Admin Panel**: User and booking management for administrators
4. **Intelligent Auto-Assignment**: AI-powered interpreter matching system
5. **Responsive Design**: Mobile-friendly interface
6. **Role-based Access**: Different permissions for users and admins
7. **Email Integration**: Invitation system for meeting participants
8. **Fairness Algorithms**: Balanced interpreter assignment
9. **Real-time Updates**: Live calendar with conflict detection

## Advanced Features

### 🧠 **Auto-Assignment Engine**
- **Fairness Algorithms**: Ensures equal distribution of work
- **Scoring System**: Multi-factor interpreter evaluation
- **Urgency Handling**: Priority-based assignment
- **Policy Management**: Configurable assignment rules
- **Linear Ranking**: Systematic interpreter selection

### 📊 **Admin Dashboard**
- **Real-time Monitoring**: Live booking status updates
- **User Management**: Role assignment and permissions
- **Configuration Control**: System parameter management
- **Assignment Oversight**: Manual override capabilities

## File Organization Principles

- **Separation of Concerns**: Clear separation between UI components, business logic, and data
- **Component Reusability**: Modular component structure for maintainability
- **Type Safety**: Comprehensive TypeScript types throughout the application
- **API-First Design**: RESTful API structure with clear endpoint organization
- **Database Abstraction**: Prisma ORM for type-safe database operations
- **Algorithm Modularity**: Separate modules for different assignment strategies
- **Configuration Management**: Centralized system settings

## Project Status & Readiness

### ✅ **Completed Features**
- Core booking system with calendar interface
- User authentication and session management
- Admin dashboard with user management
- Auto-assignment engine with fairness algorithms
- Database schema with migrations
- Professional UI component library
- Responsive design for all devices

### 🚀 **Production Ready**
- Database migrations and schema validation
- Error handling and validation
- Security measures and input sanitization
- Performance optimization
- Comprehensive TypeScript coverage

### 📈 **Scalability Features**
- Modular architecture for easy expansion
- Database optimization for large datasets
- Component reusability for new features
- API-first design for future integrations

This structure follows Next.js best practices and provides a scalable foundation for the interpreter booking system, with particular emphasis on the intelligent auto-assignment capabilities that set this system apart from basic booking solutions.
