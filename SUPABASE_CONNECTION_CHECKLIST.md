# Supabase Connection Checklist

## Current Status: Connection Failing

Your connection string format looks correct, but we're getting "Can't reach database server" errors.

## Step-by-Step Verification

### 1. Verify Project Status
- [ ] Go to https://supabase.com/dashboard
- [ ] Check your project status - should show **"Active"** (green)
- [ ] If it shows "Paused" or "Inactive", click "Restore" and wait 2-3 minutes

### 2. Get Connection String from Supabase Dashboard

**For Direct Connection (Port 5432):**
- [ ] Go to: Settings > Database > Connection string
- [ ] Select "URI" tab
- [ ] Copy the **exact** string shown (it should have your password already filled in)
- [ ] Format should be: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
- [ ] OR: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

**For Connection Pooler (Port 6543):**
- [ ] Go to: Settings > Database > Connection Pooling
- [ ] Make sure "Connection Pooling" is **enabled**
- [ ] Select "Session" mode
- [ ] Copy the connection string shown
- [ ] Format should be: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`

### 3. Check IP Restrictions
- [ ] Go to: Settings > Database > Connection Pooling
- [ ] Check "Allowed IP addresses"
- [ ] If restricted, either:
  - Add your current IP address
  - OR temporarily set to "Allow all" for testing

### 4. Verify Connection String Format

The connection string from Supabase dashboard might look different than what we're using. Common formats:

**Format 1 (Direct with project ref):**
```
postgresql://postgres.njlxqcbjcbmjslfgrzvu:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**Format 2 (Direct with db subdomain):**
```
postgresql://postgres:[PASSWORD]@db.njlxqcbjcbmjslfgrzvu.supabase.co:5432/postgres
```

**Format 3 (Connection Pooler):**
```
postgresql://postgres.njlxqcbjcbmjslfgrzvu:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 5. Test Connection

Once you have the correct connection string from Supabase dashboard:

1. Update your `.env` file with the **exact** string from Supabase
2. Run: `npx prisma migrate deploy`

## What to Check Next

1. **Copy the EXACT connection string** from Supabase Dashboard (don't modify it)
2. **Check if Connection Pooling is enabled** in Supabase settings
3. **Verify IP restrictions** aren't blocking your connection
4. **Confirm project is Active** (not paused)

## If Still Not Working

Try these in order:

1. **Use the connection string exactly as shown in Supabase dashboard** (don't modify format)
2. **Enable Connection Pooling** in Supabase if not already enabled
3. **Check Supabase status page** for any outages
4. **Try from a different network** (in case of firewall issues)
5. **Contact Supabase support** if project is active but still can't connect

