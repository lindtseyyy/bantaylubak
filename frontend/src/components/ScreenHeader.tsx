import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from './icons'

export interface ScreenHeaderProps {
  title: string
  subtitle: string
  backTo: string
  onBack?: () => void
}

export function ScreenHeader({
  title,
  subtitle,
  backTo,
  onBack,
}: ScreenHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate(backTo)
  }

  return (
    <header className="screen-header">
      <div className="screen-header__top">
        <button
          type="button"
          className="screen-header__back"
          onClick={handleBack}
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="screen-header__title">{title}</h1>
      </div>
      <p className="screen-header__subtitle">{subtitle}</p>
    </header>
  )
}
