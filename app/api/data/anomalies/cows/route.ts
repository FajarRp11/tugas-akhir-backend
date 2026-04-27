import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Range normal sapi
const NORMAL_RANGE = {
  temperature: { min: 38.0, max: 39.5 },
  heartRate: { min: 60, max: 80 },
  spo2: { min: 95, max: 100 },
}

// Cek apakah sebuah reading termasuk anomali
function isAnomaly(reading: any): boolean {
  const temp = reading.temperature ? parseFloat(reading.temperature) : null
  const hr = reading.heartRate ? parseFloat(reading.heartRate) : null
  const spo2 = reading.spo2 ? parseFloat(reading.spo2) : null

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

    // Ambil semua device milik sapi farmer ini, beserta reading terbaru
    const devices = await prisma.devices.findMany({
      where: {
        cow: {
          farmerId: user.id
        }
      },
      select: {
        deviceId: true,
        cowId: true,
        cow: {
          select: { name: true }
        },
        sensorReadings: {
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    })

    // Filter: hanya ambil device yang reading terbarunya adalah anomali
    // Deduplicate per cowId (jika ada >1 device per sapi)
    const seen = new Set<number | null>()
    const anomalies = devices
      .filter((device) => {
        const reading = device.sensorReadings[0]
        if (!reading) return false
        if (!isAnomaly(reading)) return false
        // Deduplicate by cowId
        if (seen.has(device.cowId)) return false
        seen.add(device.cowId)
        return true
      })
      .map((device) => ({
        ...device.sensorReadings[0],
        device: {
          deviceId: device.deviceId,
          cowId: device.cowId,
          cow: device.cow
        }
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return Response.json({ success: true, data: anomalies })
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}