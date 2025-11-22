import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">
          Page Not Found
        </h1>
        <p className="mb-8 text-gray-600">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}

