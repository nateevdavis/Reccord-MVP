import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createSession } from '@/lib/auth'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required'),
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(
      /^[a-z0-9-]+$/,
      'Username must be lowercase, alphanumeric, and may contain hyphens'
    ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = signupSchema.parse(body)

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: validated.email },
    })
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: validated.username },
    })
    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      )
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(validated.password)
    
    console.log('Creating user with data:', {
      email: validated.email,
      username: validated.username,
      displayName: validated.displayName,
    })
    
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        displayName: validated.displayName,
        username: validated.username,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
      },
    })

    console.log('User created successfully:', user.id)

    // Create session
    try {
      await createSession(user.id)
      console.log('Session created successfully')
    } catch (sessionError) {
      console.error('Error creating session (but user was created):', sessionError)
      // Don't fail the request if session creation fails - user is already created
    }

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error during signup:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: `Failed to create account: ${errorMessage}` },
      { status: 500 }
    )
  }
}

