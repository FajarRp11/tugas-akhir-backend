import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
})

export async function PUT(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = passwordSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { newPassword } = validation.data

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password di database
    await prisma.farmers.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return Response.json({
      success: true,
      message: 'Password berhasil diperbarui'
    })

  } catch (error) {
    console.error('Profile password update error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
