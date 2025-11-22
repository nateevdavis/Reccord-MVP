# Supabase Connection Troubleshooting

## Current Issue: Can't reach database server

### Step 1: Verify Supabase Project Status

1. Go to https://supabase.com/dashboard
2. Check if your project shows as **"Active"** (not paused)
3. If paused, click "Restore" to activate it
4. Wait a few minutes for the database to fully start

### Step 2: Get the Correct Connection String

**Option A: Direct Connection (Port 5432)**

1. Go to Supabase Dashboard > Settings > Database
2. Scroll to "Connection string" section
3. Select "URI" format
4. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   OR
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

**Option B: Connection Pooler (Port 6543) - RECOMMENDED**

1. Go to Supabase Dashboard > Settings > Database > Connection Pooling
2. Select "Session" mode
3. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

### Step 3: Update Your .env File

Replace your `DATABASE_URL` with the exact connection string from Supabase dashboard.

**Important Notes:**
- Use the **exact** format provided by Supabase (don't modify it)
- If the password contains special characters, they should already be URL-encoded
- For direct connection, add `?sslmode=require` if not already included
- Connection pooler already handles SSL

### Step 4: Check IP Restrictions

1. Go to Supabase Dashboard > Settings > Database
2. Check "Connection Pooling" > "Allowed IP addresses"
3. Make sure your IP is allowed, or set to "Allow all" for testing

### Step 5: Test Connection

Try connecting with psql (if installed):
```bash
psql "your-connection-string-here"
```

Or test with Prisma:
```bash
npx prisma migrate deploy
```

## Common Issues

### Issue: "Can't reach database server"
- **Solution**: Database might be paused - restore it in dashboard
- **Solution**: Use connection pooler instead of direct connection
- **Solution**: Check IP restrictions in Supabase settings

### Issue: "SSL required"
- **Solution**: Add `?sslmode=require` to direct connection string
- **Solution**: Use connection pooler (handles SSL automatically)

### Issue: "Authentication failed"
- **Solution**: Verify password is correct (reset in Supabase settings if needed)
- **Solution**: Make sure you're using the password from Settings > Database, not your account password

### Issue: "Connection timeout"
- **Solution**: Check your internet connection
- **Solution**: Try connection pooler (more reliable)
- **Solution**: Verify database is not paused

## Recommended: Use Connection Pooler

For production and better reliability, always use the connection pooler:
- Port: **6543** (not 5432)
- Includes `?pgbouncer=true` parameter
- Better connection management
- More reliable for serverless environments (like Vercel)

