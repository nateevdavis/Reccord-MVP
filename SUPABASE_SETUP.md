# Supabase Setup Guide

## Step 1: Create Your `.env` File

1. In your project root directory (`/Users/natedavis/Desktop/Reccord-MVP/`), create a file named `.env`
2. Add your Supabase connection string:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.njlxqcbjcbmjslfgrzvu.supabase.co:5432/postgres"
```

**Important:** Replace `[YOUR-PASSWORD]` with your actual Supabase database password.

### Getting Your Password

- Go to Supabase Dashboard > Settings > Database
- Your password is the one you set when creating the project
- If you forgot it, you can reset it in the same settings page

### Example `.env` file:

```env
DATABASE_URL="postgresql://postgres:MySecurePassword123@db.njlxqcbjcbmjslfgrzvu.supabase.co:5432/postgres"
```

## Step 2: About the IPv4 Warning

**The IPv4 warning is safe to ignore** for PostgreSQL connections. Here's why:

- PostgreSQL connections work fine with hostnames (like `db.njlxqcbjcbmjslfgrzvu.supabase.co`)
- The warning appears because some tools prefer IPv4 addresses, but Prisma/PostgreSQL handles hostnames correctly
- Your connection string format is correct

**If you still see issues**, you can use Supabase's **Connection Pooler** instead (recommended for production):

1. Go to Supabase Dashboard > Settings > Database > Connection Pooling
2. Use the "Session" mode connection string (port 6543)
3. Format: `postgresql://postgres:[PASSWORD]@db.njlxqcbjcbmjslfgrzvu.supabase.co:6543/postgres?pgbouncer=true`

## Step 3: Run Migrations

Once your `.env` file is set up with the correct `DATABASE_URL`, run:

```bash
npx prisma migrate deploy
```

This will apply all your database migrations to Supabase.

## Step 4: Verify Tables Created

1. Go to Supabase Dashboard > Table Editor
2. You should see tables like:
   - `users`
   - `lists`
   - `list_items`
   - `subscriptions`
   - `stripe_customers`
   - `payments`
   - `spotify_connections`
   - `spotify_list_configs`

## Troubleshooting

### Connection Refused
- Check that your password is correct (no brackets, just the password)
- Verify the hostname is correct
- Make sure your Supabase project is active (not paused)

### SSL Required
If you get SSL errors, add `?sslmode=require` to your connection string:
```
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.njlxqcbjcbmjslfgrzvu.supabase.co:5432/postgres?sslmode=require"
```

### Using Connection Pooler (Recommended for Production)
For better performance and connection management, use the pooler:
```
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.njlxqcbjcbmjslfgrzvu.supabase.co:6543/postgres?pgbouncer=true"
```

