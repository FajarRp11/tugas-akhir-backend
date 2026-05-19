import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Range normal sapi
const NORMAL_RANGE = {
  temperature: { min: 30.0, max: 37.0 },
  heartRate: { min: 60, max: 80 },
  spo2: { min: 95, max: 100 },
}

function isAnomaly(reading: any): boolean {
  const temp = reading.temperature ? parseFloat(reading.temperature.toString()) : null
  const hr = reading.heartRate ? parseFloat(reading.heartRate.toString()) : null
  const spo2 = reading.spo2 ? parseFloat(reading.spo2.toString()) : null

  return (
    (temp !== null && (temp < NORMAL_RANGE.temperature.min || temp > NORMAL_RANGE.temperature.max)) ||
    (hr !== null && (hr < NORMAL_RANGE.heartRate.min || hr > NORMAL_RANGE.heartRate.max)) ||
    (spo2 !== null && (spo2 < NORMAL_RANGE.spo2.min || spo2 > NORMAL_RANGE.spo2.max))
  )
}

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') // 'history' | null

    // ==========================================
    // MODE HISTORY: Semua anomali 7 hari terakhir (untuk Notifikasi)
    // ==========================================
    if (mode === 'history') {
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
        take: 50,
      })

      const anomalies = readings.map((reading) => ({
        ...reading,
        temperature: reading.temperature ? parseFloat(reading.temperature.toString()) : null,
        heartRate: reading.heartRate ? parseFloat(reading.heartRate.toString()) : null,
        spo2: reading.spo2 ? parseFloat(reading.spo2.toString()) : null,
        latitude: reading.latitude ? parseFloat(reading.latitude.toString()) : null,
        longitude: reading.longitude ? parseFloat(reading.longitude.toString()) : null,
      }))

      return Response.json({ success: true, data: anomalies })
    }

    // ==========================================
    // MODE DEFAULT: Hanya 1 reading terbaru per device, tampil hanya jika anomali (untuk Beranda)
    // ==========================================
    const devices = await prisma.devices.findMany({
      where: {
        cow: {
          farmerId: user.id,
        },
      },
      select: {
        deviceId: true,
        cowId: true,
        cow: {
          select: { name: true },
        },
        sensorReadings: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const seen = new Set<number | null>()
    const anomalies = devices
      .filter((device) => {
        const reading = device.sensorReadings[0]
        if (!reading) return false
        if (!isAnomaly(reading)) return false
        if (seen.has(device.cowId)) return false
        seen.add(device.cowId)
        return true
      })
      .map((device) => ({
        ...device.sensorReadings[0],
        temperature: device.sensorReadings[0].temperature ? parseFloat(device.sensorReadings[0].temperature.toString()) : null,
        heartRate: device.sensorReadings[0].heartRate ? parseFloat(device.sensorReadings[0].heartRate.toString()) : null,
        spo2: device.sensorReadings[0].spo2 ? parseFloat(device.sensorReadings[0].spo2.toString()) : null,
        latitude: device.sensorReadings[0].latitude ? parseFloat(device.sensorReadings[0].latitude.toString()) : null,
        longitude: device.sensorReadings[0].longitude ? parseFloat(device.sensorReadings[0].longitude.toString()) : null,
        device: {
          deviceId: device.deviceId,
          cowId: device.cowId,
          cow: device.cow,
        },
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return Response.json({ success: true, data: anomalies })
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

