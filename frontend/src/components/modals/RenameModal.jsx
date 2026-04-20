import { useState } from 'react'
import { PenLine } from 'lucide-react'

/**
 * Simple input modal for renaming a table or column.
 */
export default function RenameModal({ title, currentName, onSubmit, onCancel, isLoading }) {
  const [name, setName] = useState(currentName || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim() && name.trim() !== currentName) {
      onSubmit(name.trim())
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-slide-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="input-label">New Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="new_name"
              required
              autoFocus
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={isLoading || !name.trim() || name.trim() === currentName}
            >
              {isLoading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
