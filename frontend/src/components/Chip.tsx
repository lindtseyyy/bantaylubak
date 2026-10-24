import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export type ChipVariant = 'teal' | 'amber' | 'red' | 'neutral'

interface ChipBaseProps {
  variant?: ChipVariant
  children: ReactNode
  className?: string
}

type ChipButtonProps = ChipBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    onClick: () => void
  }

type ChipSpanProps = ChipBaseProps &
  HTMLAttributes<HTMLSpanElement> & {
    onClick?: undefined
  }

export type ChipProps = ChipButtonProps | ChipSpanProps

export function Chip(props: ChipProps) {
  const { variant = 'neutral', children, className = '', ...rest } = props
  const classes = `chip chip--${variant} ${className}`.trim()

  if ('onClick' in props && typeof props.onClick === 'function') {
    const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>
    return (
      <button
        type="button"
        className={`${classes} chip--interactive`}
        onClick={props.onClick}
        {...buttonProps}
      >
        {children}
      </button>
    )
  }

  const spanProps = rest as HTMLAttributes<HTMLSpanElement>
  return (
    <span className={classes} {...spanProps}>
      {children}
    </span>
  )
}
