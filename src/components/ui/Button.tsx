import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export default function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-2 rounded text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  const variantStyles =
    variant === 'primary'
      ? 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500'
      : variant === 'secondary'
      ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500'
      : 'bg-transparent text-gray-900 hover:underline focus:ring-gray-500'

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

