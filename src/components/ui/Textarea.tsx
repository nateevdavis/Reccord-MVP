import { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export default function Textarea({
  label,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        className={`w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 ${className}`}
        {...props}
      />
    </div>
  )
}

