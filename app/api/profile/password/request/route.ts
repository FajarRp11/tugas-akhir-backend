import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { resend } from '@/lib/resend'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate random token
    const rawToken = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 digits for simplicity in mobile
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Upsert reset entry
    await prisma.password_resets.upsert({
      where: { email: user.email },
      update: {
        token: hashedToken,
        expiresAt: expiresAt
      },
      create: {
        email: user.email,
        token: hashedToken,
        expiresAt: expiresAt
      }
    })

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Cow Monitoring <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Reset Password Sapi Tracking',
      html: `
        <h1>Reset Password</h1>
        <p>Halo ${user.name},</p>
        <p>Anda telah meminta untuk mereset password akun Anda.</p>
        <p>Gunakan kode token berikut untuk melanjutkan:</p>
        <h2 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${rawToken}</h2>
        <p>Kode ini akan kedaluwarsa dalam <strong>5 menit</strong>.</p>
        <p>Jika Anda tidak meminta ini, silakan abaikan email ini.</p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return Response.json({ error: 'Gagal mengirim email' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Token reset password telah dikirim ke email'
    })

  } catch (error) {
    console.error('Password request error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
