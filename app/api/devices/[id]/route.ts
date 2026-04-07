import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const deviceUpdateSchema = z.object({
  cowId: z.number().optional(),
  isActive: z.boolean().optional()
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
    const idInt = parseInt(id)

    if (isNaN(idInt)) {
      return Response.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const body = await request.json()
    const validation = deviceUpdateSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // 1. Cek kepemilikan device saat ini (Device -> Cow -> Farmer)
    const existingDevice = await prisma.devices.findFirst({
      where: {
        id: idInt,
        cow: {
          farmerId: user.id
        }
      }
    })

    if (!existingDevice) {
      return Response.json({ error: 'Device tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    const { cowId, isActive } = validation.data

    // 2. Jika mengganti cowId, pastikan sapi baru juga milik peternak ini
    if (cowId !== undefined && cowId !== existingDevice.cowId) {
      const cow = await prisma.cows.findFirst({
        where: {
          id: cowId,
          farmerId: user.id
        }
      })

      if (!cow) {
        return Response.json({ error: 'Sapi baru tidak ditemukan atau bukan milik Anda' }, { status: 403 })
      }
    }

    // 3. Update device
    const updatedDevice = await prisma.devices.update({
      where: { id: idInt },
      data: {
        cowId: cowId !== undefined ? cowId : existingDevice.cowId,
        isActive: isActive !== undefined ? isActive : existingDevice.isActive
      }
    })

    return Response.json({ success: true, data: updatedDevice })
  } catch (error) {
    console.error('PUT /api/devices/[id] error:', error)
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
    const idInt = parseInt(id)

    if (isNaN(idInt)) {
      return Response.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    // 1. Cek kepemilikan device (Device -> Cow -> Farmer)
    const existingDevice = await prisma.devices.findFirst({
      where: {
        id: idInt,
        cow: {
          farmerId: user.id
        }
      }
    })

    if (!existingDevice) {
      return Response.json({ error: 'Device tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    // 2. Hapus device
    await prisma.devices.delete({
      where: { id: idInt }
    })

    return Response.json({ success: true, message: 'Device berhasil dihapus' })

  } catch (error) {
    console.error('DELETE /api/devices/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
