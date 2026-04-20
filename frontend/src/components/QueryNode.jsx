import { Handle, Position } from '@xyflow/react'
import { Table2, CheckSquare, Square, X } from 'lucide-react'

/**
 * Custom node for Query Builder.
 * Allows selecting columns to include in the SELECT clause.
 */
export default function QueryNode({ data }) {
  const { table, selectedColumns = [], alias = '', onToggleColumn, onAliasChange, onRemove } = data

  return (
    <div className="bg-surface-900 border border-surface-700/60 rounded-lg shadow-2xl w-[220px] overflow-hidden animate-fade-in group">
      {/* Header */}
      <div className="bg-surface-800 px-3 py-2 border-b border-surface-700/60 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white tracking-tight truncate max-w-[120px] uppercase opacity-70">{table.name}</span>
            </div>
            <button 
                className="p-1 hover:bg-red-500/20 text-surface-500 hover:text-red-400 rounded transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    onRemove?.()
                }}
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
        
        {/* Alias Input */}
        <div className="flex items-center gap-2 bg-surface-950/50 rounded px-2 py-1 border border-surface-800">
            <span className="text-[9px] font-bold text-surface-500 uppercase">AS</span>
            <input 
                type="text" 
                value={alias}
                onChange={(e) => onAliasChange?.(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] text-indigo-300 font-mono w-full"
                placeholder="Alias..."
            />
        </div>
      </div>

      {/* Column List */}
      <div className="py-1 max-h-[300px] overflow-y-auto custom-scrollbar overflow-x-hidden">
        {table.columns.map((col) => {
          const isSelected = selectedColumns.includes(col.name)
          return (
            <div 
              key={col.name} 
              className={`
                group/col relative flex items-center gap-2 px-3 py-1.5 transition-colors cursor-pointer
                ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-surface-800/40'}
              `}
              onClick={() => onToggleColumn?.(table.name, col.name)}
            >
              {/* Join Handles (Left/Right) - Always Visible */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${col.name}-target`}
                className="!w-2.5 !h-2.5 !bg-surface-700 !border-2 !border-surface-900 !rounded-full !-left-[6px] hover:!bg-indigo-400 hover:!scale-125 transition-all"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={`${col.name}-source`}
                className="!w-2.5 !h-2.5 !bg-surface-700 !border-2 !border-surface-900 !rounded-full !-right-[6px] hover:!bg-indigo-400 hover:!scale-125 transition-all"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />

              {/* Selection Checkbox */}
              <div className="flex items-center gap-2 flex-1 pointer-events-none min-w-0">
                {isSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-surface-600 shrink-0" />
                )}
                <span className={`text-[11px] truncate ${isSelected ? 'text-indigo-200' : 'text-surface-300'}`}>
                  {col.name}
                </span>
                <span className="ml-auto text-[9px] text-surface-600 font-mono uppercase shrink-0">{col.data_type}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
