export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-semibold text-gray-900">
        Terms of Service
      </h1>
      <div className="prose prose-gray max-w-none space-y-6">
        <p className="text-gray-600">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-600">
            By accessing and using Reccord, you accept and agree to be bound by
            the terms and provision of this agreement.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            2. Use License
          </h2>
          <p className="text-gray-600">
            Permission is granted to temporarily use Reccord for personal,
            non-commercial transitory viewing only. This is the grant of a
            license, not a transfer of title.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            3. User Content
          </h2>
          <p className="text-gray-600">
            You are responsible for the content you create and share on Reccord.
            You must have the right to use and share any music recommendations
            you post.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            4. Payment Terms
          </h2>
          <p className="text-gray-600">
            Payments are processed through Stripe. You are responsible for setting
            up your Stripe Connect account and managing your pricing. Reccord is
            not responsible for payment disputes between creators and subscribers.
          </p>
        </section>
      </div>
    </div>
  )
}

