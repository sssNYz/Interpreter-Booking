# Interpreter-Booking Project Structure

## Project Overview
This is a Next.js-based interpreter booking system with TypeScript, featuring user authentication, booking management, and admin controls.

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
└── 📄 README.md               # Project Documentation
```

## Detailed Structure Breakdown

### 📁 app/ - Next.js Application Routes
```
app/
├── 📁 AdminPage/              # Admin Panel Pages
│   ├── 📁 booking-manage-page/
│   │   └── 📄 page.tsx        # Booking Management Interface
│   └── 📁 user-manage-page/
│       └── 📄 page.tsx        # User Management Interface
├── 📁 api/                    # API Routes (Backend Endpoints)
│   ├── 📁 admin/
│   │   └── 📁 fix-booking-time/
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

### 📁 types/ - TypeScript Type Definitions
```
types/
├── 📄 admin.ts                # Admin-related Types
├── 📄 api.ts                  # API-related Types
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
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Hooks

### Backend
- **Runtime**: Node.js
- **Database**: Prisma ORM
- **Authentication**: Session-based auth
- **API**: Next.js API Routes

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Database Migrations**: Prisma Migrate

## Key Features

1. **User Authentication**: Login/logout system with session management
2. **Booking Management**: Calendar-based booking system with time slot selection
3. **Admin Panel**: User and booking management for administrators
4. **Responsive Design**: Mobile-friendly interface
5. **Role-based Access**: Different permissions for users and admins
6. **Email Integration**: Invitation system for meeting participants

## File Organization Principles

- **Separation of Concerns**: Clear separation between UI components, business logic, and data
- **Component Reusability**: Modular component structure for maintainability
- **Type Safety**: Comprehensive TypeScript types throughout the application
- **API-First Design**: RESTful API structure with clear endpoint organization
- **Database Abstraction**: Prisma ORM for type-safe database operations

This structure follows Next.js best practices and provides a scalable foundation for the interpreter booking system.
