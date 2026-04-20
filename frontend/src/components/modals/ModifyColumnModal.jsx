import { useState } from 'react'
import { Settings } from 'lucide-react'

const DATA_TYPES = [
  'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
  'VARCHAR(255)', 'VARCHAR(50)', 'VARCHAR(100)', 'TEXT', 'CHAR(1)',
  'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
  'NUMERIC(10,2)', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE PRECISION', 'REAL',
  'UUID', 'JSON', 'JSONB', 'BYTEA',
  'NVARCHAR(255)', 'NVARCHAR(MAX)', 'INT', 'BIT', 'DATETIME', 'DATETIME2',
]

export default function ModifyColumnModal({ tableName, columnName, currentType, currentNullable, colInfo, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    new_name: columnName || '',
    new_data_type: currentType || 'VARCHAR(255)',
    new_nullable: currentNullable ?? true,
    is_primary: !!colInfo?.is_primary,
    is_unique: !!colInfo?.is_unique,
    is_autoincrement: !!colInfo?.is_autoincrement,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      new_name: form.new_name,
      new_data_type: form.new_data_type,
      new_nullable: form.new_nullable,
      is_primary: form.is_primary,
      is_unique: form.is_unique,
      is_autoincrement: form.is_autoincrement,
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-slide-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">
              Modify <span className="text-primary-400">{columnName}</span>
              <span className="text-surface-500 ml-1 text-xs">in {tableName}</span>
            </h3>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div>
              <label className="input-label">Column Name</label>
              <input 
                className="input" 
                value={form.new_name} 
                onChange={(e) => setForm((f) => ({ ...f, new_name: e.target.value }))}
                placeholder="Enter new column name..."
              />
            </div>
            <div>
              <label className="input-label">New Data Type</label>
              <select
                className="select"
                value={form.new_data_type}
                onChange={(e) => setForm((f) => ({ ...f, new_data_type: e.target.value }))}
              >
                {!DATA_TYPES.includes(currentType?.toUpperCase()) && currentType && (
                    <option value={currentType}>{currentType.toUpperCase()} (Current)</option>
                )}
                {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            <label className="flex items-center gap-3 text-xs text-surface-300 cursor-pointer p-1 hover:bg-surface-800/40 rounded transition-colors">
              <input
                type="checkbox"
                checked={form.new_nullable}
                onChange={(e) => setForm((f) => ({ ...f, new_nullable: e.target.checked }))}
                className="w-4 h-4 rounded border-surface-600 bg-surface-950 text-primary-600 focus:ring-primary-500/30"
              />
              <span>Nullable</span>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2.5 text-xs text-surface-300 cursor-pointer p-1.5 bg-surface-950/40 rounded-lg border border-surface-800/40 hover:border-primary-500/30 transition-all">
                  <input
                    type="checkbox"
                    checked={form.is_primary}
                    onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-900 text-amber-500"
                  />
                  <span className={form.is_primary ? 'text-amber-400 font-bold' : ''}>Primary Key</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-surface-300 cursor-pointer p-1.5 bg-surface-950/40 rounded-lg border border-surface-800/40 hover:border-primary-500/30 transition-all">
                  <input
                    type="checkbox"
                    checked={form.is_unique}
                    onChange={(e) => setForm((f) => ({ ...f, is_unique: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-900 text-indigo-500"
                  />
                  <span className={form.is_unique ? 'text-indigo-400 font-bold' : ''}>Unique</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-surface-300 cursor-pointer p-1.5 bg-surface-950/40 rounded-lg border border-surface-800/40 hover:border-primary-500/30 transition-all">
                  <input
                    type="checkbox"
                    checked={form.is_autoincrement}
                    onChange={(e) => setForm((f) => ({ ...f, is_autoincrement: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-900 text-emerald-500"
                  />
                  <span className={form.is_autoincrement ? 'text-emerald-400 font-bold' : ''}>Autoincrement</span>
                </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary text-xs" disabled={isLoading}>
              {isLoading ? 'Modifying...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
