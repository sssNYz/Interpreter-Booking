import prisma from '@/prisma/prisma'
import { getEnvironmentIdForBooking } from '@/lib/assignment/scheduler/compute'

export async function getAdminEmailsForEnvironment(environmentId: number): Promise<string[]> {
  if (!Number.isFinite(environmentId)) return []
  const links = await prisma.environmentAdmin.findMany({
    where: { environmentId },
    select: { admin: { select: { email: true } } }
  })
  return links
    .map(l => l.admin?.email?.trim().toLowerCase())
    .filter((e): e is string => !!e)
}

export async function getRoleBasedAdminEmails(): Promise<string[]> {
  // Get all users with ADMIN or SUPER_ADMIN roles
  const adminUsers = await prisma.userRole.findMany({
    where: {
      roleCode: {
        in: ['ADMIN', 'SUPER_ADMIN']
      }
    },
    select: {
      employee: {
        select: { email: true }
      }
    }
  })
  return adminUsers
    .map(u => u.employee?.email?.trim().toLowerCase())
    .filter((e): e is string => !!e)
}

export async function getAdminEmailsForBooking(bookingId: number): Promise<string[]> {
  if (!Number.isFinite(bookingId)) return []
  
  // Get environment-specific admins
  const envId = await getEnvironmentIdForBooking(bookingId)
  const envAdmins = envId ? await getAdminEmailsForEnvironment(envId) : []
  
  // Get role-based admins (ADMIN and SUPER_ADMIN)
  const roleAdmins = await getRoleBasedAdminEmails()
  
  // Combine and deduplicate (case-insensitive)
  const allAdmins = new Set<string>([...envAdmins, ...roleAdmins])
  return Array.from(allAdmins)
}
