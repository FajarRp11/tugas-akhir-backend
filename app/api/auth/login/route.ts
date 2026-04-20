import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter')
})

export const POST = async (request: Request) => {
  try {
    const body = await request.json()

    // Validasi pakai Zod
    const validation = LoginSchema.safeParse(body)
    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Cek email terdaftar
    const farmer = await prisma.farmers.findUnique({
      where: { email }
    })

    if (!farmer) {
      return Response.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Cek password
    const isPasswordValid = await bcrypt.compare(password, farmer.password)
    if (!isPasswordValid) {
      return Response.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Generate token
    const token = generateToken({
      id: farmer.id,
      email: farmer.email,
      name: farmer.name
    })



    return Response.json({
      success: true,
      data: {
        id: farmer.id,
        name: farmer.name,
        email: farmer.email,
        token
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

(POST as any).apiDoc = {
  summary: "Login user",
  tags: ["Auth"],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              example: "user@email.com",
            },
            password: {
              type: "string",
              example: "password123",
            },
          },
        },
      },
    },
  },
};