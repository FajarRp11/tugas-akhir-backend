import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import pusher from '@/lib/pusher'

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await prisma.sensor_readings.findMany({
      where: {
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
    console.error('GET /api/data error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Validasi API key dari ESP32
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.ESP32_API_KEY) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      device_id,
      reading_id,
      temperature,
      heart_rate,
      spo2,
      latitude,
      longitude,
      rssi
    } = body

    // Validasi field wajib
    if (!device_id) {
      return Response.json(
        { error: 'device_id wajib diisi' },
        { status: 400 }
      )
    }

    // Cek device terdaftar di DB
    const device = await prisma.devices.findUnique({
      where: { deviceId: device_id },
      include: {
        cow: true
      }
    })

    if (!device) {
      return Response.json(
        { error: 'Device tidak terdaftar' },
        { status: 404 }
      )
    }

    if (!device.isActive) {
      return Response.json(
        { error: 'Device tidak aktif' },
        { status: 403 }
      )
    }

    // Insert data sensor
    const data = await prisma.sensor_readings.create({
      data: {
        deviceId:    device_id,
        readingId:   reading_id ? parseInt(reading_id) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        heartRate:   heart_rate ? parseFloat(heart_rate) : null,
        spo2:        spo2 ? parseFloat(spo2) : null,
        latitude:    latitude ? parseFloat(latitude) : null,
        longitude:   longitude ? parseFloat(longitude) : null,
        rssi:        rssi ? parseInt(rssi) : null,
      }
    })

    // Trigger Pusher ke channel peternak yang sesuai
    if (device.cow?.farmerId) {
      await pusher.trigger(
        `farmer-${device.cow.farmerId}`,
        'new-sensor-reading',
        data
      )
    }

    return Response.json(
      { success: true, data },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}