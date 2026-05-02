import type { FC } from 'react'

interface Props {
  hasImage: boolean
  showOriginal: boolean
  splitView: boolean
  onToggleOriginal: () => void
  onToggleSplitView: () => void
  onUploadNew: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onDownload: (format: 'png' | 'jpeg') => void
}

const Toolbar: FC<Props> = ({
  hasImage,
  showOriginal,
  splitView,
  onToggleOriginal,
  onToggleSplitView,
  onUploadNew,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDownload,
}) => {
  return (
    <header className="toolbar">
      <span className="toolbar-title">Si Dios Quiere Colores</span>

      <div className="toolbar-actions">
        <button className="btn-toggle" onClick={onUploadNew} title="Upload a new image">
          <UploadIcon />
          Upload
        </button>

        {hasImage && (
          <>
            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <button
                className="btn-icon"
                disabled={!canUndo}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
              >
                <UndoIcon />
              </button>
              <button
                className="btn-icon"
                disabled={!canRedo}
                onClick={onRedo}
                title="Redo (Ctrl+Y)"
              >
                <RedoIcon />
              </button>
            </div>

            <div className="toolbar-divider" />

            <button
              className={`btn-toggle ${showOriginal ? 'active' : ''}`}
              onClick={onToggleOriginal}
              title="Toggle original image"
            >
              <EyeIcon />
              {showOriginal ? 'Original' : 'Edited'}
            </button>

            <button
              className={`btn-toggle ${splitView ? 'active' : ''}`}
              onClick={onToggleSplitView}
              title="Split view"
            >
              <SplitIcon />
              Split
            </button>

            <div className="toolbar-divider" />

            <div className="download-group">
              <button className="btn-primary" onClick={() => onDownload('png')}>
                <DownloadIcon />
                PNG
              </button>
              <button className="btn-primary btn-secondary-dl" onClick={() => onDownload('jpeg')}>
                JPG
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7v6h6" /><path d="M3 13A9 9 0 1 0 5.7 5.7L3 7" strokeLinecap="round" />
    </svg>
  )
}
function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 7v6h-6" /><path d="M21 13A9 9 0 1 1 18.3 5.7L21 7" strokeLinecap="round" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function SplitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="8.5" height="18" rx="1.5" />
      <rect x="13.5" y="3" width="8.5" height="18" rx="1.5" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export default Toolbar
