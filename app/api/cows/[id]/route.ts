import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const cowSchema = z.object({
  name: z.string().min(1, 'Nama sapi wajib diisi'),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const cowId = parseInt(id)

    if (isNaN(cowId)) {
      return Response.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const body = await request.json()
    const validation = cowSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: 'Nama sapi wajib diisi' },
        { status: 400 }
      )
    }

    // Cek kepemilikan sapi
    const existingCow = await prisma.cows.findFirst({
      where: {
        id: cowId,
        farmerId: user.id
      }
    })

    if (!existingCow) {
      return Response.json({ error: 'Sapi tidak ditemukan' }, { status: 404 })
    }

    const updatedCow = await prisma.cows.update({
      where: { id: cowId },
      data: { name: validation.data.name }
    })

    return Response.json({ success: true, data: updatedCow })
  } catch (error) {
    console.error('PUT /api/cows/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const cowId = parseInt(id)

    if (isNaN(cowId)) {
      return Response.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    // Cek kepemilikan sapi
    const existingCow = await prisma.cows.findFirst({
      where: {
        id: cowId,
        farmerId: user.id
      }
    })

    if (!existingCow) {
      return Response.json({ error: 'Sapi tidak ditemukan' }, { status: 404 })
    }

    await prisma.cows.delete({
      where: { id: cowId }
    })

    return Response.json({ success: true, message: 'Sapi berhasil dihapus' })
  } catch (error) {
    console.error('DELETE /api/cows/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
