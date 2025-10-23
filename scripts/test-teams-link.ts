import { createTeamsMeeting } from '@/lib/meetings/teams'

async function main() {
  const start = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
  const end = new Date(start.getTime() + 30 * 60 * 1000) // +30 minutes

  const url = await createTeamsMeeting({
    start,
    end,
    subject: 'Test meeting',
    organizerUpn: process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL
  })

  console.log('Join URL:', url || 'null')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})