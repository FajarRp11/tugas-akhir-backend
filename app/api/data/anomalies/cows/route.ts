import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Range normal sapi
const NORMAL_RANGE = {
  temperature: { min: '38.0', max: '39.5' },
  heartRate: { min: '60', max: '80' },
  spo2: { min: '95', max: '100' },
}

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const anomalies = await prisma.sensor_readings.findMany({
      where: {
        device: {
          cow: {
            farmerId: user.id
          }
        },
        OR: [
          { temperature: { lt: '38.0' } },
          { temperature: { gt: '39.5' } },
          { heartRate: { lt: '60' } },
          { heartRate: { gt: '80' } },
          { spo2: { lt: '95' } },
          { spo2: { gt: '100' } }
        ]
      },
      include: {
        device: {
          select: {
            deviceId: true,
            cow: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    return Response.json({ success: true, data: anomalies })
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}