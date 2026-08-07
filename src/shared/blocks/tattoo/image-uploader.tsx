'use client'

import { useRef, useState } from 'react'
import { X, ImageUp, CheckCircle2 } from 'lucide-react'
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

  // --- Preview ---
  if (photoUrl) {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-border/30 bg-muted/30 shadow-sm">
        <div className="aspect-[3/2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Body photo preview"
            className="h-full w-full object-contain p-2"
          />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Photo ready
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-all hover:bg-background"
            aria-label="Remove photo"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
    )
  }

  // --- Uploading ---
  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-primary/20 bg-primary/[0.02] px-6 py-14 text-center">
        <div className="relative h-16 w-16">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground/15" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-primary transition-all duration-300"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - uploadProgress / 100)}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary tabular-nums">
            {Math.round(uploadProgress)}%
          </span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Uploading your photo...</p>
      </div>
    )
  }

  // --- Empty ---
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
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
        dragOver
          ? 'scale-[1.01] border-sky-400 bg-sky-50/60 shadow-lg dark:bg-sky-950/20'
          : 'border-muted-foreground/20 bg-muted/10 hover:border-muted-foreground/30 hover:bg-muted/20',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <div className={[
        'flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
        dragOver ? 'scale-110 bg-sky-500/15' : 'bg-muted',
      ].join(' ')}>
        <ImageUp className={[
          'h-7 w-7 transition-colors duration-200',
          dragOver ? 'text-sky-500' : 'text-muted-foreground/50 group-hover:text-muted-foreground/70',
        ].join(' ')} />
      </div>
      <div>
        <p className="text-sm font-medium">
          <span className="text-primary">Click to upload</span>
          {' '}or drag and drop
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG or WebP · max {MAX_MB}MB
        </p>
      </div>
      {localError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
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
