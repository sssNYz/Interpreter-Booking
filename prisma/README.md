# Prisma Seed Data

This directory contains the seed file for populating the database with initial data.

## How to Run the Seed

1. Make sure your database is set up and running
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Run the seed script:
   ```bash
   npm run seed
   ```

## What Data is Seeded

The seed script will insert:

- **Languages**: Thai (TH), Japanese (JP), English (EN), Chinese (ZH), Hindi (HI)
- **Employees**: 51 employees with different departments (AAAA, BBBB, CCCC, DDDD, EEEE)
- **Environments**: Chan 3, Chan 4, Chan Rak Ter
- **Environment Centers**: Links environments to department centers
- **Environment Admins**: Assigns admin users to environments
- **Environment Interpreters**: Assigns interpreter users to environments
- **Interpreter Languages**: Links interpreters to their language skills
- **User Roles**: Assigns ADMIN, INTERPRETER, and SUPER_ADMIN roles

## Important Notes

- The seed script will **delete existing data** before inserting new data
- Make sure to backup your database if you have important data
- The script uses the employee ID 161 (Sunny Jojo) as SUPER_ADMIN
- All other users have either ADMIN or INTERPRETER roles based on the provided data

## Data Structure

The seed follows the relationships defined in the Prisma schema:
- Employees can have multiple roles
- Interpreters can speak multiple languages
- Environments have admins and interpreters
- Centers are linked to environments
