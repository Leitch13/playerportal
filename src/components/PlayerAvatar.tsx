interface PlayerAvatarProps {
  photoUrl?: string | null
  firstName: string
  lastName: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
}

export default function PlayerAvatar({
  photoUrl,
  firstName,
  lastName,
  size = 'md',
  className = '',
}: PlayerAvatarProps) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
  const sizeClass = sizeClasses[size]

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className={`${sizeClass} rounded-full object-cover border-2 border-border ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center border-2 border-accent/20 ${className}`}
    >
      {initials}
    </div>
  )
}
