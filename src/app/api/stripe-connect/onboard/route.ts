import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

function getBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host') || request.nextUrl.host
  
  let protocol = 'https:'
  if (forwardedProto) {
    protocol = forwardedProto === 'https' ? 'https:' : 'http:'
  } else if (request.nextUrl.protocol) {
    protocol = request.nextUrl.protocol
  }
  
  return `${protocol}//${host}`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()

    // Check if user already has a Stripe Connect account
    const existingAccount = await prisma.stripeConnectAccount.findUnique({
      where: { userId },
    })

    let accountId: string

    if (existingAccount) {
      accountId = existingAccount.stripeAccountId
    } else {
      // Get user info to create Express account
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, displayName: true },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Create Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // You may want to make this configurable
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          userId,
        },
      })

      accountId = account.id

      // Store account in database
      await prisma.stripeConnectAccount.create({
        data: {
          userId,
          stripeAccountId: accountId,
          onboardingStatus: 'pending',
        },
      })
    }

    // Create account link for onboarding
    const baseUrl = getBaseUrl(request)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/create?stripe_connect_refresh=1`,
      return_url: `${baseUrl}/create?stripe_connect_success=1`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating Stripe Connect onboarding:', error)
    return NextResponse.json(
      { error: 'Failed to create onboarding link' },
      { status: 500 }
    )
  }
}

