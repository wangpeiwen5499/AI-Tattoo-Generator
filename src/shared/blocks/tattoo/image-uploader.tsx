'use client'

import { useRef, useState } from 'react'
import { Upload, X, ImageUp, CheckCircle2 } from 'lucide-react'
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'

type Props = {
  photoUrl: string | null
  uploading: boolean
  uploadProgress: number
  onFileSelected: (file: File) => void
  onClear: () => void
  disabled?: boolean
}

const MAX_MB = MAX_UPLOAD_BYTES / 1024 / 1024

export function ImageUploader({ photoUrl, uploading, uploadProgress, onFileSelected, onClear, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function validateAndSubmit(file: File) {
    setLocalError(null)
    if (!(ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setLocalError(`Unsupported file type. Allowed: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}`)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`File too large. Max ${MAX_MB}MB.`)
      return
    }
    onFileSelected(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSubmit(file)
  }

  // Photo uploaded — show preview
  if (photoUrl) {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-muted/30 shadow-sm">
        <div className="aspect-[4/3] sm:aspect-[16/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Body photo preview"
            className="h-full w-full object-contain p-2"
          />
        </div>
        {/* Success badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Photo uploaded
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-background hover:shadow-md"
            aria-label="Remove photo"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
    )
  }

  // Uploading state
  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] px-6 py-16 text-center">
        <div className="relative h-16 w-16">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted-foreground/20" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-primary transition-all duration-300"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - uploadProgress / 100)}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
            {Math.round(uploadProgress)}%
          </span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Uploading your photo...</p>
      </div>
    )
  }

  // Empty state — drag & drop
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200',
        dragOver
          ? 'scale-[1.01] border-primary bg-primary/[0.06] shadow-lg'
          : 'border-border/50 bg-muted/[0.15] hover:border-primary/40 hover:bg-muted/[0.25] hover:shadow-md',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <div className={[
        'flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200',
        dragOver ? 'bg-primary/15 scale-110' : 'bg-muted group-hover:bg-primary/[0.08]',
      ].join(' ')}>
        <ImageUp className={[
          'h-8 w-8 transition-colors duration-200',
          dragOver ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-primary/70',
        ].join(' ')} />
      </div>
      <div>
        <p className="text-sm font-semibold">
          <span className="text-primary">Click to upload</span>
          {' '}or drag and drop
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG or WebP · max {MAX_MB}MB
        </p>
      </div>
      {localError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
          {localError}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_CONTENT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) validateAndSubmit(file)
          e.target.value = ''
        }}
        disabled={disabled}
      />
    </div>
  )
}
