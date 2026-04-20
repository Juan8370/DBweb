import { AlertTriangle } from 'lucide-react'

/**
 * Confirmation modal for destructive operations.
 */
export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, danger = true }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-slide-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            {danger && <AlertTriangle className="w-5 h-5 text-red-400" />}
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p className="text-sm text-surface-300">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? 'btn-danger text-xs' : 'btn-primary text-xs'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
