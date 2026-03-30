'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    // When pathname or search params change, the navigation completed
    cleanup()
    setProgress(100)
    const timer = setTimeout(() => {
      setLoading(false)
      setProgress(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  // Intercept link clicks to start the progress bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return
      if (target.getAttribute('target') === '_blank') return
      if (href === pathname) return
      setLoading(true)
      setProgress(20)
      cleanup()
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          const next = p + Math.random() * 12
          return next >= 85 ? 85 : next
        })
      }, 200)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      cleanup()
    }
  }, [pathname])

  if (!loading && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none">
      <div
        className="h-full bg-[#4ecde6] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: '0 0 10px #4ecde6, 0 0 5px #4ecde6',
        }}
      />
    </div>
  )
}
