import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const deviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID wajib diisi'),
  cowId: z.number({ error: (issue) => issue.input === undefined 
    ? "ID Sapi wajib diisi" 
    : "ID Sapi harus berupa angka" 
  }),
  isActive: z.boolean().default(true)
})

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ambil semua device yang terhubung ke sapi milik peternak ini
    const devices = await prisma.devices.findMany({
      where: {
        cow: {
          farmerId: user.id
        }
      },
      include: {
        cow: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return Response.json({ success: true, data: devices })
  } catch (error) {
    console.error('GET /api/devices error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = deviceSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { deviceId, cowId, isActive } = validation.data

    // 1. Cek apakah sapi tersebut milik peternak yang login
    const cow = await prisma.cows.findFirst({
      where: {
        id: cowId,
        farmerId: user.id
      }
    })

    if (!cow) {
      return Response.json({ error: 'Sapi tidak ditemukan atau bukan milik Anda' }, { status: 403 })
    }

    // 2. Cek apakah deviceId sudah terdaftar
    const existingDevice = await prisma.devices.findUnique({
      where: { deviceId }
    })

    if (existingDevice) {
      return Response.json({ error: 'Device ID sudah terdaftar' }, { status: 409 })
    }

    // 3. Simpan device baru
    const device = await prisma.devices.create({
      data: {
        deviceId,
        cowId,
        isActive
      }
    })

    return Response.json({ success: true, data: device }, { status: 201 })
  } catch (error) {
    console.error('POST /api/devices error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
