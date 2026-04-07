import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const cowSchema = z.object({
  name: z.string().min(1, 'Nama sapi wajib diisi'),
})

export async function GET(request: Request) {
  try {
    const user = verifyToken(request) as any
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cows = await prisma.cows.findMany({
      where: { farmerId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return Response.json({ success: true, data: cows })
  } catch (error) {
    console.error('GET /api/cows error:', error)
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
    const validation = cowSchema.safeParse(body)

    if (!validation.success) {
      return Response.json(
        { error: 'Nama sapi wajib diisi' },
        { status: 400 }
      )
    }

    const cow = await prisma.cows.create({
      data: {
        name: validation.data.name,
        farmerId: user.id
      }
    })

    return Response.json({ success: true, data: cow }, { status: 201 })
  } catch (error) {
    console.error('POST /api/cows error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
