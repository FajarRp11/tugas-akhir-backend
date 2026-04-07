import jwt from 'jsonwebtoken'

export function verifyToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is not defined')
    return null
  }

  try {
    const token = authHeader.split(' ')[1]
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}