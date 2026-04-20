import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').optional(),
  email: z.string().email('Format email tidak valid').optional(),
})

export async function PUT(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { name, email } = validation.data

    if (email) {
      const existingFarmer = await prisma.farmers.findUnique({
        where: { email }
      })
      if (existingFarmer && existingFarmer.id !== user.id) {
        return Response.json(
          { error: 'Email sudah terdaftar' },
          { status: 409 }
        )
      }
    }

    const updatedFarmer = await prisma.farmers.update({
      where: { id: user.id },
      data: { name, email },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    return Response.json({
      success: true,
      data: updatedFarmer
    })

  } catch (error) {
    console.error('Update profile error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
