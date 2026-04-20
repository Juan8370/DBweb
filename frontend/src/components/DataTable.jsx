import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Check,
  X,
  Pencil,
  Plus,
  Trash2,
  PenLine,
  Settings,
  Copy,
  Download,
  DownloadCloud,
  ChevronDown,
  Search,
  Filter,
  Link as LinkIcon,
  RefreshCcw,
  Maximize2,
  Save,
  ArrowRight,
  ArrowLeft,
  TableProperties,
  MoreVertical,
  Calendar,
  ToggleLeft,
  Phone,
  Layout,
  View,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react'
import * as api from '../lib/api'
import ContextMenu from './ContextMenu'

export default memo(function DataTable({
  sessionId,
  tableName,
  schemaName = 'public',
  columns: schemaCols,
  foreignKeys = [],
  onRenameColumn,
  onModifyColumn,
  onDropColumn,
  onDeleteRows,
  onBulkInsert,
  onEditTable,
  isImporting,
}) {
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState([])
  const [filters, setFilters] = useState({})
  const [filterDraft, setFilterDraft] = useState({})
  const [caseSensitive, setCaseSensitive] = useState(false)
  
  // Column Visibility State (Purely Frontend)
  const [columnVisibility, setColumnVisibility] = useState({})
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)
  const columnPickerRef = useRef(null)
  
  const [editingRowIdx, setEditingRowIdx] = useState(null)
  const [editingRowData, setEditingRowData] = useState({})
  const [selectedRows, setSelectedRows] = useState(new Set())
  
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const actionsRef = useRef(null)

  // Insertion States
  const [isInserting, setIsInserting] = useState(false)
  const [newRowData, setNewRowData] = useState({})

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null)

  const handleRowContextMenu = (e, rowData, index) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: 'Edit Row', icon: PenLine, onClick: () => { setEditingRowIdx(index); setEditingRowData({ ...rowData }) } },
            { label: 'Insert Row', icon: Plus, onClick: () => { setIsInserting(true); setNewRowData({}) } },
            { divider: true },
            { label: 'Delete Selected', icon: Trash2, danger: true, disabled: selectedRows.size === 0, onClick: () => onDeleteRows?.(Array.from(selectedRows)) },
        ]
    })
  }

  const handleHeaderContextMenu = (e, colId) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: `Rename "${colId}"`, icon: Pencil, onClick: () => onRenameColumn?.(colId) },
            { label: `Modify "${colId}"`, icon: Settings, onClick: () => onModifyColumn?.(colId) },
            { divider: true },
            { label: `Drop Column`, icon: Trash2, danger: true, onClick: () => onDropColumn?.(colId) },
        ]
    })
  }

  // ------- Infinite Query -------
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    refetch
  } = useInfiniteQuery({
    queryKey: ['table-data', sessionId, tableName, schemaName, sorting, filters, caseSensitive],
    queryFn: ({ pageParam = 1 }) => {
        const order = sorting[0]
        return api.fetchTableData(
            sessionId, tableName, schemaName, pageParam, 50, 
            order?.id, order?.desc ? 'desc' : 'asc', filters, caseSensitive
        )
    },
    getNextPageParam: (lastPage, allPages) => lastPage.rows.length === 50 ? allPages.length + 1 : undefined,
    enabled: !!sessionId && !!tableName,
  })

  // Flatten rows
  const rows = useMemo(() => {
    if (!data?.pages || !data.pages[0]?.columns) return []
    const cols = data.pages[0].columns
    const all = []
    data.pages.forEach(p => p.rows.forEach(r => {
        const o = {}; cols.forEach((c, j) => { o[c] = r[j] }); all.push(o)
    }))
    return all
  }, [data])

  const tableColumnsList = useMemo(() => data?.pages?.[0]?.columns || [], [data])
  const pkColumn = useMemo(() => schemaCols?.find(c => c.is_primary)?.name, [schemaCols])
  const relations = useMemo(() => {
    const list = []
    foreignKeys.forEach(fk => {
        if (fk.source_table === tableName) list.push({ type: 'OUT', from: fk.source_column, toTable: fk.target_table, toCol: fk.target_column })
        if (fk.target_table === tableName) list.push({ type: 'IN', fromTable: fk.source_table, fromCol: fk.source_column, to: fk.target_column })
    })
    return list
  }, [foreignKeys, tableName])

  // Handle Click Outside for Popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
        if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) setIsColumnPickerOpen(false)
        if (actionsRef.current && !actionsRef.current.contains(e.target)) setIsActionsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExportCSV = () => {
    const headers = tableColumnsList.join(',')
    const content = rows.map(r => tableColumnsList.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`${headers}\n${content}`], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${tableName}.csv`; a.click()
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${tableName}.json`; a.click()
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
        const text = event.target.result
        
        // Robust CSV Parser that handles quotes, commas and empty values
        const parseLine = (line) => {
            const cells = []
            let cur = ''
            let inQuote = false
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

        const lines = text.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) return

        const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
        const rows = []

        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i])
            const obj = {}
            headers.forEach((h, idx) => {
                let v = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '') : null
                if (v === '' || v === 'null') v = null
                else if (v !== null && !isNaN(v)) v = Number(v)
                obj[h] = v
            })
            rows.push(obj)
        }

        onBulkInsert?.(rows)
        setIsActionsOpen(false)
    }
    reader.readAsText(file)
  }

  // ------- Mutations -------
  const updateMutation = useMutation({
    mutationFn: async (payload) => {
        const pkVal = payload[pkColumn]
        const originalRow = rows[editingRowIdx]
        const updatePromises = []
        Object.keys(payload).forEach(col => {
            if (payload[col] !== originalRow[col] && col !== pkColumn) {
                updatePromises.push(api.updateCell(sessionId, tableName, schemaName, pkColumn, pkVal, col, payload[col]))
            }
        })
        return Promise.all(updatePromises)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table-data'] }); setEditingRowIdx(null); setEditingRowData({}) }
  })

  const insertMutation = useMutation({
    mutationFn: (data) => api.insertRecord(sessionId, tableName, schemaName, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table-data'] }); setIsInserting(false); setNewRowData({}) }
  })

  // Smart Input Renderer
  const renderCellInput = (colId, value, onChange, onKeyDown, autoFocus) => {
    const colInfo = schemaCols?.find(c => c.name === colId)
    const type = colInfo?.data_type?.toUpperCase() || ''
    
    if (type.includes('BOOL') || type.includes('TINYINT(1)')) {
        return (
            <select autoFocus={autoFocus} className="select !py-1 !px-2 !text-xs !bg-surface-950 !border-primary-500 w-full" value={value === true || value === 'true' || value === 1 ? '1' : '0'} onChange={e => onChange(e.target.value === '1')} onKeyDown={onKeyDown}>
                <option value="1">TRUE</option>
                <option value="0">FALSE</option>
            </select>
        )
    }

    if (type.includes('DATE') || type.includes('TIMESTAMP') || type.includes('DATETIME')) {
        return <div className="relative w-full"><input type="date" autoFocus={autoFocus} className="input !py-1 !px-2 !text-xs !bg-surface-950 !border-primary-500 w-full" value={value ? String(value).split('T')[0] : ''} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} /><Calendar className="absolute right-2 top-1.5 w-3 h-3 text-surface-600 pointer-events-none" /></div>
    }

    if (type.includes('INT') || type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('NUMBER')) {
        return <input type="number" autoFocus={autoFocus} className="input !py-1 !px-2 !text-xs !bg-surface-950 !border-primary-500 w-full" value={value ?? ''} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} />
    }

    return <input autoFocus={autoFocus} className="input !py-1 !px-2 !text-xs !bg-surface-950 !border-primary-500 w-full" value={value ?? ''} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} />
  }

  // ------- Column Def -------
  const columns = useMemo(() => {
    if (tableColumnsList.length === 0) return []
    const cols = []

    cols.push({
        id: '_select',
        header: '',
        cell: ({ row }) => <input type="checkbox" className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800" checked={pkColumn ? selectedRows.has(row.original[pkColumn]) : false} onChange={() => { if (!pkColumn) return; const n = new Set(selectedRows); const v = row.original[pkColumn]; n.has(v) ? n.delete(v) : n.add(v); setSelectedRows(n) }} />,
        size: 40,
        enableHiding: false
    })

    tableColumnsList.forEach((colId, cIdx) => {
      const colInfo = schemaCols?.find(c => c.name === colId)
      const rels = foreignKeys.filter(fk => (fk.source_table === tableName && fk.source_column === colId) || (fk.target_table === tableName && fk.target_column === colId))
      cols.push({
        accessorKey: colId,
        header: ({ column }) => (
            <button className="flex items-center justify-between w-full hover:text-white transition-colors group py-1" onClick={() => setSorting([{ id: colId, desc: column.getIsSorted() === 'asc' }])}>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[11px] font-bold uppercase tracking-tight truncate">{colId}</span>
                    {colInfo?.is_primary && <span className="text-[8px] font-black text-amber-500">PK</span>}
                    {rels.length > 0 && <LinkIcon className="w-2.5 h-2.5 text-primary-400 shrink-0" />}
                </div>
                {column.getIsSorted() === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-400" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="w-3 h-3 text-primary-400" /> : <ArrowUpDown className="w-3 h-3 opacity-20" />}
            </button>
        ),
        cell: ({ row, getValue }) => {
          const v = getValue(); const ri = row.index; const isSelectedRow = editingRowIdx === ri
          if (isSelectedRow) return renderCellInput(colId, editingRowData[colId], (newVal) => setEditingRowData(prev => ({ ...prev, [colId]: newVal })), (e) => {
            if (e.key === 'Enter') updateMutation.mutate(editingRowData); if (e.key === 'Escape') setEditingRowIdx(null)
          }, cIdx === 0)
          
          const startEdit = () => { if (pkColumn) { setEditingRowIdx(ri); setEditingRowData({ ...row.original }) } }
          return <div className="group flex items-center gap-2 cursor-pointer h-6" onDoubleClick={startEdit}><span className={`truncate ${v === null ? 'text-surface-600 italic' : 'text-surface-300'}`}>{v === null ? 'NULL' : String(v)}</span><Pencil className="w-2.5 h-2.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
        }
      })
    })

    cols.push({
        id: '_actions',
        header: '',
        cell: ({ row }) => {
            const ri = row.index
            const startEdit = () => { if (pkColumn) { setEditingRowIdx(ri); setEditingRowData({ ...row.original }) } }
            if (editingRowIdx === ri) return <div className="flex items-center gap-1"><button className="btn-icon !p-1 text-emerald-400" onClick={() => updateMutation.mutate(editingRowData)}><Save className="w-4 h-4" /></button><button className="btn-icon !p-1 text-red-400" onClick={() => setEditingRowIdx(null)}><X className="w-4 h-4" /></button></div>
            return <button className="btn-icon !p-1 text-surface-500 opacity-0 group-hover:opacity-100" onClick={startEdit}><PenLine className="w-4 h-4" /></button>
        },
        size: 70,
        enableHiding: false
    })

    return cols
  }, [tableColumnsList, pkColumn, selectedRows, editingRowIdx, editingRowData, schemaCols, updateMutation, foreignKeys, tableName])

  const table = useReactTable({ 
    data: rows, 
    columns, 
    getCoreRowModel: getCoreRowModel(), 
    state: { sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility
  })

  if (!tableName) return <div className="flex h-full items-center justify-center text-surface-600">Select a table</div>

  const handleApplyFilters = () => setFilters({ ...filterDraft })
  const hasFilters = Object.keys(filters).length > 0
  const hiddenCount = table.getAllLeafColumns().filter(c => !c.getIsVisible() && !['_select', '_actions'].includes(c.id)).length

  return (
    <div id="data-table" className="flex flex-col h-full bg-surface-950 overflow-hidden relative font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-950 z-20 shadow-xl">
        <div className="flex items-center gap-4">
            <div className="flex flex-col"><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-white tracking-tight">{tableName}</h2><div className={`px-1.5 py-0.5 rounded-sm font-black uppercase tracking-widest text-[9px] ${isFetching ? 'text-primary-400 animate-pulse' : 'text-surface-600'}`}>{isFetching ? 'Syncing' : `${rows.length} Rows`}</div></div></div>
        </div>

        <div className="flex items-center gap-2">
            <div className="relative" ref={columnPickerRef}>
                <button className={`btn-primary !bg-surface-800 !border-surface-700 hover:!bg-surface-700 !px-4 !py-2 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 group transition-all ${hiddenCount > 0 ? '!text-primary-400 !border-primary-500/30 bg-primary-500/5' : ''}`} onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}><Eye className="w-3.5 h-3.5" /><span>Columns {hiddenCount > 0 && `(${tableColumnsList.length - hiddenCount}/${tableColumnsList.length})`}</span></button>
                {isColumnPickerOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-surface-900 border border-surface-800 rounded-xl shadow-2xl z-50 animate-scale-in p-2">
                        <div className="p-2 border-b border-surface-800 flex items-center justify-between text-[10px] uppercase font-bold text-surface-500 tracking-widest">
                            <span>Field Visibility</span>
                            <button className="text-primary-400 hover:text-primary-300 transition-colors" onClick={() => setColumnVisibility({})}>Show All</button>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-1">
                            {table.getAllLeafColumns().filter(c => !['_select', '_actions'].includes(c.id)).map(col => {
                                // Direct access to state for reliability
                                const isVisible = columnVisibility[col.id] !== false
                                return (
                                    <button 
                                      key={col.id} 
                                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${isVisible ? 'bg-surface-800/40 text-surface-200' : 'text-surface-600 opacity-60 hover:opacity-100 hover:bg-surface-800/20'}`} 
                                      onClick={() => {
                                          setColumnVisibility(prev => ({
                                              ...prev,
                                              [col.id]: !isVisible
                                          }))
                                      }}
                                    >
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isVisible ? 'bg-primary-500 border-primary-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]' : 'border-surface-700 bg-surface-950'}`}>
                                            {isVisible && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                                        </div>
                                        <span className="text-xs font-mono flex-1 truncate">{col.id}</span>
                                        {!isVisible && <EyeOff className="w-3 h-3" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Menu */}
            <div className="relative" ref={actionsRef}>
                <button 
                  className={`btn-primary !bg-surface-800 !border-surface-700 hover:!bg-surface-700 !px-4 !py-2 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 group transition-all ${isActionsOpen ? '!border-primary-500/50 bg-primary-500/5' : ''}`}
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                >
                    <TableProperties className="w-3.5 h-3.5 text-surface-500" />
                    <span>Table Actions</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isActionsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isActionsOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-surface-900 border border-surface-800 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden p-1">
                        <div className="px-3 py-2 text-[10px] font-bold text-surface-500 uppercase tracking-widest border-b border-surface-800 mb-1">Portability</div>
                        
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-800/80 text-surface-200 rounded-lg transition-colors text-xs font-medium group" onClick={handleExportCSV}>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform"><Download className="w-4 h-4" /></div>
                            <div className="flex flex-col text-left"><span className="text-[11px] font-bold">Export to CSV</span><span className="text-[9px] text-surface-500">Universal data format</span></div>
                        </button>

                        <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-800/80 text-surface-200 rounded-lg transition-colors text-xs font-medium group" onClick={handleExportJSON}>
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform"><Copy className="w-4 h-4" /></div>
                            <div className="flex flex-col text-left"><span className="text-[11px] font-bold">Export to JSON</span><span className="text-[9px] text-surface-500">For developers</span></div>
                        </button>

                        <div className="h-px bg-surface-800 my-1" />
                        <div className="px-3 py-2 text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-1">Administration</div>

                        <label className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-800/80 text-surface-200 rounded-lg transition-colors text-xs font-medium group cursor-pointer text-left">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform"><DownloadCloud className="w-4 h-4" /></div>
                            <div className="flex flex-col"><span className="text-[11px] font-bold">Import CSV</span><span className="text-[9px] text-surface-500">Append new records</span></div>
                            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>

                        <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors text-xs font-medium group mt-1 text-left" onClick={() => { if (confirm('Erase all table content?')) api.truncateTable(sessionId, tableName, schemaName).then(() => refetch()) }}>
                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></div>
                            <div className="flex flex-col"><span className="text-[11px] font-bold">Truncate Table</span><span className="text-[9px] text-red-500/60">Wipe all rows</span></div>
                        </button>
                    </div>
                )}
            </div>

            <button className="btn-primary !bg-surface-800 !border-surface-700 hover:!bg-surface-700 !px-4 !py-2 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 group transition-all" onClick={() => onEditTable?.(tableName)}><Settings className="w-3.5 h-3.5 text-surface-500 group-hover:rotate-90 transition-transform duration-500" /><span>Edit Table</span></button>
            <div className="h-6 w-px bg-surface-800 mx-1" />
            <button className={`btn-ghost !px-3 !py-1 text-[9px] font-bold uppercase tracking-widest border border-surface-800 rounded-lg transition-all ${caseSensitive ? 'text-primary-400 bg-primary-500/10 border-primary-500/30' : 'text-surface-600'}`} onClick={() => setCaseSensitive(!caseSensitive)}>Aa</button>
            {(Object.values(filterDraft).some(v => v !== '') || hasFilters) && <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 !px-4 !py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg" onClick={handleApplyFilters}><Filter className="w-3.5 h-3.5" /> Apply</button>}
            {hasFilters && <button className="btn-ghost !px-3 !py-1.5 text-[10px] text-red-500 font-bold uppercase tracking-widest" onClick={() => { setFilterDraft({}); setFilters({}) }}>Reset</button>}
            <button className="btn-ghost !p-2 rounded-lg" onClick={() => refetch()}><RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /></button>
            <div className="h-6 w-px bg-surface-800 mx-1" /><button className="btn-primary !px-4 !py-2 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]" onClick={() => { setIsInserting(true); setNewRowData({}) }}><Plus className="w-3.5 h-3.5" /> New Row</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 shadow-2xl">
                {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id} className="bg-surface-900 font-sans">
                        {hg.headers.map(h => (
                            <th 
                                key={h.id} 
                                className="px-4 py-3 bg-surface-900 border-b border-r border-surface-800 text-left"
                                onContextMenu={(e) => {
                                    if (h.column.id !== '_select' && h.column.id !== '_actions') {
                                        handleHeaderContextMenu(e, h.column.id)
                                    }
                                }}
                            >
                                {flexRender(h.column.columnDef.header, h.getContext())}
                            </th>
                        ))}
                    </tr>
                ))}
                <tr className="bg-surface-950 border-b border-surface-800 shadow-md">{table.getVisibleFlatColumns().map(col => (<td key={col.id} className="px-3 py-2 border-b border-r border-surface-800/80">{col.id !== '_select' && col.id !== '_actions' && (<div className="relative group"><input className="w-full bg-surface-900 border border-surface-800 rounded-md px-2 py-1.5 text-[10px] text-surface-200 focus:border-primary-500 focus:bg-surface-950 transition-all font-mono placeholder:text-surface-700" placeholder="Filter..." value={filterDraft[col.id] || ''} onChange={(e) => setFilterDraft(prev => ({ ...prev, [col.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleApplyFilters()} /><Search className="absolute right-2 top-2 w-3 h-3 text-surface-700 group-focus-within:text-primary-500" /></div>)}</td>))}</tr>
            </thead>
            <tbody className="divide-y divide-surface-800/30">
                {isInserting && (
                    <tr className="bg-emerald-500/5 animate-slide-down border-b-2 border-emerald-500/40">
                        {table.getVisibleFlatColumns().map((c, cIdx) => (
                            <td key={c.id} className="px-4 py-3 border-r border-surface-800/20">
                                {c.id === '_select' ? <Plus className="w-4 h-4 text-emerald-400 mx-auto" /> : 
                                 c.id === '_actions' ? (
                                    <div className="flex items-center gap-1">
                                        <button className="btn-icon !p-1 text-emerald-400" onClick={() => insertMutation.mutate(newRowData)}><Save className="w-4 h-4" /></button>
                                        <button className="btn-icon !p-1 text-red-400" onClick={() => setIsInserting(false)}><X className="w-4 h-4" /></button>
                                    </div>
                                 ) : renderCellInput(c.id, newRowData[c.id], (nv) => setNewRowData(p => ({ ...p, [c.id]: nv })), (e) => e.key === 'Enter' && insertMutation.mutate(newRowData), cIdx === 1)}
                            </td>
                        ))}
                    </tr>
                )}
                {rows.map((r, i) => {
                    const isSelected = pkColumn && selectedRows.has(r[pkColumn])
                    return (
                        <tr 
                            key={i} 
                            className={`group hover:bg-surface-900/40 transition-colors ${isSelected ? 'bg-primary-500/10' : ''}`}
                            onContextMenu={(e) => handleRowContextMenu(e, r, i)}
                        >
                            {table.getVisibleFlatColumns().map(c => (
                                <td key={c.id} className={`px-4 py-2.5 text-xs font-mono border-r border-surface-800/10 transition-colors ${isSelected ? 'text-primary-300' : 'text-surface-400'}`}>
                                    {flexRender(c.columnDef.cell, { row: { original: r, index: i }, getValue: () => r[c.id], column: c, table })}
                                </td>
                            ))}
                        </tr>
                    )
                })}
            </tbody>
        </table>
        <div className="p-12 flex flex-col items-center justify-center bg-gradient-to-t from-surface-900/40 to-transparent">
            {hasNextPage ? (<button className="btn-ghost !px-12 !py-3 !text-xs font-bold uppercase border border-surface-800 bg-surface-900 shadow-2xl rounded-3xl flex items-center gap-4 hover:border-primary-500" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? <Loader2 className="w-5 h-5 animate-spin text-primary-400" /> : <ChevronDown className="w-5 h-5 text-primary-400" />}<span>Load More Data</span></button>) : rows.length > 0 && <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20">Full Stream Synced</span>}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
})
