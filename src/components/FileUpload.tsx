'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FileUpload({
  bucketName = 'coaching',
  folder,
  accept,
  onUpload,
  currentUrl,
  label,
}: {
  bucketName?: string
  folder: string
  accept: string
  onUpload: (url: string) => void
  currentUrl?: string
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState(currentUrl || '')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isPdf = (url: string) =>
    url.toLowerCase().endsWith('.pdf') || url.includes('.pdf')

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/')
      return decodeURIComponent(parts[parts.length - 1])
    } catch {
      return 'file'
    }
  }

  const isImage = (url: string) => {
    const lower = url.toLowerCase()
    return (
      lower.includes('.png') ||
      lower.includes('.jpg') ||
      lower.includes('.jpeg') ||
      lower.includes('.gif') ||
      lower.includes('.webp') ||
      lower.includes('.svg')
    )
  }

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)')
      return
    }

    setUploading(true)
    setProgress(0)
    setError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const uniqueName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Simulate progress since supabase-js doesn't expose upload progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 150)

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uniqueName, file, { upsert: true })

    clearInterval(progressInterval)

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message)
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(100)

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    const publicUrl = urlData.publicUrl
    setPreview(publicUrl)
    setFileName(file.name)
    onUpload(publicUrl)
    setUploading(false)

    // Reset progress after a brief moment
    setTimeout(() => setProgress(0), 600)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucketName, folder]
  )

  function handleRemove() {
    setPreview('')
    setFileName('')
    onUpload('')
    setError('')
  }

  // Has a file attached
  if (preview) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-xs font-medium text-white/50">
            {label}
          </label>
        )}
        <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3">
          {isImage(preview) ? (
            <a href={preview} target="_blank" rel="noopener noreferrer">
              <img
                src={preview}
                alt="Upload preview"
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-white/[0.1]"
              />
            </a>
          ) : (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="w-16 h-16 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0"
            >
              <svg
                className="w-7 h-7 text-red-400/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </a>
          )}
          <div className="flex-1 min-w-0">
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#4ecde6] hover:underline truncate block"
            >
              {fileName || getFileNameFromUrl(preview)}
            </a>
            <span className="text-[10px] text-white/30">
              {isPdf(preview) ? 'PDF document' : 'Image'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-white/30 hover:text-red-400 transition text-xs px-2 py-1 rounded border border-white/[0.08] hover:border-red-400/30 flex-shrink-0"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  // Upload zone (no file yet)
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-white/50">
          {label}
        </label>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border border-dashed cursor-pointer transition-all ${
          dragOver
            ? 'bg-[#4ecde6]/10 border-[#4ecde6]/50'
            : 'bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.2]'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <>
            <svg
              className="animate-spin w-6 h-6 text-[#4ecde6]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-xs text-white/50">Uploading...</span>
            {/* Progress bar */}
            <div className="w-full max-w-[200px] h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4ecde6] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <svg
              className="w-6 h-6 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="text-xs text-white/40">
              Drag &amp; drop or{' '}
              <span className="text-[#4ecde6]">browse</span>
            </span>
            <span className="text-[10px] text-white/25">Max 10MB</span>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
