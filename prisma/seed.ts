import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hash password for seed user
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Create seed user (or update if exists)
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {
      password: hashedPassword, // Update password in case it was changed
    },
    create: {
      email: 'demo@example.com',
      password: hashedPassword,
      displayName: 'Demo User',
      username: 'demouser',
      bio: 'This is a demo user for testing.',
      links: [
        { label: 'Twitter', url: 'https://twitter.com/demouser' },
        { label: 'Website', url: 'https://example.com' },
      ],
    },
  })

  // Create example lists
  const list1 = await prisma.list.upsert({
    where: { slug: 'my-favorite-albums-2024' },
    update: {},
    create: {
      ownerId: user.id,
      name: 'My Favorite Albums 2024',
      description: 'A curated list of the best albums released this year.',
      priceCents: 999, // $9.99
      isPublic: true,
      sourceType: 'MANUAL',
      slug: 'my-favorite-albums-2024',
      items: {
        create: [
          {
            name: 'Album One',
            description: 'An amazing album with great production.',
            url: 'https://example.com/album1',
            sortOrder: 0,
          },
          {
            name: 'Album Two',
            description: 'Another fantastic release.',
            url: 'https://example.com/album2',
            sortOrder: 1,
          },
        ],
      },
    },
  })

  const list2 = await prisma.list.upsert({
    where: { slug: 'private-list' },
    update: {},
    create: {
      ownerId: user.id,
      name: 'Private List',
      description: 'This is a private list.',
      priceCents: 499, // $4.99
      isPublic: false,
      sourceType: 'MANUAL',
      slug: 'private-list',
      items: {
        create: [
          {
            name: 'Private Item',
            description: 'This is a private item.',
            sortOrder: 0,
          },
        ],
      },
    },
  })

  console.log('Seeded user:', user)
  console.log('Seeded lists:', list1, list2)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

