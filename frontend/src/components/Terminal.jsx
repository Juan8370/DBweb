import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql as sqlLanguage } from '@codemirror/lang-sql'
import { EditorView, keymap } from '@codemirror/view'
import { 
  Play, 
  Loader2, 
  Copy, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Terminal as TerminalIcon,
  Sparkles, History, Check, X, Bookmark, ChevronDown, Search, Plus,
  Database, List
} from 'lucide-react'
import { getSnippets, saveSnippet, deleteSnippet } from '../lib/snippets'
import ContextMenu from './ContextMenu'

// ---------------------------------------------------------------------------
// Error Humanizer
// ---------------------------------------------------------------------------
function humanizeError(err) {
  if (!err) return null
  const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err)
  
  // Strip common driver noise
  let clean = msg
    .replace(/\(psycopg2\.errors\.\w+\)\s+/i, '')
    .replace(/\[SQL: '.*'\]/is, '')
    .split('(Background on this error at:')[0]
    .trim()

  // Common pattern translations
  if (clean.includes('syntax error at or near')) return `Syntax Error: ${clean.split('at or near')[1]}`
  if (clean.includes('duplicate key value violates unique constraint')) return 'Duplicate Entry: A record with this unique value already exists.'
  if (clean.includes('violates foreign key constraint')) return 'Constraint Error: This operation depends on or is used by another record.'
  if (clean.includes('column') && clean.includes('does not exist')) return `Structure Error: ${clean}`
  if (clean.includes('relation') && clean.includes('does not exist')) return `Structure Error: Table not found.`
  
  return clean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default memo(function Terminal({ schema, onExecute, isExecuting, result, error, logs, onClearLogs, loadedSnippet, connectionInfo }) {
  const [sql, setSQL] = useState('SELECT * FROM employees LIMIT 10;')
  const [allowDestructive, setAllowDestructive] = useState(false)
  const [activeTab, setActiveTab] = useState('data') // 'data' | 'console'
  const [colWidths, setColWidths] = useState({}) // { colName: width }
  const [history, setHistory] = useState([])
  const [snippets, setSnippets] = useState([])
  const [showSnippets, setShowSnippets] = useState(false)
  const [snippetSearch, setSnippetSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [newSnippetName, setNewSnippetName] = useState('')
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [contextMenu, setContextMenu] = useState(null)
  
  const [bottomHeight, setBottomHeight] = useState(240)
  const isResizingRef = useRef(false)
  const editorRef = useRef(null)
  const outputRef = useRef(null)

  const connectionContext = useMemo(() => ({
    dbName: connectionInfo?.database || schema?.database || '',
    dbType: connectionInfo?.db_type || '',
    host: connectionInfo?.host || ''
  }), [connectionInfo?.database, connectionInfo?.db_type, connectionInfo?.host, schema?.database])

  // Resizable Logic
  const startResizing = useCallback((e) => {
    isResizingRef.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const stopResizing = useCallback(() => {
    isResizingRef.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isResizingRef.current) return
    const newHeight = window.innerHeight - e.clientY
    setBottomHeight(Math.max(140, Math.min(newHeight, window.innerHeight - 300)))
  }, [])

  // Column Resizing Logic
  const resizingColRef = useRef(null)
  
  const onColResizeStart = useCallback((e, colName) => {
    e.preventDefault()
    resizingColRef.current = { name: colName, startX: e.pageX, startWidth: colWidths[colName] || 150 }
    document.addEventListener('mousemove', onColResizeMove)
    document.addEventListener('mouseup', onColResizeEnd)
    document.body.style.cursor = 'col-resize'
  }, [colWidths])

  const onColResizeMove = useCallback((e) => {
    if (!resizingColRef.current) return
    const { name, startX, startWidth } = resizingColRef.current
    const delta = e.pageX - startX
    const newWidth = Math.max(60, startWidth + delta)
    setColWidths(prev => ({ ...prev, [name]: newWidth }))
  }, [])

  const onColResizeEnd = useCallback(() => {
    resizingColRef.current = null
    document.removeEventListener('mousemove', onColResizeMove)
    document.removeEventListener('mouseup', onColResizeEnd)
    document.body.style.cursor = 'default'
  }, [onColResizeMove])

  // Map database schema to CodeMirror format: { tableName: [colNames] }
  const cmSchema = useMemo(() => {
    if (!schema?.tables) return {}
    const map = {}
    schema.tables.forEach(t => {
      map[t.name] = t.columns.map(c => c.name)
    })
    return map
  }, [schema])

  // Auto-switch tabs and scroll
  useEffect(() => {
    if (loadedSnippet) {
      setSQL(loadedSnippet.content)
      setActiveTab('data')
    }
  }, [loadedSnippet])

  const refreshLocalSnippets = useCallback(async () => {
    const data = await getSnippets(connectionContext)
    setSnippets(data.filter(s => s.type === 'sql'))
  }, [connectionContext])

  useEffect(() => {
    refreshLocalSnippets()
    window.addEventListener('dbweb_snippets_updated', refreshLocalSnippets)
    return () => window.removeEventListener('dbweb_snippets_updated', refreshLocalSnippets)
  }, [refreshLocalSnippets])

  const handleSaveSnippet = async () => {
    if (!newSnippetName.trim() || !sql.trim()) return
    await saveSnippet(newSnippetName, 'sql', sql, connectionContext)
    setNewSnippetName('')
    setIsSaving(false)
  }

  useEffect(() => {
    if (error) {
        setActiveTab('console')
    } else if (result?.columns?.length > 0) {
        setActiveTab('data')
    } else if (result) {
        setActiveTab('console')
    }
  }, [result, error])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [logs])

  const handleExecute = useCallback((content = sql) => {
    if (!content.trim()) return
    setHistory((h) => [content, ...h.slice(0, 49)])
    setHistoryIdx(-1)
    onExecute({ sql: content.trim(), allowDestructive })
  }, [sql, allowDestructive, onExecute])

  // History Navigation Helpers
  const goBackHistory = useCallback(() => {
    setHistoryIdx((i) => {
      const next = Math.min(i + 1, history.length - 1)
      if (history[next]) setSQL(history[next])
      return next
    })
  }, [history])

  const goForwardHistory = useCallback(() => {
    setHistoryIdx((i) => {
      const next = Math.max(i - 1, -1)
      setSQL(next === -1 ? '' : history[next])
      return next
    })
  }, [history])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const contextMenuItems = useMemo(() => [
    { label: 'Execute SQL', icon: Play, onClick: () => handleExecute() },
    { label: 'Format SQL', icon: FileText, onClick: () => setSQL(prev => prev.replace(/\s+/g, ' ').trim()) },
    { divider: true },
    { label: 'Clear Editor', icon: Trash2, onClick: () => setSQL('') },
    { label: 'Clear Logs', icon: Clock, onClick: onClearLogs },
    { divider: true },
    { label: 'Copy All SQL', icon: Copy, onClick: () => navigator.clipboard.writeText(sql) },
  ], [handleExecute, onClearLogs, sql])

  const hasDangerous = /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i.test(sql)

  // Custom keybindings extension
  const customKeymaps = useMemo(() => keymap.of([
    {
      key: 'Ctrl-Enter',
      run: (view) => {
        handleExecute(view.state.doc.toString())
        return true
      }
    },
    {
      key: 'Cmd-Enter',
      run: (view) => {
        handleExecute(view.state.doc.toString())
        return true
      }
    },
    {
      key: 'Alt-ArrowUp',
      run: () => {
        goBackHistory()
        return true
      }
    },
    {
      key: 'Alt-ArrowDown',
      run: () => {
        goForwardHistory()
        return true
      }
    }
  ]), [handleExecute, goBackHistory, goForwardHistory])

  const cleanError = useMemo(() => humanizeError(error), [error])

  return (
    <div className="flex flex-col h-full bg-surface-950" id="terminal" onContextMenu={handleContextMenu}>
      {/* Editor area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-surface-900 border-b border-surface-800">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                <span className="text-[10px] font-bold text-surface-200 uppercase tracking-widest">Query Console</span>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-950/50 rounded border border-surface-800/40">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Intellisense</span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasDangerous && (
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight cursor-pointer px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20">
                <input
                  type="checkbox"
                  checked={allowDestructive}
                  onChange={(e) => setAllowDestructive(e.target.checked)}
                  className="w-3 h-3 rounded border-amber-500 bg-surface-900 text-amber-500 focus:ring-amber-500/50"
                />
                <span className="text-amber-500">Unsafe Mode</span>
              </label>
            )}
            <button
              className="p-1.5 hover:bg-surface-800 text-surface-400 hover:text-white rounded transition-all"
              onClick={() => navigator.clipboard.writeText(sql)}
              title="Copy SQL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Snippet Selector */}
            <div className="relative">
                <button
                    className={`flex items-center gap-2 p-1.5 hover:bg-surface-800 text-surface-400 hover:text-amber-400 rounded transition-all ${showSnippets ? 'text-amber-400 bg-surface-800' : ''}`}
                    onClick={() => setShowSnippets(!showSnippets)}
                    title="Saved Queries"
                >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Snippets</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSnippets ? 'rotate-180' : ''}`} />
                </button>

                {showSnippets && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-surface-900 border border-surface-800 rounded-xl shadow-2xl z-[60] animate-fade-in overflow-hidden">
                        <div className="p-2 border-b border-surface-800">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-600" />
                                <input 
                                    className="w-full bg-surface-950 border border-surface-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white placeholder:text-surface-600 focus:outline-none focus:border-primary-500/50"
                                    placeholder="Search your queries..."
                                    autoFocus
                                    value={snippetSearch}
                                    onChange={(e) => setSnippetSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-auto custom-scrollbar grayscale-[0.5] hover:grayscale-0 transition-all">
                            {snippets.filter(s => s.name.toLowerCase().includes(snippetSearch.toLowerCase())).length === 0 ? (
                                <div className="p-4 text-center text-surface-600 text-[10px] italic">No saved queries found</div>
                            ) : (
                                snippets.filter(s => s.name.toLowerCase().includes(snippetSearch.toLowerCase())).map(s => (
                                    <div key={s.id} className="group p-2 hover:bg-surface-800/50 flex items-center gap-2 transition-colors border-b border-surface-800/30 last:border-0">
                                        <button 
                                            className="flex-1 text-left min-w-0"
                                            onClick={() => { setSQL(s.content); setShowSnippets(false) }}
                                        >
                                            <div className="text-[11px] font-bold text-surface-200 truncate">{s.name}</div>
                                            <div className="text-[9px] text-surface-600 truncate font-mono">{s.content.slice(0, 30)}...</div>
                                        </button>
                                        <button 
                                            className="hidden group-hover:block p-1 text-red-500/40 hover:text-red-500"
                                            onClick={() => deleteSnippet(s.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-2 bg-surface-950/50 border-t border-surface-800">
                            {isSaving ? (
                                <div className="flex items-center gap-1 animate-fade-in">
                                    <input 
                                        className="flex-1 bg-surface-900 border border-primary-500/50 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                                        placeholder="Name this query..."
                                        value={newSnippetName}
                                        onChange={(e) => setNewSnippetName(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveSnippet()}
                                    />
                                    <button className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded" onClick={handleSaveSnippet}><Check className="w-3.5 h-3.5" /></button>
                                    <button className="p-1 text-red-400 hover:bg-red-400/10 rounded" onClick={() => setIsSaving(false)}><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ) : (
                                <button 
                                    className="w-full flex items-center justify-center gap-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-primary-400 hover:bg-primary-500/10 rounded transition-all"
                                    onClick={() => setIsSaving(true)}
                                    disabled={!sql.trim()}
                                >
                                    <Plus className="w-3 h-3" />
                                    Save Current Query
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {result?.rows?.length > 0 && (
              <div className="flex items-center gap-1 border-l border-surface-800 pl-2 ml-1">
                <button
                  className="p-1.5 hover:bg-surface-800 text-surface-400 hover:text-emerald-400 rounded transition-all flex items-center gap-1.5"
                  onClick={() => {
                    const headers = result.columns.join(',')
                    const csv = [headers, ...result.rows.map(r => r.join(','))].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'export.csv'; a.click()
                  }}
                  title="Export CSV"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold">CSV</span>
                </button>
                <button
                  className="p-1.5 hover:bg-surface-800 text-surface-400 hover:text-blue-400 rounded transition-all flex items-center gap-1.5"
                  onClick={() => {
                    const json = result.rows.map(r => {
                      const obj = {}
                      result.columns.forEach((c, i) => obj[c] = r[i])
                      return obj
                    })
                    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'export.json'; a.click()
                  }}
                  title="Export JSON"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold">JSON</span>
                </button>
              </div>
            )}

            <button
              className="btn-primary !py-1 !px-3 !text-[10px] h-7 font-bold uppercase tracking-wider"
              onClick={() => handleExecute()}
              disabled={isExecuting || !sql.trim()}
              id="execute-btn"
            >
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Run Query
            </button>
          </div>
        </div>

        {/* Code Custom Editor */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-surface-950/20">
           <CodeMirror
             value={sql}
             height="100%"
             theme="dark"
             onChange={(val) => setSQL(val)}
             extensions={[
               sqlLanguage({ schema: cmSchema }),
               customKeymaps,
               EditorView.lineWrapping,
               EditorView.theme({
                 "&": { fontSize: "14px", height: "100%", backgroundColor: "transparent" },
                 ".cm-content": { fontFamily: "JetBrains Mono, Fira Code, monospace", padding: "16px" },
                 ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "rgb(var(--surface-600))", userSelect: "none", width: "40px" },
                 ".cm-activeLine": { backgroundColor: "rgba(var(--primary-500), 0.04)" },
                 ".cm-activeLineGutter": { backgroundColor: "transparent", color: "rgb(var(--primary-400))", fontWeight: "bold" },
                 ".cm-selectionBackground": { backgroundColor: "rgba(var(--primary-500), 0.25) !important" },
                 ".cm-cursor": { borderLeftColor: "rgb(var(--primary-400))", borderLeftWidth: "2px" }
               })
             ]}
             className="h-full"
           />
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="h-1 cursor-row-resize bg-surface-800/80 hover:bg-primary-500/50 transition-colors z-30" 
      />

      {/* Output panel */}
      <div 
        style={{ height: bottomHeight }}
        className="min-h-[140px] flex flex-col border-t border-surface-800/80 bg-surface-950"
      >
        {/* Output Tabs */}
        <div className="flex items-center justify-between px-2 bg-surface-900/60 border-b border-surface-800/40">
           <div className="flex">
               <button 
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'data' ? 'text-primary-400' : 'text-surface-500 hover:text-surface-300'}`}
               >
                  <Database className="w-3.5 h-3.5" />
                  Data {result?.row_count !== undefined && <span className="text-[9px] opacity-60">({result.row_count})</span>}
                  {activeTab === 'data' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400" />}
               </button>
               <button 
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'console' ? 'text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
               >
                  <List className="w-3.5 h-3.5" />
                  Console
                  {activeTab === 'console' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-200" />}
               </button>
           </div>
           
           <div className="px-4 flex items-center gap-3">
              {isExecuting && (
                <div className="flex items-center gap-2 text-primary-400 text-[10px] font-bold uppercase animate-pulse">
                   <Loader2 className="w-3 h-3 animate-spin" />
                   Processing...
                </div>
              )}
              {result && !isExecuting && (
                <div className="text-[10px] text-surface-500 font-mono">
                   {result.execution_time_ms}ms
                </div>
              )}
           </div>
        </div>

        <div ref={outputRef} className="flex-1 overflow-auto custom-scrollbar relative">
            {activeTab === 'data' ? (
                <>
                 {/* Result table */}
                 {result && result.columns?.length > 0 ? (
                    <div className="animate-fade-in overflow-auto h-full">
                        {(() => {
                           const maxIndex = result.rows.length
                           const digits = maxIndex.toString().length
                           // 7px approx per mono character + 20px (10px each side)
                           const idxW = `${(digits * 7) + 20}px`
                           
                           return (
                            <table className="text-[11px] font-mono border-collapse" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                            <thead className="sticky top-0 z-40 bg-surface-900 shadow-md">
                                <tr className="bg-surface-900 border-b border-surface-700">
                                 <th style={{ width: idxW }} className="p-0 text-center text-surface-500 font-bold border-r border-surface-800">
                                    #
                                 </th>
                                 {result.columns.map((col) => (
                                    <th
                                    key={col}
                                    style={{ width: colWidths[col] || 150 }}
                                    className="text-left px-4 py-2.5 text-primary-300 font-bold uppercase tracking-tight whitespace-nowrap border-r border-surface-800/40 relative"
                                    >
                                    <div className="truncate">{col}</div>
                                    <div 
                                        onMouseDown={(e) => onColResizeStart(e, col)}
                                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/50 transition-colors z-10"
                                    />
                                    </th>
                                ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-800/10">
                                {result.rows.map((row, i) => (
                                <tr
                                    key={i}
                                    className="hover:bg-primary-500/5 transition-colors group"
                                >
                                    <td style={{ width: idxW }} className="p-0 text-center text-surface-600 font-mono border-r border-surface-800 text-[10px]">
                                        {i + 1}
                                    </td>
                                    {row.map((cell, j) => {
                                        const colName = result.columns[j]
                                        return (
                                            <td 
                                                key={j} 
                                                style={{ width: colWidths[colName] || 150 }}
                                                className="px-4 py-2 text-surface-300 whitespace-nowrap border-surface-800/10 border-r overflow-hidden truncate"
                                            >
                                                {cell === null ? (
                                                <span className="text-surface-700 italic">NULL</span>
                                                ) : (
                                                String(cell)
                                                )}
                                            </td>
                                        )
                                    })}
                                </tr>
                                ))}
                            </tbody>
                            </table>
                           )
                        })()}
                    </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center h-full text-surface-600 gap-2">
                        <Database className="w-6 h-6 opacity-20" />
                        <span className="text-[10px] uppercase font-bold tracking-widest italic opacity-40">
                            No dataset returned
                        </span>
                    </div>
                    )}
                </>
            ) : (
                <div className="p-4 space-y-4 font-mono text-[12px]">
                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg flex items-start gap-4 animate-fade-in max-w-4xl">
                            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div className="font-bold text-red-400 uppercase tracking-tighter text-[10px]">Command Error</div>
                                <div className="text-red-200/90 leading-relaxed whitespace-pre-wrap">{cleanError}</div>
                            </div>
                        </div>
                    )}

                    {/* DML Success Message */}
                    {result && !result.columns?.length && result.message && (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-4 animate-fade-in max-w-4xl">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div className="space-y-0.5">
                                <div className="font-bold text-emerald-400 uppercase tracking-tighter text-[10px]">Success</div>
                                <div className="text-emerald-200/90">{result.message}</div>
                            </div>
                        </div>
                    )}

                    {/* Log stream */}
                    {logs && logs.length > 0 && (
                        <div className="space-y-1.5 opacity-80 pl-1">
                            {logs.slice(-50).map((log, i) => {
                                // Skip noisy success logs in selection mode if they just say "Query OK"
                                if (log.message.includes('Query OK') && result?.columns?.length > 0) return null
                                
                                return (
                                    <div key={i} className="flex items-start gap-3 group">
                                        <div className="text-[10px] text-surface-700 w-16 shrink-0 pt-0.5 italic">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                                        </div>
                                        <span
                                            className={`
                                                flex-1
                                                ${log.type === 'error' ? 'text-red-400/80' : 
                                                log.type === 'success' ? 'text-emerald-400/80' : 
                                                'text-surface-500'}
                                            `}
                                        >
                                            {log.message}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
      
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
})
