import { useState } from 'react'
import { GitBranch, ArrowRight, RefreshCw, Database } from 'lucide-react'

export default function CreateRelationshipModal({ source: initialSource, target: initialTarget, sourceTable: initialSourceTable, targetTable: initialTargetTable, onSubmit, onCancel, isLoading }) {
  const [cardinality, setCardinality] = useState('1:n')
  
  // Internal state to allow editing before submit
  const [source, setSource] = useState(initialSource)
  const [target, setTarget] = useState(initialTarget)
  const [sourceTable, setSourceTable] = useState(initialSourceTable)
  const [targetTable, setTargetTable] = useState(initialTargetTable)

  const handleSwap = () => {
    const oldSource = { ...source }
    const oldTarget = { ...target }
    const oldSourceTable = { ...sourceTable }
    const oldTargetTable = { ...targetTable }

    setSource(oldTarget)
    setTarget(oldSource)
    setSourceTable(oldTargetTable)
    setTargetTable(oldSourceTable)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      source,
      target,
      cardinality
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-slide-up-modal max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
            <div className="flex items-center justify-between w-full pr-8">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <GitBranch className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white leading-none">Configure Relationship</h3>
                        <p className="text-[10px] text-surface-500 mt-1 uppercase tracking-wider font-bold">SQL Constraint Settings</p>
                    </div>
                </div>
                <button 
                  type="button"
                  onClick={handleSwap}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 hover:border-primary-500/50 text-surface-400 hover:text-primary-400 transition-all group shadow-lg"
                  title="Swap Direction"
                >
                    <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Swap Direction</span>
                </button>
            </div>
        </div>

        <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-8">
                {/* Visual Connector Structure */}
                <div className="grid grid-cols-[1fr,40px,1fr] items-center gap-6">
                    {/* Left Side: Parent/Source */}
                    <div className="p-4 bg-surface-900 border border-surface-800 rounded-2xl relative overflow-hidden group hover:border-primary-500/30 transition-colors">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary-500/50" />
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-3.5 h-3.5 text-primary-400" />
                            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Parent (PK/Unique)</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-bold text-white mb-2">{source.table}</p>
                                <select 
                                    className="input !py-1.5 !px-3 !text-[11px] !bg-surface-950"
                                    value={source.column}
                                    onChange={(e) => setSource({ ...source, column: e.target.value })}
                                >
                                    {sourceTable?.columns?.map(col => (
                                        <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Center Arrow */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center shadow-2xl">
                             <ArrowRight className="w-5 h-5 text-primary-500" />
                        </div>
                        <span className="text-[9px] font-black text-surface-600 uppercase italic tracking-tighter">REFERENCES</span>
                    </div>

                    {/* Right Side: Child/Target */}
                    <div className="p-4 bg-surface-900 border border-surface-800 rounded-2xl relative overflow-hidden group hover:border-primary-500/30 transition-colors">
                        <div className="absolute top-0 right-0 w-1 h-full bg-primary-500/50" />
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-3.5 h-3.5 text-primary-400" />
                            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Child (Foreign Key)</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-bold text-white mb-2">{target.table}</p>
                                <select 
                                    className="input !py-1.5 !px-3 !text-[11px] !bg-surface-950"
                                    value={target.column}
                                    onChange={(e) => setTarget({ ...target, column: e.target.value })}
                                >
                                    {targetTable?.columns?.map(col => (
                                        <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cardinality Configuration */}
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest block mb-3">Relationship Cardinality</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setCardinality('1:n')}
                                className={`group p-4 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                                    cardinality === '1:n' 
                                    ? 'border-primary-500 bg-primary-500/5 shadow-[0_0_20px_rgba(79,70,229,0.1)]' 
                                    : 'border-surface-800 bg-surface-900/50 hover:border-surface-700'
                                }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${cardinality === '1:n' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-500 group-hover:bg-surface-700'}`}>
                                        <span className="text-xs font-black">1:N</span>
                                    </div>
                                    <p className="text-xs font-bold text-white">One-to-Many</p>
                                </div>
                                <p className="text-[10px] text-surface-500 leading-relaxed font-medium">
                                    One record in <span className="text-surface-300">"{source.table}"</span> can relate to multiple records in <span className="text-surface-300">"{target.table}"</span>.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCardinality('1:1')}
                                className={`group p-4 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                                    cardinality === '1:1' 
                                    ? 'border-primary-500 bg-primary-500/5 shadow-[0_0_20px_rgba(79,70,229,0.1)]' 
                                    : 'border-surface-800 bg-surface-900/50 hover:border-surface-700'
                                }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${cardinality === '1:1' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-500 group-hover:bg-surface-700'}`}>
                                        <span className="text-xs font-black">1:1</span>
                                    </div>
                                    <p className="text-xs font-bold text-white">One-to-One</p>
                                </div>
                                <p className="text-[10px] text-surface-500 leading-relaxed font-medium">
                                    One record in <span className="text-surface-300">"{source.table}"</span> relates to exactly one record in <span className="text-surface-300">"{target.table}"</span>.
                                </p>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Validation Warning */}
                <div className="flex gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <p className="text-[11px] text-amber-200/60 leading-relaxed italic">
                        The DB will enforce that all values in <span className="font-bold text-amber-400">"{target.table}.{target.column}"</span> exist in <span className="font-bold text-white">"{source.table}.{source.column}"</span>.
                    </p>
                </div>
            </div>

            <div className="modal-footer !bg-surface-950/50">
                <button type="button" className="btn-ghost !text-[11px] font-bold uppercase tracking-wider" onClick={onCancel}>Cancel</button>
                <div className="flex items-center gap-3">
                    <div className="h-6 w-[1px] bg-surface-800 mr-1" />
                    <button type="submit" className="btn-primary !px-8 !py-2.5 !text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 group shadow-xl" disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Deploy Foreign Key'}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  )
}
