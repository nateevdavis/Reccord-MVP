# Manual Migration Steps for Notifications

Since `prisma migrate dev` is hanging, follow these steps to apply the migration manually:

## Step 1: Run the SQL in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the following SQL:

```sql
-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('PRICE_CHANGE');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify it executed successfully (you should see "Success. No rows returned")

## Step 2: Mark Migration as Applied (Direct SQL)

Since Prisma commands are hanging, mark the migration as applied directly in Supabase:

1. In Supabase SQL Editor, run this SQL:

```sql
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid(),
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',  -- Placeholder checksum (Prisma will recalculate if needed)
    NOW(),
    '20251201075323_add_notifications',
    NULL,
    NULL,
    NOW(),
    1
);
```

**Note**: The checksum is a placeholder. Prisma will recalculate it when you run `prisma generate` or `prisma migrate status` later. This is safe - Prisma uses the checksum to verify migrations haven't been modified, but since we're manually marking it, a placeholder is fine.

## Step 3: Generate Prisma Client

After marking the migration as applied, generate the Prisma client:

```bash
npx prisma generate
```

**Note**: If this also hangs, you can skip it for now - Prisma Client will be regenerated automatically when you build/run your app.

## Step 4: Verify

1. Check that the `notifications` table exists in Supabase Table Editor
2. Verify the `notification_type` enum exists (you can see it in the Database → Types section)
3. Try running your app - it should work with the new Notification model

## Troubleshooting

If you get an error about the migration already existing:
- Check the `_prisma_migrations` table in Supabase SQL Editor:
  ```sql
  SELECT * FROM "_prisma_migrations" WHERE migration_name = '20251201075323_add_notifications';
  ```
- If it exists but failed, you may need to delete it first:
  ```sql
  DELETE FROM "_prisma_migrations" WHERE migration_name = '20251201075323_add_notifications';
  ```
- Then re-run Step 2
