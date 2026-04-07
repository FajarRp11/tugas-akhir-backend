import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validasi field wajib
    if (!email || !password) {
      return Response.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

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