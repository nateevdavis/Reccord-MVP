# Production Deployment Checklist

Use this checklist to track your progress deploying to Vercel with Supabase.

## Prerequisites

- [ ] Supabase account created
- [ ] Vercel account created
- [ ] GitHub repository ready and pushed
- [ ] Domain reccord.co DNS access
- [ ] Stripe account with production keys
- [ ] Spotify Developer app configured

## Step 1: Set Up Supabase Database

- [ ] Create new Supabase project at supabase.com
- [ ] Copy database connection string from Settings > Database > Connection string
- [ ] Run migrations locally: `DATABASE_URL="your-supabase-url" npx prisma migrate deploy`
- [ ] Verify tables created in Supabase dashboard (Table Editor)

## Step 2: Configure Vercel Project

- [ ] Import GitHub repository to Vercel
- [ ] Verify Vercel auto-detected Next.js framework
- [ ] Set environment variables in Vercel project settings:
  - [ ] `DATABASE_URL` - Supabase PostgreSQL connection string
  - [ ] `SPOTIFY_CLIENT_ID` - From Spotify Developer Dashboard
  - [ ] `SPOTIFY_CLIENT_SECRET` - From Spotify Developer Dashboard
  - [ ] `SPOTIFY_REDIRECT_URI` - `https://reccord.co/api/auth/spotify/callback`
  - [ ] `STRIPE_SECRET_KEY` - Stripe production secret key
  - [ ] `STRIPE_WEBHOOK_SECRET` - (Set after Step 4)
  - [ ] `NODE_ENV` - Automatically set by Vercel

## Step 3: Configure Custom Domain

- [ ] Go to Vercel Project Settings > Domains
- [ ] Add `reccord.co` domain
- [ ] Add `www.reccord.co` domain (optional)
- [ ] Copy DNS records provided by Vercel
- [ ] Configure DNS records in your domain registrar
- [ ] Wait for DNS propagation (check with: `dig reccord.co`)
- [ ] Verify SSL certificate is provisioned (automatic)

## Step 4: Update External Service Configurations

### Spotify
- [ ] Go to Spotify Developer Dashboard > Your App > Settings
- [ ] Add redirect URI: `https://reccord.co/api/auth/spotify/callback`
- [ ] Save changes

### Stripe
- [ ] Deploy application first (to get live webhook URL)
- [ ] Go to Stripe Dashboard > Developers > Webhooks
- [ ] Add endpoint: `https://reccord.co/api/payments/webhook`
- [ ] Select events:
  - [ ] `checkout.session.completed`
  - [ ] `invoice.payment_succeeded`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
- [ ] Copy webhook signing secret
- [ ] Add as `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
- [ ] Redeploy application (if needed)

## Step 5: Post-Deployment Verification

- [ ] Visit `https://reccord.co` - site loads correctly
- [ ] Verify HTTPS is working (green lock icon)
- [ ] Test user registration
- [ ] Test user login
- [ ] Test Spotify OAuth connection flow
- [ ] Test creating a list
- [ ] Test Stripe payment flow (use test mode)
- [ ] Verify Stripe webhook receives events (check Stripe dashboard logs)
- [ ] Check Vercel deployment logs for any errors

## Notes

- Database migrations must be run BEFORE first deployment
- Stripe webhook secret can only be obtained after webhook endpoint is live
- Spotify redirect URI must match exactly (including `https://`)
- Consider using Supabase connection pooler URL for better performance in production
- Environment variables are case-sensitive in Vercel

## Troubleshooting

- **Build fails**: Check Vercel build logs, ensure all environment variables are set
- **Database connection errors**: Verify `DATABASE_URL` is correct, check Supabase project is active
- **Spotify OAuth fails**: Verify redirect URI matches exactly in Spotify dashboard
- **Stripe webhook fails**: Check webhook secret is correct, verify endpoint URL is accessible
- **Domain not working**: Check DNS propagation with `dig` or `nslookup`, wait up to 48 hours

