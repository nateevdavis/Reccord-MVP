import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type LinkItem = {
  label: string
  url: string
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      lists: {
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) {
    notFound()
  }

  const links = (user.links as LinkItem[]) || []

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="space-y-8">
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            {user.displayName}
          </h1>
          <p className="text-gray-600">@{user.username}</p>

          {user.bio && (
            <p className="text-gray-700 whitespace-pre-wrap">{user.bio}</p>
          )}

          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-700"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">Public Lists</h2>
          {user.lists.length === 0 ? (
            <p className="text-gray-600">No public lists yet.</p>
          ) : (
            <div className="space-y-2">
              {user.lists.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.slug}`}
                  className="block rounded border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {list.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {list.description}
                      </p>
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

