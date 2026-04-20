import { Handle, Position } from '@xyflow/react'
import { Key, Plus, Trash2, Database, Edit2 } from 'lucide-react'
import { memo } from 'react'

/**
 * Custom Table Node for React Flow.
 * Features:
 * - List of columns with handles
 * - Inline Column handles (Source for connection)
 * - Actions overlay (Add field)
 */
const TableNode = ({ data }) => {
  const { table, onAddColumn, onDropTable, onDropColumn, onModifyColumn } = data

  return (
    <div className="bg-surface-900 border-2 border-surface-700/60 rounded-xl shadow-2xl min-w-[220px] overflow-hidden group/node animate-fade-in-scale">
      {/* Header */}
      <div className="bg-surface-800/80 px-3 py-2.5 border-b border-surface-700/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Database className="w-4 h-4 text-primary-400 shrink-0" />
          <span className="text-xs font-bold text-white truncate">{table.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
          <button
            className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-primary-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); onAddColumn?.(table) }}
            title="Add field"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 hover:bg-red-500/10 rounded text-surface-400 hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDropTable?.(table) }}
            title="Drop table"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="py-1">
        {table.columns.map((col, idx) => (
          <div
            key={col.name}
            className="group/col relative flex items-center gap-2 px-3 py-1.5 hover:bg-surface-800/40 transition-colors"
          >
            {/* Handle for connecting (Left - Target) */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${col.name}-target`}
              className="!w-2 !h-2 !bg-primary-500 !border-2 !border-surface-900 !-left-1 !top-1/2 !-translate-y-1/2 hover:!w-3 hover:!h-3 transition-all !opacity-0 group-hover/node:!opacity-100"
            />

            {/* Column Info */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 z-0">
              {col.is_primary ? (
                <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full border border-surface-600 shrink-0" />
              )}
              <span className={`text-[11px] truncate ${col.is_primary ? 'text-amber-200 font-semibold' : 'text-surface-200'}`}>
                {col.name}
              </span>
              <span className="ml-auto text-surface-600 font-mono text-[9px] uppercase">{col.data_type}</span>
            </div>

            {/* Adjust column actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity z-20">
               <button
                  className="p-0.5 text-surface-400 hover:text-primary-400"
                  onClick={(e) => { e.stopPropagation(); onModifyColumn?.(col.name, table, col) }}
                  title="Modify Column"
               >
                  <Edit2 className="w-2.5 h-2.5" />
               </button>
               <button
                  className="p-0.5 text-surface-400 hover:text-red-400"
                  onClick={(e) => { e.stopPropagation(); onDropColumn?.(col.name, table) }}
                  title="Drop Column"
               >
                  <Trash2 className="w-2.5 h-2.5" />
               </button>
            </div>

            {/* Handle for connecting (Right - Source) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${col.name}-source`}
              className="!w-2 !h-2 !bg-primary-500 !border-2 !border-surface-900 !-right-1 !top-1/2 !-translate-y-1/2 hover:!w-3 hover:!h-3 transition-all !opacity-0 group-hover/node:!opacity-100"
            />
          </div>
        ))}
      </div>

      {/* Footer / Empty State */}
      {table.columns.length === 0 && (
         <div className="px-3 py-4 text-center">
            <p className="text-[10px] text-surface-600 italic">No fields</p>
         </div>
      )}
    </div>
  )
}

export default memo(TableNode)
