import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'

const resetSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
})

export async function PUT(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = resetSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { token, newPassword } = validation.data

    // Find reset record
    const resetEntry = await prisma.password_resets.findUnique({
      where: { email: user.email }
    })

    if (!resetEntry) {
      return Response.json({ error: 'Permintaan reset tidak ditemukan' }, { status: 404 })
    }

    // Check if expired
    if (resetEntry.expiresAt < new Date()) {
       // Optional: Clean up expired entry
       await prisma.password_resets.delete({ where: { id: resetEntry.id } })
       return Response.json({ error: 'Token sudah kedaluwarsa (lebih dari 5 menit)' }, { status: 400 })
    }

    // Verify token
    const hashedProvidedToken = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
    if (hashedProvidedToken !== resetEntry.token) {
      return Response.json({ error: 'Token tidak valid' }, { status: 400 })
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.farmers.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    // Clean up
    await prisma.password_resets.delete({
      where: { id: resetEntry.id }
    })

    return Response.json({
      success: true,
      message: 'Password berhasil diperbarui'
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
