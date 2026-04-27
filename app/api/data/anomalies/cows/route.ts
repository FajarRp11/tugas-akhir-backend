import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Range normal sapi
const NORMAL_RANGE = {
  temperature: { min: 38.0, max: 39.5 },
  heartRate: { min: 60, max: 80 },
  spo2: { min: 95, max: 100 },
}

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ambil anomali 7 hari terakhir langsung dari sensor_readings
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const readings = await prisma.sensor_readings.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        device: {
          cow: {
            farmerId: user.id,
          },
        },
        OR: [
          { temperature: { gt: NORMAL_RANGE.temperature.max } },
          { temperature: { lt: NORMAL_RANGE.temperature.min } },
          { heartRate: { gt: NORMAL_RANGE.heartRate.max } },
          { heartRate: { lt: NORMAL_RANGE.heartRate.min } },
          { spo2: { lt: NORMAL_RANGE.spo2.min } },
        ],
      },
      include: {
        device: {
          select: {
            deviceId: true,
            cowId: true,
            cow: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Batasi agar tidak terlalu banyak
    })

    // Format response agar konsisten dengan struktur sebelumnya
    const anomalies = readings.map((reading) => ({
      ...reading,
      temperature: reading.temperature ? parseFloat(reading.temperature.toString()) : null,
      heartRate: reading.heartRate ? parseFloat(reading.heartRate.toString()) : null,
      spo2: reading.spo2 ? parseFloat(reading.spo2.toString()) : null,
      latitude: reading.latitude ? parseFloat(reading.latitude.toString()) : null,
      longitude: reading.longitude ? parseFloat(reading.longitude.toString()) : null,
    }))

    return Response.json({ success: true, data: anomalies })
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}