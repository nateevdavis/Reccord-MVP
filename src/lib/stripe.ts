import Stripe from 'stripe'
import { prisma } from './prisma'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
})

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  // Check if user already has a Stripe customer
  const existing = await prisma.stripeCustomer.findUnique({
    where: { userId },
  })

  if (existing) {
    return existing.stripeCustomerId
  }

  // Get user info to create customer
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.displayName,
    metadata: {
      userId,
    },
  })

  // Store in database
  await prisma.stripeCustomer.create({
    data: {
      userId,
      stripeCustomerId: customer.id,
    },
  })

  return customer.id
}

export const PLATFORM_FEE_CENTS = 50 // $0.50 platform fee

