import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 560, maxWidth: '90%', maxHeight: '85%', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="mb-3">{title}</h3>}
        <div>{children}</div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </div>
  )
}

