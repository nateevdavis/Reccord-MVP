import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()

    const account = await prisma.stripeConnectAccount.findUnique({
      where: { userId },
    })

    if (!account) {
      return NextResponse.json({
        connected: false,
        status: 'not_connected',
      })
    }

    // Fetch account details from Stripe to get current status
    try {
      const stripeAccount = await stripe.accounts.retrieve(account.stripeAccountId)
      
      // Update status in database if it changed
      const currentStatus = stripeAccount.details_submitted && stripeAccount.charges_enabled
        ? 'active'
        : stripeAccount.details_submitted
        ? 'pending'
        : 'pending'

      if (account.onboardingStatus !== currentStatus) {
        await prisma.stripeConnectAccount.update({
          where: { id: account.id },
          data: { onboardingStatus: currentStatus },
        })
      }

      return NextResponse.json({
        connected: true,
        status: currentStatus,
        chargesEnabled: stripeAccount.charges_enabled || false,
        detailsSubmitted: stripeAccount.details_submitted || false,
      })
    } catch (stripeError) {
      // If account doesn't exist in Stripe, mark as not connected
      console.error('Error fetching Stripe account:', stripeError)
      return NextResponse.json({
        connected: false,
        status: 'error',
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error checking Stripe Connect status:', error)
    return NextResponse.json({
      connected: false,
      status: 'error',
    })
  }
}

