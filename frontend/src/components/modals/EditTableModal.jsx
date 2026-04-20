import { useState, useEffect } from 'react'
import { 
  X, 
  Trash2, 
  Settings, 
  Plus, 
  PenLine, 
  Check, 
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react'

export default function EditTableModal({ 
  table, 
  columns, 
  onSubmit, 
  onCancel, 
  onRenameTable,
  onAddColumn,
  onModifyColumn,
  onDropColumn,
  onDropTable,
  isLoading 
}) {
  const [tableName, setTableName] = useState(table.name)
  const [isRenaming, setIsRenaming] = useState(false)

  return (
    <div className="modal-overlay">
      <div className="modal-content !max-w-2xl bg-surface-950 border border-surface-800 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-800">
          <div className="flex items-center gap-3">
             <div className="bg-primary-500/10 p-2 rounded-xl border border-primary-500/20">
                <Database className="w-5 h-5 text-primary-400" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Edit Table</h2>
                <p className="text-xs text-surface-500 font-medium uppercase tracking-widest">{table.schema_name || 'public'}.{table.name}</p>
             </div>
          </div>
          <button onClick={onCancel} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          
          {/* Section: Rename */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-500">Global Settings</h3>
            <div className="flex items-end gap-3 p-4 bg-surface-900/50 rounded-2xl border border-surface-800/60">
                <div className="flex-1 space-y-1.5">
                    <label className="text-xs text-surface-400 font-bold ml-1">Table Name</label>
                    <input 
                        className="input !bg-surface-950"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder="Table name..."
                    />
                </div>
                <button 
                  className={`btn-primary !py-2.5 !px-5 flex items-center gap-2 ${tableName === table.name ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => onRenameTable(tableName)}
                  disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Update Name</span>
                </button>
            </div>
          </section>

          {/* Section: Columns List */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-surface-800 pb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-500">Columns & Schema</h3>
                <button 
                    className="btn-ghost !text-xs !text-primary-400 flex items-center gap-2 hover:bg-primary-500/10 !px-3 !py-1.5"
                    onClick={() => onAddColumn(table)}
                >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
            </div>

            <div className="bg-surface-900/30 rounded-2xl border border-surface-800/40 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-surface-800/30 text-[10px] uppercase font-bold text-surface-500 tracking-widest border-b border-surface-800/60">
                        <tr>
                            <th className="px-4 py-3">Column Name</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800/40">
                        {columns.map((col) => (
                            <tr key={col.name} className="group hover:bg-surface-800/20 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-surface-200">{col.name}</span>
                                        {col.is_primary && <span className="text-[9px] px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-sm">PK</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-mono text-surface-500">{col.data_type}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button 
                                            className="btn-icon !p-1.5 text-surface-600 hover:text-primary-400"
                                            onClick={() => onModifyColumn(col.name, col)}
                                            title="Edit Column"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button 
                                            className="btn-icon !p-1.5 text-surface-600 hover:text-red-400"
                                            onClick={() => onDropColumn(col.name)}
                                            title="Delete Column"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </section>

          {/* Section: Danger Zone */}
          <section className="pt-4 border-t border-surface-800">
             <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/20 flex items-center justify-between">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
                    <div>
                        <h4 className="text-sm font-bold text-red-400">Danger Zone</h4>
                        <p className="text-xs text-red-400/60">Permanently delete this table and all its data. Action cannot be undone.</p>
                    </div>
                </div>
                <button 
                    className="btn-danger !bg-red-500/10 !border-red-500/30 hover:!bg-red-500 !text-red-400 hover:!text-white !px-4 !py-2 text-xs font-bold uppercase transition-all"
                    onClick={() => onDropTable(table)}
                >
                    Drop Table
                </button>
             </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-surface-800 bg-surface-900/40 flex justify-end">
          <button onClick={onCancel} className="btn-primary !bg-surface-800 hover:!bg-surface-700 !px-8 !py-3 font-bold tracking-widest text-xs uppercase">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
