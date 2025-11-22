'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CreateForm from './CreateForm'

function CreateFormWrapper() {
  const searchParams = useSearchParams()
  const listId = searchParams.get('listId')
  
  return <CreateForm listId={listId} />
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-600">Loading...</div>}>
      <CreateFormWrapper />
    </Suspense>
  )
}
