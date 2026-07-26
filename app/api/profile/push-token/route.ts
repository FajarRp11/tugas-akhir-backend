import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  pushToken: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return Response.json({ error: 'Invalid data' }, { status: 400 })
    }

    await prisma.farmers.update({
      where: { id: user.id },
      data: { pushToken: validation.data.pushToken }
    })

    console.log("USER:", user);
    console.log("TOKEN SAVED:", validation.data);
    return Response.json({ success: true })
  } catch (error) {
    console.log("ERROR:", error);
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}