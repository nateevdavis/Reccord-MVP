import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { stripe, getOrCreateStripeCustomer, PLATFORM_FEE_CENTS } from '@/lib/stripe'

function getBaseUrl(request: NextRequest): string {
  // Check for forwarded protocol headers (for proxies/tunnels like ngrok)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host') || request.nextUrl.host
  
  // Determine protocol - prioritize forwarded-proto header
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
    const body = await request.json()
    const { listId } = body

    if (!listId) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 })
    }

    const list = await prisma.list.findUnique({
      where: { id: listId },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.priceCents === 0) {
      return NextResponse.json({ error: 'This list is free' }, { status: 400 })
    }

    // Check if user already subscribed
    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        userId_listId: {
          userId,
          listId,
        },
      },
    })

    if (existingSubscription) {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(userId)

    // Calculate total amount (list price + platform fee)
    const totalAmountCents = list.priceCents + PLATFORM_FEE_CENTS

    // Create Stripe Checkout Session for recurring subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: list.name,
              description: list.description || undefined,
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: list.priceCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Platform Fee',
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: PLATFORM_FEE_CENTS,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        listId,
      },
      success_url: `${getBaseUrl(request)}/lists/${list.slug}?success=true`,
      cancel_url: `${getBaseUrl(request)}/lists/${list.slug}?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

