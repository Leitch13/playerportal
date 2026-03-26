'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

export default function FileUpload({
  attachments,
  onChange,
  bucket = 'coaching',
  folder = 'general',
  accept = 'image/*,.pdf',
  maxFiles = 5,
}: {
  attachments: Attachment[]
  onChange: (attachments: Attachment[]) => void
  bucket?: string
  folder?: string
  accept?: string
  maxFiles?: number
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    setUploading(true)
    setError('')
    const supabase = createClient()
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`)
        continue
      }

      const ext = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file)

      if (uploadError) {
        setError(`Failed to upload ${file.name}`)
        continue
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      newAttachments.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      })
    }

    onChange([...attachments, ...newAttachments])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleRemove(index: number) {
    onChange(attachments.filter((_, i) => i !== index))
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  function getIcon(type: string) {
    if (type.startsWith('image/')) return '🖼️'
    if (type === 'application/pdf') return '📄'
    return '📎'
  }

  return (
    <div className="space-y-3">
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5"
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <span className="text-xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                  {getIcon(file.type)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#4ecde6] hover:underline truncate block"
                >
                  {file.name}
                </a>
                <span className="text-[10px] text-white/30">{formatSize(file.size)}</span>
              </div>
              <button
                onClick={() => handleRemove(i)}
                className="text-white/30 hover:text-red-400 transition text-sm flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {attachments.length < maxFiles && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] border border-dashed border-white/[0.15] rounded-lg text-sm text-white/50 hover:text-white/80 hover:border-white/[0.25] transition disabled:opacity-50"
          >
            {uploading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Photos or PDFs
              </>
            )}
          </button>
          <p className="text-[10px] text-white/25 mt-1">
            Images & PDFs up to 10MB each. Max {maxFiles} files.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
