'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
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

/**
 * 拖拽 + 点击上传组件。
 * - 客户端预检 size / type（不通过不上传）
 * - 显示预览缩略图（来自 R2 publicUrl）
 * - uploading 时显示进度百分比
 */
export function ImageUploader({
  photoUrl,
  uploading,
  uploadProgress,
  onFileSelected,
  onClear,
  disabled,
}: Props) {
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

  if (photoUrl) {
    return (
      <div className="group relative aspect-square w-full overflow-hidden rounded-lg border border-border/50 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Body photo preview"
          className="h-full w-full object-cover"
        />
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled && !uploading) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={[
        'flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/60',
        (disabled || uploading) ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      {uploading ? (
        <p className="text-sm text-muted-foreground">
          Uploading… {Math.round(uploadProgress)}%
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            Drag &amp; drop your photo here
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse · max {MAX_MB}MB · JPG/PNG/WebP
          </p>
        </>
      )}
      {localError && (
        <p className="mt-1 text-xs text-destructive">{localError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_CONTENT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) validateAndSubmit(file)
          // 重置避免选同一文件不触发 change
          e.target.value = ''
        }}
        disabled={disabled || uploading}
      />
    </div>
  )
}
