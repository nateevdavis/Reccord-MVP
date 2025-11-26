export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-semibold text-gray-900">Pricing</h1>
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            Free to Start
          </h2>
          <p className="mb-6 text-gray-600">
            Reccord is free for creators. You set your own price for your lists,
            and you keep the revenue. We only charge a small transaction fee on
            payments processed through Stripe.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-900">✓</span>
              <span className="text-gray-600">Create unlimited lists</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">✓</span>
              <span className="text-gray-600">Connect Spotify or Apple Music</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">✓</span>
              <span className="text-gray-600">Set your own prices</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">✓</span>
              <span className="text-gray-600">Keep all revenue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

