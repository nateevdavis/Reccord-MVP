export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-semibold text-gray-900">Contact Us</h1>
      <div className="space-y-6">
        <p className="text-lg text-gray-600">
          Have questions or feedback? We'd love to hear from you.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-gray-600">
            For support, feature requests, or general inquiries, please reach out
            to us at{' '}
            <a
              href="mailto:support@reccord.com"
              className="font-medium text-gray-900 hover:underline"
            >
              support@reccord.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

