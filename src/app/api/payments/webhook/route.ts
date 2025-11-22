import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, PLATFORM_FEE_CENTS } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// Prevent Next.js from redirecting this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET handler for testing webhook endpoint accessibility
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Webhook endpoint is accessible',
    url: request.url,
    method: request.method,
  })
}

export async function POST(request: NextRequest) {
  // Log request details immediately
  console.log('Webhook received:', {
    url: request.url,
    method: request.method,
    headers: {
      host: request.headers.get('host'),
      'user-agent': request.headers.get('user-agent'),
      'content-type': request.headers.get('content-type'),
    },
  })

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // Handle checkout.session.completed for initial subscription
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any

      console.log('Processing checkout.session.completed:', {
        sessionId: session.id,
        mode: session.mode,
        metadata: session.metadata,
        subscription: session.subscription,
        amountTotal: session.amount_total,
      })

      const userId = session.metadata?.userId
      const listId = session.metadata?.listId

      if (!userId || !listId) {
        console.error('Missing metadata in checkout session:', {
          userId,
          listId,
          metadata: session.metadata,
        })
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      // Get subscription ID from session
      const subscriptionId = session.subscription

      if (!subscriptionId) {
        console.error('No subscription ID in session:', {
          sessionId: session.id,
          mode: session.mode,
        })
        return NextResponse.json({ error: 'No subscription ID' }, { status: 400 })
      }

      try {
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        
        // Use session amount_total if available, otherwise calculate from subscription items
        const totalAmount = session.amount_total || subscription.items.data.reduce(
          (sum, item) => sum + (item.price.unit_amount || 0) * (item.quantity || 1),
          0
        )
        const platformFeeCents = PLATFORM_FEE_CENTS

        // Create or update subscription first
        const dbSubscription = await prisma.subscription.upsert({
          where: {
            userId_listId: {
              userId,
              listId,
            },
          },
          create: {
            userId,
            listId,
            stripeSubscriptionId: subscriptionId,
          },
          update: {
            stripeSubscriptionId: subscriptionId,
          },
        })

        // Check if payment already exists to avoid duplicates
        const existingPayment = await prisma.payment.findFirst({
          where: {
            subscriptionId: dbSubscription.id,
            stripeSubscriptionId: subscriptionId,
            createdAt: {
              gte: new Date(Date.now() - 60000), // Within last minute
            },
          },
        })

        if (!existingPayment) {
          // Create payment record and link to subscription
          const payment = await prisma.payment.create({
            data: {
              userId,
              listId,
              subscriptionId: dbSubscription.id,
              stripeSubscriptionId: subscriptionId,
              amountCents: totalAmount,
              platformFeeCents,
              status: 'COMPLETED',
            },
          })

          console.log('Successfully created subscription and payment:', {
            subscriptionId: dbSubscription.id,
            paymentId: payment.id,
            amountCents: totalAmount,
          })
        } else {
          console.log('Payment already exists for this subscription, skipping duplicate')
        }
      } catch (subscriptionError) {
        console.error('Error processing subscription:', subscriptionError)
        throw subscriptionError
      }
    }

    // Handle subscription updates (renewals, cancellations, etc.)
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any

      // Find subscription by Stripe subscription ID
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      })

      if (dbSubscription && event.type === 'customer.subscription.deleted') {
        // Subscription was canceled - we might want to mark it as inactive
        // For now, we'll leave it as is since the user still has access until period ends
        // You could add an `active` field to Subscription if needed
      }
    }

    // Handle invoice.payment_succeeded for recurring payments
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any

      console.log('Processing invoice.payment_succeeded:', {
        invoiceId: invoice.id,
        subscription: invoice.subscription,
        amountPaid: invoice.amount_paid,
        billingReason: invoice.billing_reason,
      })

      if (invoice.subscription) {
        const dbSubscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription },
        })

        if (dbSubscription) {
          // Check if payment already exists to avoid duplicates
          const existingPayment = await prisma.payment.findFirst({
            where: {
              subscriptionId: dbSubscription.id,
              amountCents: invoice.amount_paid,
              createdAt: {
                gte: new Date(Date.now() - 60000), // Within last minute
              },
            },
          })

          if (!existingPayment) {
            // Create payment record for recurring payment
            const totalAmount = invoice.amount_paid
            const platformFeeCents = PLATFORM_FEE_CENTS

            await prisma.payment.create({
              data: {
                userId: dbSubscription.userId,
                listId: dbSubscription.listId,
                subscriptionId: dbSubscription.id,
                stripeSubscriptionId: invoice.subscription,
                amountCents: totalAmount,
                platformFeeCents,
                status: 'COMPLETED',
              },
            })

            console.log('Created payment from invoice.payment_succeeded:', {
              subscriptionId: dbSubscription.id,
              amountCents: totalAmount,
            })
          } else {
            console.log('Payment already exists, skipping duplicate')
          }
        } else {
          console.warn('Subscription not found for invoice.payment_succeeded:', {
            invoiceId: invoice.id,
            subscriptionId: invoice.subscription,
            billingReason: invoice.billing_reason,
          })
          // If this is the initial invoice and subscription doesn't exist yet,
          // checkout.session.completed should create it. We'll just log a warning.
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

