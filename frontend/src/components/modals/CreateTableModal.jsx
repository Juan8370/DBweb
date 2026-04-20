import { useState, useCallback, memo } from 'react'
import { Plus, Trash2, Table2, Table, FileUp } from 'lucide-react'

const DATA_TYPES = [
  'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
  'VARCHAR(255)', 'VARCHAR(50)', 'VARCHAR(100)', 'TEXT', 'CHAR(1)',
  'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
  'NUMERIC(10,2)', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE PRECISION', 'REAL',
  'UUID', 'JSON', 'JSONB', 'BYTEA',
  'NVARCHAR(255)', 'NVARCHAR(MAX)', 'INT', 'BIT', 'DATETIME', 'DATETIME2',
]

const emptyColumn = () => ({
  id: Math.random().toString(36).substr(2, 9),
  name: '',
  data_type: 'VARCHAR(255)',
  is_nullable: true,
  is_primary: false,
  is_unique: false,
  is_autoincrement: false,
  default_value: '',
})

// Memoized Row Component to prevent lag
const ColumnRow = memo(({ col, updateColumn, removeColumn, isOnly }) => {
    return (
        <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-surface-900/60 border border-surface-800/40 hover:border-surface-700 transition-colors">
            {/* Name */}
            <input
                className="input !py-1.5 text-xs col-span-3"
                value={col.name}
                onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                placeholder="column_name"
                required
            />
            {/* Type */}
            <select
                className="select !py-1.5 text-xs col-span-2"
                value={col.data_type}
                onChange={(e) => updateColumn(col.id, 'data_type', e.target.value)}
            >
                {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            
            {/* Constraints Group */}
            <div className="col-span-4 flex items-center justify-between px-2 bg-surface-950/50 rounded border border-surface-800/40 h-8 self-center">
                <label className="flex items-center gap-1 text-[9px] font-bold text-surface-400 cursor-pointer hover:text-primary-400 transition-colors" title="Primary Key">
                    <input
                        type="checkbox"
                        checked={col.is_primary}
                        onChange={(e) => updateColumn(col.id, 'is_primary', e.target.checked)}
                        className="w-2.5 h-2.5 rounded border-surface-600 bg-surface-800 text-primary-500"
                    />
                    PK
                </label>
                <label className="flex items-center gap-1 text-[9px] font-bold text-surface-400 cursor-pointer hover:text-primary-400 transition-colors" title="Allow Null">
                    <input
                        type="checkbox"
                        checked={col.is_nullable}
                        onChange={(e) => updateColumn(col.id, 'is_nullable', e.target.checked)}
                        className="w-2.5 h-2.5 rounded border-surface-600 bg-surface-800 text-primary-500"
                    />
                    NULL
                </label>
                <label className="flex items-center gap-1 text-[9px] font-bold text-surface-400 cursor-pointer hover:text-primary-400 transition-colors" title="Identity / Autoincrement">
                    <input
                        type="checkbox"
                        checked={col.is_autoincrement}
                        onChange={(e) => updateColumn(col.id, 'is_autoincrement', e.target.checked)}
                        className="w-2.5 h-2.5 rounded border-surface-600 bg-surface-800 text-primary-500"
                    />
                    AUTO
                </label>
                <label className="flex items-center gap-1 text-[9px] font-bold text-surface-400 cursor-pointer hover:text-primary-400 transition-colors" title="Unique Constraint">
                    <input
                        type="checkbox"
                        checked={col.is_unique}
                        onChange={(e) => updateColumn(col.id, 'is_unique', e.target.checked)}
                        className="w-2.5 h-2.5 rounded border-surface-600 bg-surface-800 text-primary-500"
                    />
                    UNIQ
                </label>
            </div>

            {/* Default */}
            <input
                className="input !py-1.5 text-xs col-span-2"
                value={col.default_value || ''}
                onChange={(e) => updateColumn(col.id, 'default_value', e.target.value)}
                placeholder="Default"
                title="Default value"
            />
            {/* Remove */}
            <div className="col-span-1 flex justify-end">
                <button
                    type="button"
                    className="btn-icon !p-1 text-surface-500 hover:text-red-400 transition-colors disabled:opacity-20"
                    onClick={() => removeColumn(col.id)}
                    disabled={isOnly}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
})

export default function CreateTableModal({ onSubmit, onCancel, isLoading }) {
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState([
    { ...emptyColumn(), id: 'initial-id', name: 'id', data_type: 'INTEGER', is_primary: true, is_nullable: false, is_autoincrement: true },
  ])
  const [isLoadingCSV, setIsLoadingCSV] = useState(false)
  const [rowCount, setRowCount] = useState(0)

  const addColumn = useCallback(() => setColumns((c) => [...c, emptyColumn()]), [])
  const removeColumn = useCallback((id) => setColumns((c) => c.filter((col) => col.id !== id)), [])

  const updateColumn = useCallback((id, field, value) => {
    setColumns((cols) =>
      cols.map((c) => {
        if (c.id === id) {
            const next = { ...c, [field]: value }
            if (field === 'is_primary' && value === true) next.is_nullable = false
            return next
        }
        return c
      })
    )
  }, [])

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsLoadingCSV(true)
    
    // Suggest table name from filename
    const suggestedName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_")
    setTableName(suggestedName)

    const reader = new FileReader()
    reader.onload = (event) => {
        const text = event.target.result
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 1) return

        // Robust CSV Line Parser
        const parseLine = (line) => {
            const cells = []
            let cur = ''; let inQuote = false
            for (let i = 0; i < line.length; i++) {
                const char = line[i]
                if (char === '"' && line[i+1] === '"') { cur += '"'; i++ }
                else if (char === '"') inQuote = !inQuote
                else if (char === ',' && !inQuote) { cells.push(cur.trim()); cur = '' }
                else cur += char
            }
            cells.push(cur.trim())
            return cells
        }

        const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '') || 'column')
        const firstRow = lines.length > 1 ? parseLine(lines[1]) : []
        setRowCount(lines.length - 1)
        
        const inferredColumns = headers.map((name, i) => {
            const val = firstRow[i] || ''
            let type = 'VARCHAR(255)'
            if (val !== '' && !isNaN(val)) {
                type = val.includes('.') ? 'FLOAT' : 'INTEGER'
            } else if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
                type = 'BOOLEAN'
            }
            return { ...emptyColumn(), id: `csv-${i}-${Date.now()}`, name, data_type: type, is_nullable: true }
        })

        setColumns(inferredColumns)
        // Store the data for later insertion after table is created
        window._pendingCSVData = lines.slice(1).map(line => {
             const vals = parseLine(line)
             const obj = {}
             headers.forEach((h, idx) => {
                 let v = vals[idx]?.replace(/^"|"$/g, '')
                 if (v === '' || v === undefined) v = null
                 else if (!isNaN(v)) v = Number(v)
                 obj[h] = v
             })
             return obj
        })
        setIsLoadingCSV(false)
    }
    reader.readAsText(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tableName.trim() || columns.length === 0) return
    onSubmit({
      table: tableName.trim(),
      columns: columns.map(({ name, data_type, is_nullable, is_primary, is_unique, is_autoincrement, default_value }) => ({
        name,
        data_type,
        is_nullable,
        is_primary,
        is_unique,
        is_autoincrement,
        default_value: default_value || null,
      })),
      importData: window._pendingCSVData,
    })
    window._pendingCSVData = null
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-lg animate-slide-up-modal h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header border-b border-surface-800 pb-4 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-primary-400" />
              <h3 className="text-sm font-semibold text-white">Create New Table</h3>
            </div>
            
            <label className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-lg cursor-pointer transition-colors border border-surface-700 group">
              <FileUp className="w-4 h-4 text-primary-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Auto-fill from CSV</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={isLoadingCSV} />
            </label>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="modal-body space-y-4 overflow-y-auto flex-1">
            {/* Table name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Table Name</label>
                <input
                    className="input"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="new_table"
                    required
                    autoFocus
                />
              </div>
              <div className="flex flex-col justify-end">
                {rowCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary-500/10 border border-primary-500/20 rounded-lg animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-primary-400 uppercase tracking-wider">
                            Ready to import: <span className="text-white">{rowCount.toLocaleString()}</span> rows
                        </span>
                    </div>
                )}
              </div>
            </div>

            {/* Columns */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="input-label !mb-0">Columns</label>
                <button type="button" className="btn-ghost !py-1 !px-2 text-xs" onClick={addColumn}>
                  <Plus className="w-3 h-3" /> Add Column
                </button>
              </div>

              <div className="space-y-2 pr-1">
                {columns.map((col) => (
                  <ColumnRow 
                    key={col.id} 
                    col={col} 
                    updateColumn={updateColumn} 
                    removeColumn={removeColumn} 
                    isOnly={columns.length <= 1}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer border-t border-surface-800 shrink-0">
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={isLoading || !tableName.trim() || columns.length === 0}
            >
              {isLoading ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
