'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PhotoUploadProps {
  playerId: string
  currentPhotoUrl?: string | null
  firstName: string
  lastName: string
  size?: 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
}

export default function PhotoUpload({
  playerId,
  currentPhotoUrl,
  firstName,
  lastName,
  size = 'xl',
}: PhotoUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || '')
  const [error, setError] = useState('')

  const initials =
    `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
  const sizeClass = sizeClasses[size]

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setUploading(true)
    setError('')

    const supabase = createClient()

    // Create a unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${playerId}-${Date.now()}.${ext}`
    const filePath = `players/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('player-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('player-photos').getPublicUrl(filePath)

    // Update the player record
    const { error: updateError } = await supabase
      .from('players')
      .update({ photo_url: publicUrl })
      .eq('id', playerId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setPhotoUrl(publicUrl)
      router.refresh()
    }
    setUploading(false)
  }

  async function handleRemove() {
    setUploading(true)
    setError('')

    const supabase = createClient()

    // Update the player record to remove photo
    const { error: updateError } = await supabase
      .from('players')
      .update({ photo_url: null })
      .eq('id', playerId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setPhotoUrl('')
      router.refresh()
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar display */}
      <div className="relative group">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${firstName} ${lastName}`}
            className={`${sizeClass} rounded-full object-cover border-2 border-border`}
          />
        ) : (
          <div
            className={`${sizeClass} rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center border-2 border-accent/20`}
          >
            {initials}
          </div>
        )}

        {/* Overlay on hover */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <span className="text-white text-xs font-medium">
            {uploading ? '...' : photoUrl ? 'Change' : 'Upload'}
          </span>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-accent hover:underline font-medium disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Add Photo'}
        </button>
        {photoUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-danger hover:underline font-medium"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
