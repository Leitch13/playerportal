'use client'

export default function ShareButton() {
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        })
      } catch {
        // user cancelled
      }
    } else if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full sm:w-auto text-center px-6 py-4 rounded-full text-sm font-medium border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
    >
      Share
    </button>
  )
}
