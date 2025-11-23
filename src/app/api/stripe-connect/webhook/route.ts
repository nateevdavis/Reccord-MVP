import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// Prevent Next.js from redirecting this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  // Use the same webhook secret or a separate one for Connect webhooks
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // Handle account.updated events
    if (event.type === 'account.updated') {
      const account = event.data.object as any

      console.log('Processing account.updated:', {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
      })

      // Find account in database
      const dbAccount = await prisma.stripeConnectAccount.findUnique({
        where: { stripeAccountId: account.id },
      })

      if (dbAccount) {
        // Determine status based on Stripe account state
        let status = 'pending'
        if (account.charges_enabled && account.details_submitted) {
          status = 'active'
        } else if (account.details_submitted) {
          status = 'pending'
        } else if (account.requirements?.currently_due?.length > 0) {
          status = 'restricted'
        }

        // Update account status
        await prisma.stripeConnectAccount.update({
          where: { id: dbAccount.id },
          data: { onboardingStatus: status },
        })

        console.log('Updated Stripe Connect account status:', {
          accountId: account.id,
          status,
        })
      } else {
        console.warn('Stripe Connect account not found in database:', account.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing Stripe Connect webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

