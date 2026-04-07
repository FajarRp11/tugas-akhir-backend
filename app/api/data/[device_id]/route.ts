import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ device_id: string }> }
) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { device_id } = await params

    // Pengecekan data sensor sekaligus kepemilikan
    const data = await prisma.sensor_readings.findMany({
      where: {
        deviceId: device_id,
        device: {
          cow: {
            farmerId: user.id
          }
        }
      },
      include: {
        device: {
          select: {
            cow: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return Response.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/data/[device_id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
