'use client'

import { useState } from 'react'

interface GalleryPhoto {
  id: string
  title: string
  description: string | null
  photo_url: string
  session_date: string | null
  visible_to_parents: boolean
  created_at: string
  group: unknown
}

export default function GalleryGrid({ photos, isStaff }: { photos: GalleryPhoto[]; isStaff: boolean }) {
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            onClick={() => setSelected(photo)}
            className="bg-white rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
          >
            <div className="aspect-[4/3] relative bg-surface-dark">
              <img
                src={photo.photo_url}
                alt={photo.title}
                className="w-full h-full object-cover"
              />
              {isStaff && !photo.visible_to_parents && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs bg-warning/90 text-white font-medium">
                  Hidden
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm truncate">{photo.title}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {(photo.group as unknown as { name: string })?.name && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    {(photo.group as unknown as { name: string }).name}
                  </span>
                )}
                {photo.session_date && (
                  <span className="text-xs text-text-light">
                    {new Date(photo.session_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selected.photo_url}
                alt={selected.title}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                X
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg">{selected.title}</h3>
              {selected.description && (
                <p className="text-sm text-text-light mt-1">{selected.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {(selected.group as unknown as { name: string })?.name && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    {(selected.group as unknown as { name: string }).name}
                  </span>
                )}
                {selected.session_date && (
                  <span className="text-xs text-text-light">
                    {new Date(selected.session_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
