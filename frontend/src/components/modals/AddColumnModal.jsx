import { useState } from 'react'
import { Columns3 } from 'lucide-react'

const DATA_TYPES = [
  'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
  'VARCHAR(255)', 'VARCHAR(50)', 'VARCHAR(100)', 'TEXT', 'CHAR(1)',
  'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
  'NUMERIC(10,2)', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE PRECISION', 'REAL',
  'UUID', 'JSON', 'JSONB', 'BYTEA',
  'NVARCHAR(255)', 'NVARCHAR(MAX)', 'INT', 'BIT', 'DATETIME', 'DATETIME2',
]

export default function AddColumnModal({ tableName, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    name: '',
    data_type: 'VARCHAR(255)',
    is_nullable: true,
    default_value: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      name: form.name.trim(),
      data_type: form.data_type,
      is_nullable: form.is_nullable,
      is_primary: false,
      default_value: form.default_value || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-slide-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">
              Add Column to <span className="text-primary-400">{tableName}</span>
            </h3>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div>
              <label className="input-label">Column Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="new_column"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="input-label">Data Type</label>
              <select
                className="select"
                value={form.data_type}
                onChange={(e) => setForm((f) => ({ ...f, data_type: e.target.value }))}
              >
                {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_nullable}
                  onChange={(e) => setForm((f) => ({ ...f, is_nullable: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800"
                />
                Allow NULL
              </label>
            </div>
            <div>
              <label className="input-label">Default Value (optional)</label>
              <input
                className="input"
                value={form.default_value}
                onChange={(e) => setForm((f) => ({ ...f, default_value: e.target.value }))}
                placeholder="e.g. 0 or 'pending'"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary text-xs" disabled={isLoading || !form.name.trim()}>
              {isLoading ? 'Adding...' : 'Add Column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
