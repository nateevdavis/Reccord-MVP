export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-semibold text-gray-900">Privacy Policy</h1>
      <div className="prose prose-gray max-w-none space-y-6">
        <p className="text-gray-600">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            1. Information We Collect
          </h2>
          <p className="text-gray-600">
            We collect information you provide directly to us, such as when you
            create an account, create lists, or contact us for support. This may
            include your email address, username, display name, and payment
            information processed through Stripe.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            2. How We Use Your Information
          </h2>
          <p className="text-gray-600">
            We use the information we collect to provide, maintain, and improve our
            services, process payments, and communicate with you about your
            account.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            3. Third-Party Services
          </h2>
          <p className="text-gray-600">
            We use Stripe for payment processing and may integrate with Spotify
            and Apple Music for list synchronization. These services have their
            own privacy policies.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            4. Data Security
          </h2>
          <p className="text-gray-600">
            We implement appropriate security measures to protect your personal
            information. However, no method of transmission over the internet is
            100% secure.
          </p>
        </section>
      </div>
    </div>
  )
}

