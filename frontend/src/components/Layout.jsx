import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { 
  Database, GitBranch, Table2, TerminalSquare, LogOut, 
  ChevronDown, ChevronRight, Columns3, Key, RefreshCw, 
  Loader2, Plus, PenLine, Trash2, Eye, Wand2, Menu, X, 
  ChevronLeft, Search, Bookmark, Edit2, Check, ExternalLink, FileText
} from 'lucide-react'
import ContextMenu from './ContextMenu'
import ThemeSwitcher from './ThemeSwitcher'
import { getSnippets, deleteSnippet, updateSnippet } from '../lib/snippets'

export default function Layout({
  children,
  schema,
  activeTab,
  onTabChange,
  selectedTable,
  onTableSelect,
  onDisconnect,
  isSchemaLoading,
  onRefreshSchema,
  connectionInfo,
  onCreateTable,
  onRenameTable,
  onDropTable,
  onAddColumn,
  theme,
  onThemeChange,
  onSnippetSelect,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedTables, setExpandedTables] = useState(new Set())
  const [snippetsOpen, setSnippetsOpen] = useState(true)
  const [snippets, setSnippets] = useState([])
  const [snippetSearch, setSnippetSearch] = useState('')
  const [editingSnippet, setEditingSnippet] = useState(null)
  const [editName, setEditName] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [tableSearch, setTableSearch] = useState('')
  const isResizingRef = useRef(false)

  const connectionContext = useMemo(() => ({
    dbName: connectionInfo?.database || schema?.database || '',
    dbType: connectionInfo?.db_type || '',
    host: connectionInfo?.host || ''
  }), [connectionInfo?.database, connectionInfo?.db_type, connectionInfo?.host, schema?.database])

  // Load snippets and listen for updates
  const refreshSnippets = useCallback(async () => {
    const data = await getSnippets(connectionContext)
    setSnippets(data)
  }, [connectionContext])

  useEffect(() => {
    refreshSnippets()
    window.addEventListener('dbweb_snippets_updated', refreshSnippets)
    return () => window.removeEventListener('dbweb_snippets_updated', refreshSnippets)
  }, [refreshSnippets])

  // Sidebar Resizing Logic
  const startResizing = useCallback((e) => {
    isResizingRef.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'col-resize'
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
    const newWidth = e.clientX
    if (newWidth > 150 && newWidth < 600) {
      setSidebarWidth(newWidth)
    }
  }, [])

  // Handle auto-closing mobile sidebar on tab change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [activeTab, selectedTable])

  const toggleTable = (name) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleContextMenu = useCallback((e, table) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'table',
      table,
    })
  }, [])

  const handleGlobalContextMenu = useCallback((e) => {
    if (e.target.closest('#er-diagram') || e.target.closest('#data-table')) return
    e.preventDefault()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'global'
      })
  }, [])

  const tabs = [
    { id: 'er',       label: 'ER Diagram',    icon: GitBranch },
    { id: 'query',    label: 'Query Builder', icon: Wand2 },
    { id: 'data',     label: 'Data',           icon: Table2 },
    { id: 'terminal', label: 'Terminal',       icon: TerminalSquare },
    { id: 'docs',     label: 'Documentation',  icon: FileText },
  ]

  const tableCount = schema?.tables?.length ?? 0

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []
    if (contextMenu.type === 'table') {
      return [
        { label: 'View Data', icon: Eye, onClick: () => { onTableSelect(contextMenu.table.name); onTabChange('data') } },
        { divider: true },
        { label: 'Add Column', icon: Plus, onClick: () => onAddColumn?.(contextMenu.table) },
        { label: 'Rename Table', icon: PenLine, onClick: () => onRenameTable?.(contextMenu.table) },
        { divider: true },
        { label: 'Drop Table', icon: Trash2, danger: true, onClick: () => onDropTable?.(contextMenu.table) },
      ]
    }
    if (contextMenu.type === 'global') {
      return [
        { label: 'Refresh Schema', icon: RefreshCw, onClick: onRefreshSchema },
        { label: 'Create New Table', icon: Plus, onClick: () => onCreateTable?.() },
        { divider: true },
        { label: 'Disconnect', icon: LogOut, danger: true, onClick: onDisconnect },
      ]
    }
    return []
  }, [contextMenu, onTableSelect, onTabChange, onAddColumn, onRenameTable, onDropTable, onRefreshSchema, onCreateTable, onDisconnect])

  const renderTables = () => {
    if (isSchemaLoading) {
      return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-primary-400 animate-spin" /></div>
    }
    if (!schema?.tables?.length) {
      return <p className="text-xs text-surface-600 px-3 py-4">No tables found.</p>
    }
    
    const filtered = schema.tables.filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()))
    
    if (filtered.length === 0 && tableSearch) {
        return <p className="text-[10px] text-surface-600 px-3 py-4 italic">No matching tables.</p>
    }

    return filtered.map((table) => {
      const isExpanded = expandedTables.has(table.name)
      const isSelected = selectedTable === table.name
      return (
        <div key={table.name} className="animate-fade-in text-nowrap">
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-all ${isSelected ? 'bg-primary-600/10 text-primary-300 border-r-2 border-primary-500' : 'text-surface-300 hover:bg-surface-800/50 hover:text-surface-100'}`}
            onClick={() => { onTableSelect(table.name); toggleTable(table.name) }}
            onContextMenu={(e) => handleContextMenu(e, table)}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3 text-surface-500" /> : <ChevronRight className="w-3 h-3 text-surface-500" />}
            <Table2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-medium">{table.name}</span>
          </button>
          {isExpanded && (
            <div className="ml-6 py-0.5 border-l border-surface-800/40">
              {table.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-surface-400">
                  {col.is_primary ? <Key className="w-2.5 h-2.5 text-amber-400" /> : <span className="w-2.5 h-2.5 rounded-full border border-surface-600" />}
                  <span className="truncate">{col.name}</span>
                  <span className="ml-auto text-surface-600 font-mono text-[9px] pr-2">{col.data_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    })
  }


  const filteredSnippets = useMemo(() => {
    return snippets.filter(s => 
        s.name.toLowerCase().includes(snippetSearch.toLowerCase()) ||
        s.type.toLowerCase().includes(snippetSearch.toLowerCase())
    )
  }, [snippets, snippetSearch])

  const startEditing = (snippet) => {
    setEditingSnippet(snippet.id)
    setEditName(snippet.name)
  }

  const saveEdit = () => {
    if (!editName.trim()) return
    updateSnippet(editingSnippet, editName)
    setEditingSnippet(null)
  }

  const renderSnippets = () => {
    if (filteredSnippets.length === 0) {
        return <p className="text-[10px] text-surface-600 px-3 py-4 italic">No snippets found.</p>
    }
    return filteredSnippets.map((snippet) => (
        <div key={snippet.id} className="group px-3 py-1.5 flex items-center gap-2 hover:bg-surface-800/30 transition-all rounded-md mx-1">
            <div className={`p-1 rounded ${snippet.type === 'sql' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {snippet.type === 'sql' ? <TerminalSquare className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
            </div>
            
            <div className="flex-1 min-w-0">
                {editingSnippet === snippet.id ? (
                    <input 
                        className="w-full bg-surface-900 border border-primary-500/30 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        autoFocus
                    />
                ) : (
                    <button 
                        className="w-full text-left text-[11px] text-surface-300 font-medium truncate hover:text-white transition-colors"
                        onClick={() => onSnippetSelect?.(snippet)}
                    >
                        {snippet.name}
                        <span className="block text-[9px] text-surface-600 font-normal">
                           {snippet.type === 'sql' ? 'Terminal SQL' : 'Query Builder'}
                        </span>
                    </button>
                )}
            </div>

            <div className="hidden group-hover:flex items-center gap-1.5">
                <button 
                   className="p-1 hover:text-primary-400 transition-colors"
                   onClick={() => startEditing(snippet)}
                >
                    <Edit2 className="w-3 h-3" />
                </button>
                <button 
                   className="p-1 hover:text-red-400 transition-colors"
                   onClick={() => deleteSnippet(snippet.id)}
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    ))
  }

  return (
    <div className="h-screen flex flex-col bg-surface-950 overflow-hidden" onContextMenu={handleGlobalContextMenu}>
      {/* Top Bar */}
      <header className="h-12 px-2 sm:px-4 flex items-center justify-between border-b border-surface-800/60 bg-surface-900/40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            className="lg:hidden btn-ghost !p-1.5"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary-400" />
            <span className="hidden xs:inline text-sm font-bold text-white tracking-tight">
              DB<span className="text-primary-400">web</span>
            </span>
          </div>

          {connectionInfo && (
            <div className="hidden md:flex items-center gap-2 ml-2 lg:ml-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span className="text-[10px] lg:text-xs text-surface-400 truncate max-w-[150px] lg:max-w-none">
                <span className="text-surface-300 font-medium">{connectionInfo.database}</span>
                {' · '}{connectionInfo.db_type}{' · '}{connectionInfo.host}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher current={theme} onChange={onThemeChange} />
          
          <button className="btn-ghost !p-1.5 text-red-400 lg:!px-2.5 lg:!py-1" onClick={onDisconnect}>
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline text-xs ml-1">Disconnect</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Desktop Sidebar */}
        <aside 
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
          className={`transition-all duration-300 ease-in-out border-r border-surface-800/60 bg-surface-900/30 hidden lg:flex flex-col shrink-0 overflow-hidden relative ${!sidebarOpen ? 'border-none' : ''}`}
        >
          <div className="px-3 py-3 border-b border-surface-800/40 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <Columns3 className="w-3.5 h-3.5" />
              Tables
              {tableCount > 0 && <span className="badge-primary !text-[9px] !px-1.5">{tableCount}</span>}
            </span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost !p-1 text-xs" onClick={() => onCreateTable?.()} title="Create Table">
                <Plus className="w-3.5 h-3.5 text-primary-400" />
              </button>
              <button className="btn-ghost !p-1 text-surface-500 hover:text-white" onClick={() => setSidebarOpen(false)} title="Collapse Sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-surface-800/20 bg-surface-950/20">
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-600" />
                <input 
                    className="w-full bg-surface-950 border border-surface-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-surface-400 placeholder:text-surface-700 focus:outline-none focus:border-primary-500/50 transition-all font-medium"
                    placeholder="Search tables..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                />
            </div>
          </div>
          <div className="flex-1 overflow-auto py-1 custom-scrollbar space-y-1">
            {/* Tables Section */}
            <div className="mb-2">
                {renderTables()}
            </div>

            {/* Snippets Section */}
            <div className="border-t border-surface-800/40 pt-2">
                <button 
                  onClick={() => setSnippetsOpen(!snippetsOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-surface-500 uppercase tracking-widest hover:text-surface-300 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Bookmark className="w-3 h-3" />
                        Snippets
                        {snippets.length > 0 && <span className="text-[9px] bg-surface-800 px-1.5 rounded-full">{snippets.length}</span>}
                    </div>
                    {snippetsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {snippetsOpen && (
                    <div className="animate-fade-in mt-1">
                        <div className="px-3 mb-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-600" />
                                <input 
                                    className="w-full bg-surface-950 border border-surface-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-surface-400 placeholder:text-surface-700 focus:outline-none focus:border-primary-500/50"
                                    placeholder="Search snippets..."
                                    value={snippetSearch}
                                    onChange={(e) => setSnippetSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="max-h-[300px] overflow-auto custom-scrollbar">
                           {renderSnippets()}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </aside>

        {/* Floating Toggle Button (Appears when sidebar is closed) */}
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex absolute left-4 bottom-8 w-11 h-11 bg-primary-600 hover:bg-primary-500 text-white rounded-full items-center justify-center shadow-2xl z-50 transition-all hover:scale-110 active:scale-95 animate-fade-in border-2 border-primary-400/20"
            title="Show Tables"
          >
            <Database className="w-5 h-5" />
          </button>
        )}

        {/* Vertical Resize Handle */}
        {sidebarOpen && (
          <div 
            onMouseDown={startResizing}
            className="hidden lg:block w-1 cursor-col-resize hover:bg-primary-500/40 transition-colors z-40 shrink-0 border-r border-transparent hover:border-primary-500/20" 
          />
        )}

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-[60] flex">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="relative w-72 h-full bg-surface-950 border-r border-surface-800 flex flex-col animate-slide-in">
              <div className="p-4 border-b border-surface-800 flex items-center justify-between">
                 <span className="font-bold text-white uppercase tracking-tight text-sm">Schema Explorer</span>
                 <button onClick={() => setMobileSidebarOpen(false)}><X className="w-5 h-5 text-surface-400" /></button>
              </div>
              <div className="flex-1 overflow-auto py-2">
                {renderTables()}
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-2 py-2 border-b border-surface-800/60 bg-surface-900/20 shrink-0 overflow-x-auto no-scrollbar">
            <div className="tab-bar inline-flex min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`${activeTab === tab.id ? 'tab-active' : 'tab'} !py-1.5 !px-3 sm:!px-4`}
                  onClick={() => onTabChange(tab.id)}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="text-xs sm:text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">{children}</div>
        </main>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
