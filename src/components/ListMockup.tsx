export default function ListMockup() {
  const sampleTracks = [
    { name: 'Midnight City', artist: 'M83' },
    { name: 'Blinding Lights', artist: 'The Weeknd' },
    { name: 'Electric Feel', artist: 'MGMT' },
    { name: 'Time to Pretend', artist: 'MGMT' },
    { name: 'Kids', artist: 'MGMT' },
  ]

  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-200"></div>
          <div>
            <p className="text-sm font-medium text-gray-900">Creator Name</p>
            <p className="text-xs text-gray-600">@username</p>
          </div>
        </div>
        <h3 className="mb-2 text-xl font-semibold text-gray-900">
          My Favorite Indie Tracks
        </h3>
        <p className="text-sm text-gray-600">
          A curated selection of indie favorites that keep me going.
        </p>
      </div>
      <div className="divide-y divide-gray-100 p-6">
        {sampleTracks.map((track, index) => (
          <div key={index} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{track.name}</p>
                <p className="text-xs text-gray-600">{track.artist}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Auto-synced from Spotify</span>
          <span className="text-xs text-gray-500">Updated 2h ago</span>
        </div>
      </div>
    </div>
  )
}

