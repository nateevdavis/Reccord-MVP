import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import SubscribeButton from './SubscribeButton'
import ShareableUrl from './ShareableUrl'
import PaymentStatusHandler from './PaymentStatusHandler'

export const dynamic = 'force-dynamic'

export default async function ListPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getSession()
  const list = await prisma.list.findUnique({
    where: { slug },
    include: {
      owner: true,
      items: {
        orderBy: { sortOrder: 'asc' },
      },
      subscriptions: userId
        ? {
            where: { userId },
            include: {
              payments: {
                where: { status: 'COMPLETED' },
              },
            },
          }
        : undefined,
      spotifyConfig: true,
    },
  })

  if (!list) {
    notFound()
  }

  const isOwner = userId ? list.ownerId === userId : false
  const subscription = userId && list.subscriptions ? list.subscriptions[0] : null
  
  // For paid lists, check if user has a completed payment
  // TypeScript guard: check if subscription has payments property
  const subscriptionWithPayments = subscription && 'payments' in subscription 
    ? subscription as typeof subscription & { payments: Array<{ status: string }> }
    : null
  
  const hasValidSubscription = subscriptionWithPayments && (
    list.priceCents === 0 || // Free list
    (subscriptionWithPayments.payments && subscriptionWithPayments.payments.length > 0) // Paid list with at least one completed payment
  )
  
  const isSubscribed = !!hasValidSubscription
  const shouldBlur = !isOwner && !isSubscribed

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="space-y-6">
        <PaymentStatusHandler />
        <div className="space-y-2 border-b border-gray-200 pb-4">
          <p className="text-sm text-gray-600">
            Created by {list.owner.displayName}
          </p>
          <Link
            href={`/u/${list.owner.username}`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            @{list.owner.username}
          </Link>
          <div>
            <Link
              href={`/u/${list.owner.username}`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              View profile →
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {list.sourceType === 'SPOTIFY' && list.spotifyConfig && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                🎵 This list syncs from Spotify every hour. Last synced:{' '}
                {list.spotifyConfig.lastSyncedAt
                  ? new Date(list.spotifyConfig.lastSyncedAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          )}
          <h1 className="text-3xl font-semibold text-gray-900">{list.name}</h1>
          {list.description && (
            <p className="text-gray-700 whitespace-pre-wrap">
              {list.description}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="space-y-4">
            <div>
              <Link href={`/create?listId=${list.id}`}>
                <button className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200">
                  Edit this list
                </button>
              </Link>
            </div>
            {list.isPublic && (
              <ShareableUrl slug={list.slug} />
            )}
          </div>
        )}

        {shouldBlur && (
          <div className="rounded border border-gray-200 bg-gray-50 p-4">
            <p className="mb-4 text-sm text-gray-600">
              Subscribe to unlock this list
            </p>
            <SubscribeButton listId={list.id} priceCents={list.priceCents} />
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Items</h2>
          {list.items.length === 0 ? (
            <p className="text-gray-600">No items yet.</p>
          ) : (
            <div className="space-y-3">
              {list.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded border border-gray-200 p-4 ${
                    shouldBlur ? 'blur-md select-none pointer-events-none' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {item.description}
                    </p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-sm text-blue-600 hover:text-blue-700"
                    >
                      {item.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

