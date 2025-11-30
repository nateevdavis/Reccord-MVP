import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import SubscribeButton from './SubscribeButton'
import ShareableUrl from './ShareableUrl'
import PaymentStatusHandler from './PaymentStatusHandler'
import TutorialShareStep from './TutorialShareStep'
import RefreshTopSongsButton from './RefreshTopSongsButton'

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
      topSongsConfig: true,
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
      <TutorialShareStep />
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
          {list.sourceType === 'TOP_SONGS' && list.topSongsConfig && (
            <div className="rounded border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    🎵 Top Songs List
                  </p>
                  <p className="mt-1 text-sm text-purple-800">
                    Time window: {
                      list.topSongsConfig.timeWindow === 'THIS_WEEK' && 'This Week (last 7 days)'
                      || list.topSongsConfig.timeWindow === 'THIS_MONTH' && 'This Month (last 30 days)'
                      || list.topSongsConfig.timeWindow === 'PAST_6_MONTHS' && 'Past 6 Months (last 180 days)'
                      || list.topSongsConfig.timeWindow === 'PAST_YEAR' && 'Past Year (last 365 days)'
                      || list.topSongsConfig.timeWindow === 'ALL_TIME' && 'All Time'
                    }
                  </p>
                  <p className="mt-1 text-sm text-purple-800">
                    Sources: {(list.topSongsConfig.sources as string[]).join(', ')}
                  </p>
                  <p className="mt-1 text-sm text-purple-800">
                    Auto-updates daily • Last synced:{' '}
                    {list.topSongsConfig.lastSyncedAt
                      ? new Date(list.topSongsConfig.lastSyncedAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                {isOwner && (
                  <RefreshTopSongsButton listId={list.id} />
                )}
              </div>
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
              <div data-tutorial="share">
                <ShareableUrl slug={list.slug} />
              </div>
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
              {list.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded border border-gray-200 p-4 ${
                    shouldBlur ? 'blur-md select-none pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {list.sourceType === 'TOP_SONGS' && (
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          {item.sourceService && (
                            <div className="flex gap-1">
                              {item.sourceService.includes('SPOTIFY') && (
                                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  Spotify
                                </span>
                              )}
                              {item.sourceService.includes('APPLE_MUSIC') && (
                                <span className="rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800">
                                  Apple Music
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      {item.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {item.description}
                        </p>
                      )}
                      {item.albumName && (
                        <p className="mt-1 text-xs text-gray-500">
                          Album: {item.albumName}
                        </p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700"
                        >
                          Open in {item.sourceService?.includes('SPOTIFY') ? 'Spotify' : item.sourceService?.includes('APPLE_MUSIC') ? 'Apple Music' : 'music service'} →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

