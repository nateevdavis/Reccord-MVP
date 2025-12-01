/**
 * Email utility for sending notifications
 * 
 * Currently uses a simple SMTP approach. For production, consider using:
 * - Resend (resend.com) - recommended for Next.js
 * - SendGrid
 * - AWS SES
 * - Postmark
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, html, text } = options

  // Check if email is configured
  const emailFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL
  const emailApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY

  if (!emailFrom) {
    console.warn('Email not configured: EMAIL_FROM or RESEND_FROM_EMAIL not set. Skipping email send.')
    console.log('Would send email:', { to, subject })
    return
  }

  // Try Resend first (recommended for production)
  if (process.env.RESEND_API_KEY) {
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
        }),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.text()
        throw new Error(`Resend API error: ${error}`)
      }

      const result = await resendResponse.json()
      console.log('Email sent via Resend:', result.id)
      return
    } catch (error) {
      console.error('Error sending email via Resend:', error)
      // Fall through to try other methods or log
    }
  }

  // Fallback: Log email (for development)
  if (process.env.NODE_ENV === 'development') {
    console.log('=== EMAIL (Development Mode) ===')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('HTML:', html)
    console.log('===============================')
    return
  }

  // If we get here and it's production, log an error
  console.error('Email sending failed: No email service configured')
  throw new Error('Email service not configured')
}

export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`
}

export async function sendPriceChangeNotification(
  subscriberEmail: string,
  listName: string,
  oldPriceCents: number,
  newPriceCents: number,
  listSlug: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  
  const listUrl = `${baseUrl}/lists/${listSlug}`
  
  const oldPrice = formatPrice(oldPriceCents)
  const newPrice = formatPrice(newPriceCents)
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111; margin-bottom: 20px;">Price Update for "${listName}"</h1>
        
        <p>Hello,</p>
        
        <p>The subscription price for <strong>"${listName}"</strong> has been updated.</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #111; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Previous price:</strong> ${oldPrice}/month</p>
          <p style="margin: 10px 0 0 0;"><strong>New price:</strong> ${newPrice}/month</p>
        </div>
        
        <p>This change will take effect on your next billing cycle. If you have any questions, please don't hesitate to reach out.</p>
        
        <p style="margin-top: 30px;">
          <a href="${listUrl}" style="display: inline-block; background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View List</a>
        </p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Best regards,<br>
          The Reccord Team
        </p>
      </body>
    </html>
  `
  
  const text = `
Price Update for "${listName}"

Hello,

The subscription price for "${listName}" has been updated.

Previous price: ${oldPrice}/month
New price: ${newPrice}/month

This change will take effect on your next billing cycle. If you have any questions, please don't hesitate to reach out.

View the list: ${listUrl}

Best regards,
The Reccord Team
  `.trim()

  await sendEmail({
    to: subscriberEmail,
    subject: `Price Update: ${listName}`,
    html,
    text,
  })
}

