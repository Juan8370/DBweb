import { useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Dynamic insert row modal — generates inputs from schema columns.
 */
export default function InsertRowModal({ tableName, columns, onSubmit, onCancel, isLoading }) {
  const editableCols = columns?.filter((c) => !c.is_primary || c.data_type?.toLowerCase() !== 'serial') || []

  const [form, setForm] = useState(() => {
    const init = {}
    editableCols.forEach((c) => { init[c.name] = '' })
    return init
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Convert empty strings to null
    const data = {}
    for (const [key, val] of Object.entries(form)) {
      data[key] = val === '' ? null : val
    }
    onSubmit(data)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-lg animate-slide-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Insert Row into <span className="text-primary-400">{tableName}</span>
            </h3>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3 max-h-[400px] overflow-auto">
            {editableCols.map((col) => (
              <div key={col.name}>
                <label className="input-label flex items-center gap-2">
                  {col.name}
                  <span className="text-surface-600 font-mono text-[9px] normal-case">{col.data_type}</span>
                  {!col.is_nullable && <span className="text-rose-400 text-[9px] font-bold">Required</span>}
                </label>
                <input
                  className="input"
                  value={form[col.name] || ''}
                  onChange={(e) => setForm((f) => ({ ...f, [col.name]: e.target.value }))}
                  placeholder={col.is_nullable ? 'NULL' : 'Required'}
                  required={!col.is_nullable && !col.default_value}
                />
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary text-xs" disabled={isLoading}>
              {isLoading ? 'Inserting...' : 'Insert Row'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
