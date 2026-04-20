import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
})

const resetPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  token: z.string().min(1, 'Token wajib diisi'),
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { email } = validation.data

    // 1. Cek apakah peternak terdaftar
    const farmer = await prisma.farmers.findUnique({
      where: { email }
    })

    if (!farmer) {
      return Response.json({ error: 'Email tidak ditemukan' }, { status: 404 })
    }

    // 2. Generate raw token (long string for redirect)
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 Menit

    // 3. Simpan/Upsert ke password_resets
    await prisma.password_resets.upsert({
      where: { email },
      update: {
        token: hashedToken,
        expiresAt
      },
      create: {
        email,
        token: hashedToken,
        expiresAt
      }
    })

    // 4. Kirim email via Resend
    // Catatan: Tautkan URL kembali ke frontend aplikasi (Redirect Link)
    // Asumsi alamat aplikasi mobile/web didefinisikan di ENV atau hardcoded untuk demo ini
    const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL
    const resetUrl = `${NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}&email=${email}`

    const { error } = await resend.emails.send({
      from: 'Cow Monitoring <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset Password Akun Sapi Tracking',
      html: `
        <h1>Lupa Password?</h1>
        <p>Halo ${farmer.name},</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
        <p>Klik tombol di bawah ini untuk mengatur ulang password Anda:</p>
        <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        <p>Atau copy-paste link berikut ke browser Anda:</p>
        <p>${resetUrl}</p>
        <p>Link ini akan kedaluwarsa dalam <strong>15 menit</strong>.</p>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return Response.json({ error: 'Gagal mengirim email' }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Link reset password telah dikirim ke email'
    })

  } catch (error) {
    console.error('Forgot password request error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { email, token, newPassword } = validation.data

    // 1. Cari record reset
    const resetEntry = await prisma.password_resets.findUnique({
      where: { email }
    })

    if (!resetEntry) {
      return Response.json({ error: 'Permintaan reset tidak ditemukan' }, { status: 404 })
    }

    // 2. Validasi Expiry
    if (resetEntry.expiresAt < new Date()) {
      await prisma.password_resets.delete({ where: { email } })
      return Response.json({ error: 'Link sudah kedaluwarsa' }, { status: 400 })
    }

    // 3. Validasi Token (Hash)
    const hashedProvidedToken = crypto.createHash('sha256').update(token).digest('hex')
    if (hashedProvidedToken !== resetEntry.token) {
      return Response.json({ error: 'Token tidak valid' }, { status: 400 })
    }

    // 4. Update Password (Bcrypt)
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.farmers.update({
      where: { email },
      data: { password: hashedPassword }
    })

    // 5. Bersihkan record reset
    await prisma.password_resets.delete({
      where: { email }
    })

    return Response.json({
      success: true,
      message: 'Password berhasil direset'
    })

  } catch (error) {
    console.error('Forgot password reset error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
