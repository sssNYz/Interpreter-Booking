import fs from 'fs'
import path from 'path'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { SendMailOptions } from 'nodemailer'

export function ensureOutbox(): string {
  const outDir = path.resolve(process.cwd(), 'outbox')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  return outDir
}

export async function saveEml(mailOptions: SendMailOptions, filenamePrefix: string): Promise<string> {
  const outDir = ensureOutbox()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${filenamePrefix}-${timestamp}.eml`
  const filePath = path.join(outDir, filename)

  const composer = new MailComposer(mailOptions as Record<string, unknown>)
  const stream = composer.compile().createReadStream()

  await new Promise<void>((resolve, reject) => {
    const write = fs.createWriteStream(filePath)
    stream.pipe(write)
    write.on('finish', () => resolve())
    write.on('error', err => reject(err))
  })

  return filePath
}


