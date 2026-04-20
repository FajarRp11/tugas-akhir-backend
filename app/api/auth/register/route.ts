import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(1, 'Name wajib diisi'),
  email: z.email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter')
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validasi pakai Zod
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return Response.json(
        { error: z.treeifyError(validation.error) },
        { status: 400 }
      )
    }

    const { name, email, password } = validation.data

    // Cek email sudah terdaftar
    const existingFarmer = await prisma.farmers.findUnique({
      where: { email }
    })
    if (existingFarmer) {
      return Response.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Simpan ke DB
    const farmer = await prisma.farmers.create({
      data: { name, email, password: hashedPassword }
    })

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
    }, { status: 201 })

  } catch (error) {
    console.error('Register error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}