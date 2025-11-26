import Link from 'next/link'
import Button from '@/components/ui/Button'
import ListMockup from '@/components/ListMockup'

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
            Turn recommendations into revenue.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            The easiest way to monetize your taste.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button variant="primary" className="px-6 py-3 text-base">
                Sign Up Free
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="ghost" className="px-6 py-3 text-base">
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="border-t border-gray-200 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to monetize your taste
            </h2>
          </div>
          <div className="mx-auto mt-16 max-w-7xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                  💰
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Earn Recurring Revenue
                </h3>
                <p className="mt-2 text-gray-600">
                  Turn your curated lists into monthly income.
                </p>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                  🎵
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Auto-Generate Your Lists
                </h3>
                <p className="mt-2 text-gray-600">
                  Pull in your latest tracks from Spotify or Apple Music.
                </p>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                  ⚡
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Set Your Price & Launch
                </h3>
                <p className="mt-2 text-gray-600">
                  Connect Stripe and start earning today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="border-t border-gray-200 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                  Lists that update themselves.
                </h2>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Connect your Spotify or Apple Music account and watch your lists
                  automatically sync with your latest tracks. No manual updates
                  needed—your recommendations stay fresh and your subscribers stay
                  engaged.
                </p>
                <div className="mt-8">
                  <Link href="/signup">
                    <Button variant="primary" className="px-6 py-3 text-base">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <ListMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="border-t border-gray-200 bg-white py-24"
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get started in minutes, not hours.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-7xl">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
              <div className="flex flex-col text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-900 text-xl font-semibold text-gray-900">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Sign Up</h3>
                <p className="mt-2 text-gray-600">Create your free account.</p>
              </div>
              <div className="flex flex-col text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-900 text-xl font-semibold text-gray-900">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Connect Spotify or Apple Music
                </h3>
                <p className="mt-2 text-gray-600">
                  Auto-generate your first list instantly.
                </p>
              </div>
              <div className="flex flex-col text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-900 text-xl font-semibold text-gray-900">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Set Your Price
                </h3>
                <p className="mt-2 text-gray-600">
                  Start earning recurring revenue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="border-t border-gray-200 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Loved by creators
            </h2>
          </div>
          <div className="mx-auto mt-16 max-w-7xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <p className="text-gray-900">
                  "I made my first recurring revenue in 24 hours."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    JM
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">J.M.</p>
                    <p className="text-xs text-gray-600">Music Curator</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <p className="text-gray-900">
                  "Finally a platform built for creators' taste."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    SK
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">S.K.</p>
                    <p className="text-xs text-gray-600">Playlist Creator</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <p className="text-gray-900">
                  "Took 2 minutes to set up. Now it runs itself."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    AR
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">A.R.</p>
                    <p className="text-xs text-gray-600">Indie Music Fan</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <p className="text-gray-900">
                  "My subscribers love the auto-updates. Game changer."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    DL
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">D.L.</p>
                    <p className="text-xs text-gray-600">DJ & Curator</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="border-t border-gray-200 bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Ready to monetize your recommendations?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Join creators who are already turning their taste into income.
            </p>
            <div className="mt-10">
              <Link href="/signup">
                <Button variant="primary" className="px-8 py-3 text-base">
                  Start Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
