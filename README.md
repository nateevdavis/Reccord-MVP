# Reccord MVP

A minimal Notion-style web app for creating and sharing curated lists.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **ORM**: Prisma
- **Database**: PostgreSQL (hosted on Supabase)
- **Hosting**: Vercel

## Setup

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase recommended for production)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up your database connection:

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

For Supabase (Production):
- Create a new project on Supabase (supabase.com)
- Go to Settings > Database > Connection string
- Copy the "URI" format connection string
- Paste it as `DATABASE_URL` in your `.env` file
- Note: For production, use Supabase's connection pooler for better performance

3. Generate Prisma Client:

```bash
npm run db:generate
```

4. Run database migrations:

```bash
npm run db:migrate
```

This will create all the necessary tables in your database.

5. Seed the database (optional):

```bash
npm run db:seed
```

This creates a sample user and example lists.

### Local Development

Start the development server:

```bash
npm run dev
```

**Important:** Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser (not localhost:3000).

**Note:** Due to IPv6/localhost resolution issues on macOS, use `127.0.0.1` instead of `localhost` to avoid connection hangs.

## Deployment

### Production Deployment to Vercel with Supabase

#### Prerequisites
- Supabase account and project created
- Vercel account
- GitHub repository
- Domain DNS access (for custom domain)

#### Step 1: Set Up Supabase Database

1. Create a Supabase project at supabase.com
2. Get your database connection string from Settings > Database > Connection string
3. Use the "URI" format: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`
4. Run migrations locally with Supabase connection string:
   ```bash
   DATABASE_URL="your-supabase-connection-string" npx prisma migrate deploy
   ```
5. Verify tables are created in Supabase dashboard

#### Step 2: Configure Vercel Project

1. Push your code to GitHub
2. Import your repository in Vercel (vercel.com)
3. Vercel will auto-detect Next.js framework
4. Set environment variables in Vercel project settings:
   - `DATABASE_URL` - Supabase PostgreSQL connection string
   - `SPOTIFY_CLIENT_ID` - From Spotify Developer Dashboard
   - `SPOTIFY_CLIENT_SECRET` - From Spotify Developer Dashboard
   - `SPOTIFY_REDIRECT_URI` - `https://reccord.co/api/auth/spotify/callback` (or your domain)
   - `STRIPE_SECRET_KEY` - Stripe production secret key
   - `STRIPE_WEBHOOK_SECRET` - Set after webhook endpoint is created (see Step 4)
   - `NODE_ENV` - Automatically set to `production` by Vercel

#### Step 3: Configure Custom Domain

1. In Vercel project settings, go to Domains
2. Add your custom domain (e.g., `reccord.co` and `www.reccord.co`)
3. Configure DNS records as provided by Vercel
4. Wait for DNS propagation and SSL certificate provisioning (automatic)

#### Step 4: Update External Service Configurations

1. **Spotify App Settings:**
   - Go to Spotify Developer Dashboard > Your App > Settings
   - Add redirect URI: `https://reccord.co/api/auth/spotify/callback`
   - Save changes

2. **Stripe Webhook Configuration:**
   - After first deployment, note your webhook endpoint: `https://reccord.co/api/payments/webhook`
   - In Stripe Dashboard > Developers > Webhooks, add endpoint
   - Select events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook signing secret and add as `STRIPE_WEBHOOK_SECRET` in Vercel

#### Step 5: Deploy and Verify

1. Deploy your application (Vercel will build automatically)
2. Verify database connection works
3. Test authentication flows
4. Test Spotify OAuth integration
5. Test Stripe payment flow
6. Verify HTTPS and custom domain are working

### Database Migrations on Production

**Important:** Run migrations on Supabase BEFORE first deployment:

```bash
DATABASE_URL="your-supabase-connection-string" npx prisma migrate deploy
```

The build process automatically generates Prisma Client, but migrations must be run manually.

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── api/         # API routes
│   ├── create/      # Create/edit list page
│   ├── profile/     # User profile page
│   ├── u/           # Public profile views
│   └── lists/       # List detail pages
├── components/      # React components
│   ├── ui/         # Reusable UI components
│   └── Nav.tsx     # Navigation component
└── lib/            # Utilities
    ├── prisma.ts   # Prisma client
    └── constants.ts # App constants (currentUserId)

prisma/
├── schema.prisma   # Database schema
└── seed.ts         # Database seed script
```

## Features

- Create and edit lists with items
- Public/private list visibility
- User profiles with customizable links
- List subscriptions (simulated, no payment)
- Mobile-first, Notion-like UI

## Notes

- Authentication uses session-based auth with bcrypt password hashing
- Stripe integration handles payments and subscriptions
- Spotify integration allows syncing playlists as lists
- Database connection pooling: Use Supabase connection pooler URL for production (format: `postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true`)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Run database migrations (development)
- `npm run db:migrate:deploy` - Run database migrations (production)
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio
