import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface ListWithSubscribers {
  id: string
  name: string
  description: string
  slug: string
  priceCents: number
  owner: {
    id: string
    username: string
    displayName: string
  }
  subscriberCount: number
  createdAt: Date
}

async function getPublicLists(): Promise<ListWithSubscribers[]> {
  const lists = await prisma.list.findMany({
    where: {
      isPublic: true,
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  })

  // Sort by subscriber count (descending), then by creation date (descending)
  const sortedLists = lists.sort((a, b) => {
    const countDiff = b._count.subscriptions - a._count.subscriptions
    if (countDiff !== 0) return countDiff
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return sortedLists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    slug: list.slug,
    priceCents: list.priceCents,
    owner: list.owner,
    subscriberCount: list._count.subscriptions,
    createdAt: list.createdAt,
  }))
}

function formatPrice(priceCents: number): string {
  if (priceCents === 0) {
    return 'Free'
  }
  return `$${(priceCents / 100).toFixed(2)}/mo`
}

export default async function ExplorePage() {
  // Require authentication to view explore page
  const userId = await getSession()
  if (!userId) {
    redirect('/login')
  }

  const lists = await getPublicLists()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Explore</h1>
        <p className="mt-2 text-gray-600">
          Discover public lists created by the community
        </p>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No public lists available yet.</p>
          <Link
            href="/create"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            Create the first public list →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                    {list.name}
                  </h2>
                  <span className="ml-2 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {formatPrice(list.priceCents)}
                  </span>
                </div>

                {list.description && (
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {list.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">by</span>
                    <span className="text-sm font-medium text-gray-900">
                      {list.owner.displayName}
                    </span>
                    <span className="text-sm text-gray-500">
                      @{list.owner.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span>{list.subscriberCount}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

