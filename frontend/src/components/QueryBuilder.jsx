import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react'
import QueryNode from './QueryNode'
import JoinEdge from './JoinEdge'
import { 
  Play, TerminalSquare, Copy, Trash2, Database, 
  AlertCircle, Table2, Filter, Settings, Columns, 
  ChevronUp, ChevronDown, CheckCircle2, XCircle, Loader2,
  ChevronLeft, ChevronRight, Search, Plus, Bookmark, Check, X
} from 'lucide-react'
import { saveSnippet } from '../lib/snippets'

const nodeTypes = { queryNode: QueryNode }
const edgeTypes = { joinEdge: JoinEdge }

// Main Query Builder Component - Handles Visual SQL Generation
const QueryBuilderInner = memo(({ schema, onExecuteQuery, isExecuting, result, error, loadedSnippet, dbType }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [filters, setFilters] = useState([]) // { id, tableInstanceId, column, operator, value }
  const [limit, setLimit] = useState(100)
  const [isSaving, setIsSaving] = useState(false)
  const [snippetName, setSnippetName] = useState('')
  const [bottomHeight, setBottomHeight] = useState(300)
  const [activeBottomTab, setActiveBottomTab] = useState('sql')
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isTablesOpen, setIsTablesOpen] = useState(true)
  const [isFiltersOpen, setIsFiltersOpen] = useState(true)
  const [tableSearch, setTableSearch] = useState('')
  const isResizingRef = useRef(false)

  // Resizable Logic
  const startResizing = useCallback((e) => {
    isResizingRef.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'row-resize'
  }, [])

  const stopResizing = useCallback(() => {
    isResizingRef.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'default'
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isResizingRef.current) return
    const newHeight = window.innerHeight - e.clientY
    setBottomHeight(Math.max(150, Math.min(newHeight, window.innerHeight - 200)))
  }, [])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const tableDataStr = event.dataTransfer.getData('application/reactflow')
      if (!tableDataStr) return

      const tableData = JSON.parse(tableDataStr)
      const position = { x: event.clientX - 400, y: event.clientY - 200 }

      const newNode = {
        id: `${tableData.name}_${Date.now()}`,
        type: 'queryNode',
        position,
        data: { 
          table: tableData,
          tableName: tableData.name,
          alias: tableData.name.toLowerCase().slice(0, 3) + (nodes.length + 1),
          selectedColumns: [],
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes]
  )
  
  const addTableAtCenter = useCallback((table) => {
    const newNode = {
      id: `${table.name}_${Date.now()}`,
      type: 'queryNode',
      position: { x: 100 + nodes.length * 40, y: 100 + nodes.length * 40 },
      data: { 
        table,
        tableName: table.name,
        alias: table.name.toLowerCase().slice(0, 3) + (nodes.length + 1),
        selectedColumns: [],
      },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [nodes.length, setNodes])

  const removeTableInstances = useCallback((tableName) => {
    setNodes(nds => nds.filter(n => n.data.tableName !== tableName))
    setFilters(flts => flts.filter(f => {
        const node = nodes.find(n => n.id === f.instanceId)
        return node?.data.tableName !== tableName
    }))
  }, [nodes, setNodes, setFilters])

  const toggleColumn = useCallback((instanceId, colName) => {
    setNodes((nds) => nds.map(node => {
        if (node.id === instanceId) {
            const current = node.data.selectedColumns || []
            const next = current.includes(colName) 
                ? current.filter(c => c !== colName) 
                : [...current, colName]
            return { ...node, data: { ...node.data, selectedColumns: next }}
        }
        return node
    }))
  }, [setNodes])

  const updateAlias = useCallback((instanceId, newAlias) => {
    setNodes((nds) => nds.map(node => 
      node.id === instanceId 
        ? { ...node, data: { ...node.data, alias: newAlias.replace(/[^a-zA-Z0-9_]/g, '') }} 
        : node
    ))
  }, [setNodes])

  const handleJoinTypeChange = useCallback((edgeId, newType) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, joinType: newType } } : e))
  }, [setEdges])

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ 
        ...params, 
        type: 'joinEdge',
        data: { joinType: 'INNER', onTypeChange: handleJoinTypeChange },
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 3 }
    }, eds)),
    [setEdges, handleJoinTypeChange]
  )

  // Load snippet
  useEffect(() => {
    if (loadedSnippet) {
        try {
            const { nodes: savedNodes, edges: savedEdges, filters: savedFilters } = JSON.parse(loadedSnippet.content)
            setNodes(savedNodes || [])
            setEdges(savedEdges || [])
            setFilters(savedFilters || [])
            // fitView will eventually happen via reactflow fitview prop if we toggle it
        } catch (e) {
            console.error("Failed to load visual snippet", e)
        }
    }
  }, [loadedSnippet, setNodes, setEdges, setFilters])

  const handleSaveSnippet = async () => {
    if (!snippetName.trim() || nodes.length === 0) return
    const content = JSON.stringify({ nodes, edges, filters })
    await saveSnippet(snippetName, 'visual', content, schema?.database || '')
    setSnippetName('')
    setIsSaving(false)
  }

  // Filter Management
  const addFilter = () => {
    if (nodes.length === 0) return
    const firstNode = nodes[0]
    setFilters([...filters, { 
      id: Date.now(), 
      instanceId: firstNode.id, 
      column: firstNode.data.table.columns[0].name, 
      operator: '=', 
      value: '' 
    }])
  }

  const removeFilter = (id) => setFilters(filters.filter(f => f.id !== id))
  const updateFilter = (id, field, value) => setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f))

  // SQL Generator
  const generatedSQL = useMemo(() => {
    if (nodes.length === 0) return '-- Arrastra tablas para comenzar...'

    const activeNodes = nodes.filter(n => (n.data.selectedColumns || []).length > 0 || edges.some(e => e.source === n.id || e.target === n.id))
    if (activeNodes.length === 0) return '-- Selecciona al menos una columna para generar el SQL'

    const processedNodes = new Set()
    const fromEntries = []

    // 1. Traverse and build Joins
    activeNodes.forEach(root => {
      if (processedNodes.has(root.id)) return

      const componentNodes = new Set([root.id])
      const componentJoins = []
      processedNodes.add(root.id)

      let foundNew = true
      while (foundNew) {
        foundNew = false
        edges.forEach(edge => {
          let sourceId, targetId, sourceCol, targetCol, joinNode, jType = edge.data?.joinType || 'INNER'
          const isForward = componentNodes.has(edge.source) && !componentNodes.has(edge.target)
          const isBackward = componentNodes.has(edge.target) && !componentNodes.has(edge.source)
          
          if (isForward) {
            sourceId = edge.source; targetId = edge.target
            sourceCol = (edge.sourceHandle || '').split('-')[0]
            targetCol = (edge.targetHandle || '').split('-')[0]
            joinNode = nodes.find(n => n.id === targetId)
          } else if (isBackward) {
            sourceId = edge.target; targetId = edge.source
            sourceCol = (edge.targetHandle || '').split('-')[0]
            targetCol = (edge.sourceHandle || '').split('-')[0]
            joinNode = nodes.find(n => n.id === targetId)
            
            // Flip join type if we're traversing backwards
            if (jType === 'LEFT') jType = 'RIGHT'
            else if (jType === 'RIGHT') jType = 'LEFT'
          }

          if (joinNode && !componentNodes.has(joinNode.id)) {
            const sourceNode = nodes.find(n => n.id === sourceId)
            const sAlias = sourceNode?.data.alias || sourceId
            const tAlias = joinNode.data.alias || joinNode.id
            
            // Type-Safe Join: Handle Postgres strictness by casting to text if types probably mismatch
            const sColDef = sourceNode?.data.table.columns.find(c => c.name === sourceCol)
            const tColDef = joinNode.data.table.columns.find(c => c.name === targetCol)
            const sType = sColDef?.data_type?.toLowerCase() || ''
            const tType = tColDef?.data_type?.toLowerCase() || ''
            
            let sRef = `${sAlias}."${sourceCol}"`
            let tRef = `${tAlias}."${targetCol}"`
            
            // If types are different or one is numeric and other string, cast both to text for compatibility
            const sIsNum = ['int', 'serial', 'numeric', 'float', 'real', 'decimal'].some(t => sType.includes(t))
            const tIsNum = ['int', 'serial', 'numeric', 'float', 'real', 'decimal'].some(t => tType.includes(t))
            
            if (sType !== tType && (sIsNum || tIsNum)) {
                sRef = `CAST(${sRef} AS TEXT)`
                tRef = `CAST(${tRef} AS TEXT)`
            }

            const joinTable = `"${joinNode.data.table.schema_name}"."${joinNode.data.table.name}"`
            const joinKeyword = jType === 'INNER' ? 'JOIN' : `${jType} JOIN`
            componentJoins.push(`${joinKeyword} ${joinTable} AS ${tAlias} ON ${sRef} = ${tRef}`)
            componentNodes.add(joinNode.id)
            processedNodes.add(joinNode.id)
            foundNew = true
          }
        })
      }
      
      const rAlias = root.data.alias || root.id
      const tableRef = `"${root.data.table.schema_name}"."${root.data.table.name}" AS ${rAlias}`
      fromEntries.push({ base: tableRef, joins: componentJoins })
    })

    // 2. Projected Columns (Ordered by traversal)
    const selectParts = []
    const orderedNodes = Array.from(processedNodes)
    
    // Fallback for nodes that were never processed into a join component
    nodes.forEach(n => {
      if (!processedNodes.has(n.id)) orderedNodes.push(n.id)
    })

    orderedNodes.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId)
      if (!node) return
      const cols = node.data.selectedColumns || []
      const alias = node.data.alias || node.id
      cols.forEach(c => {
        // Alias column for clarity in preview: TableAlias.Column
        selectParts.push(`${alias}."${c}" AS "${alias}.${c}"`)
      })
    })

    const selectClause = selectParts.length > 0 ? selectParts.join(',\n       ') : '*'

    // 3. WHERE clause
    let whereClause = ''
    if (filters.length > 0) {
      const conditionParts = filters.map(f => {
        if (!f.value && f.operator !== 'IS NULL' && f.operator !== 'IS NOT NULL') return null
        
        const node = nodes.find(n => n.id === f.instanceId)
        if (!node) return null
        const colDef = node.data.table.columns.find(c => c.name === f.column)
        const isNumeric = ['integer', 'numeric', 'bigint', 'int', 'decimal', 'float', 'real', 'serial'].includes(colDef?.data_type?.toLowerCase())
        
        let val = f.value
        if (!isNumeric) {
            val = `'${String(f.value).replace(/'/g, "''")}'`
        }
        
        if (f.operator === 'LIKE' || f.operator === 'ILIKE') {
            if (!f.value.includes('%')) val = `'%${f.value}%'`
        }

        const alias = node.data.alias || f.instanceId
        return `${alias}."${f.column}" ${f.operator} ${val}`
      }).filter(Boolean)

      if (conditionParts.length > 0) {
        whereClause = '\nWHERE ' + conditionParts.join(' AND ')
      }
    }

    let sql = `SELECT ${selectClause}\nFROM `
    sql += fromEntries.map(e => e.base + (e.joins.length > 0 ? '\n' + e.joins.join('\n') : '')).join(',\n')
    
    // Add Query Limit
    const limitSql = dbType === 'mssql' || dbType === 'sqlserver'
        ? `\nORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`
        : `\nLIMIT ${limit}`

    return sql + whereClause + limitSql + ';'
  }, [nodes, edges, filters, limit, dbType])

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSQL).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }

  const handleExecute = () => {
    onExecuteQuery?.(generatedSQL)
    setActiveBottomTab('preview')
  }

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden relative">
      {/* Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
         {/* Sidebar with tables */}
         <div 
          className={`
            border-r border-surface-800/60 bg-surface-900/40 flex flex-col z-20 transition-all duration-300 relative overflow-hidden
            ${isSidebarVisible ? 'w-64 translate-x-0' : 'w-0 -translate-x-full border-none'}
          `}
         >
            <button 
              onClick={() => setIsSidebarVisible(false)}
              className="absolute -right-3 top-4 w-6 h-6 bg-surface-800 border border-surface-700 rounded-full flex items-center justify-center text-surface-400 hover:text-white z-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className={`flex flex-col h-full overflow-hidden ${isSidebarVisible ? 'opacity-100 transition-opacity delay-150' : 'opacity-0'}`}>
              {/* Tables Section */}
              <div className={`flex flex-col border-b border-surface-800/40 p-4 transition-all min-h-0 ${isTablesOpen ? 'flex-1' : 'flex-none'}`}>
                <button 
                  onClick={() => setIsTablesOpen(!isTablesOpen)}
                  className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center justify-between group mb-2 shrink-0"
                >
                  <span className="flex items-center gap-2"><Database className="w-3 h-3" /> Source Tables</span>
                  {isTablesOpen ? <ChevronDown className="w-3 h-3 text-surface-600" /> : <ChevronRight className="w-3 h-3 text-surface-600" />}
                </button>
                
                {isTablesOpen && (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="relative mb-3 shrink-0">
                      <input 
                        className="w-full bg-surface-950/50 border border-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-surface-200 focus:border-indigo-500/50 outline-none transition-all"
                        placeholder="Search tables..."
                        value={tableSearch}
                        onChange={e => setTableSearch(e.target.value)}
                      />
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-surface-600" />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {schema?.tables
                        .filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()))
                        .map(table => {
                          const instanceCount = nodes.filter(n => n.data.tableName === table.name).length
                          return (
                            <div
                                key={table.name}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('application/reactflow', JSON.stringify(table))}
                                className={`px-3 py-2 mb-2 bg-surface-800/20 border rounded-lg text-xs transition-all flex items-center gap-2 group cursor-pointer ${instanceCount > 0 ? 'border-indigo-500/40 bg-indigo-500/5 text-white' : 'border-surface-700/30 text-surface-400 hover:bg-surface-800/40 hover:text-surface-200'}`}
                                onClick={() => addTableAtCenter(table)}
                            >
                                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                    <Table2 className={`w-3.5 h-3.5 ${instanceCount > 0 ? 'text-indigo-400' : 'text-surface-500'}`} />
                                    <span className="truncate flex-1 font-medium">{table.name}</span>
                                    {instanceCount > 0 && <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-1 rounded animate-fade-in">{instanceCount}</span>}
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {instanceCount > 0 && (
                                        <button 
                                            className="p-1 hover:text-red-400 text-surface-600"
                                            onClick={(e) => { e.stopPropagation(); removeTableInstances(table.name) }}
                                            title="Remove all instances"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Visual Filters Area */}
              <div className={`flex flex-col p-4 transition-all min-h-0 ${isFiltersOpen ? 'flex-1' : 'flex-none'}`}>
                <div className="flex items-center justify-between group mb-2 shrink-0">
                  <button 
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2"
                  >
                    <Filter className="w-3 h-3" /> Query Filters
                    {isFiltersOpen ? <ChevronDown className="w-3 h-3 text-surface-600" /> : <ChevronRight className="w-3 h-3 text-surface-600" />}
                  </button>
                  
                  {isFiltersOpen && filters.length > 0 && (
                    <button 
                      onClick={() => setFilters([])}
                      className="p-1 hover:text-red-400 text-surface-600 transition-colors"
                      title="Clear all filters"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isFiltersOpen && (
                  <>
                    <button 
                      onClick={addFilter}
                      className="btn-ghost !justify-start !text-[10px] !py-1 flex shrink-0 mb-3 border border-dashed border-surface-700/60 hover:border-emerald-500/40"
                    >
                      + Add Condition
                    </button>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                      {filters.map(f => {
                        const node = nodes.find(n => n.id === f.instanceId)
                        return (
                          <div key={f.id} className="p-2.5 bg-surface-900/60 border border-surface-800/60 rounded-lg flex flex-col gap-2 relative group/filter">
                              <div className="flex items-center justify-between">
                                <select 
                                  className="bg-transparent text-[11px] text-surface-300 outline-none font-medium truncate max-w-[140px]"
                                  value={f.instanceId}
                                  onChange={(e) => updateFilter(f.id, 'instanceId', e.target.value)}
                                >
                                  {nodes.map(n => <option key={n.id} value={n.id} className="bg-surface-900">{n.data.tableName}</option>)}
                                </select>
                                <button 
                                  onClick={() => removeFilter(f.id)} 
                                  className="text-surface-600 hover:text-red-400 p-0.5 transition-colors"
                                  title="Remove filter"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <select 
                                  className="flex-1 bg-surface-800/50 rounded px-1.5 py-0.5 text-[10px] text-white outline-none"
                                  value={f.column}
                                  onChange={(e) => updateFilter(f.id, 'column', e.target.value)}
                                >
                                  {node?.data.table.columns.map(c => <option key={c.name} value={c.name} className="bg-surface-900">{c.name}</option>)}
                                </select>
                                <select 
                                  className="bg-surface-800/50 rounded px-1.5 py-0.5 text-[10px] text-emerald-400 font-bold outline-none"
                                  value={f.operator}
                                  onChange={(e) => updateFilter(f.id, 'operator', e.target.value)}
                                >
                                  <option value="=">=</option>
                                  <option value="!=">!=</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value="LIKE">LIKE</option>
                                </select>
                              </div>
                            <input 
                              type="text"
                              placeholder="Value..."
                              className="w-full bg-surface-800/50 rounded px-2 py-1 text-[10px] text-surface-200 outline-none border border-transparent focus:border-emerald-500/30"
                              value={f.value}
                              onChange={(e) => updateFilter(f.id, 'value', e.target.value)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
         </div>

         {!isSidebarVisible && (
           <button 
            onClick={() => setIsSidebarVisible(true)}
            className="absolute left-4 top-4 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-indigo-500 z-30 transition-all active:scale-95"
           >
             <ChevronRight className="w-6 h-6" />
           </button>
         )}

         {/* Canvas */}
         <div className="flex-1 h-full relative" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
                nodes={nodes.map(n => ({ 
                    ...n, 
                    data: { 
                        ...n.data, 
                        onToggleColumn: (tableName, colName) => toggleColumn(n.id, colName),
                        onAliasChange: (newAlias) => updateAlias(n.id, newAlias),
                        onRemove: () => {
                            setNodes(nds => nds.filter(node => node.id !== n.id))
                            setFilters(flts => flts.filter(flt => flt.instanceId !== n.id))
                        }
                    }
                }))}
                edges={edges.map(e => ({
                  ...e,
                  data: { ...e.data, onTypeChange: handleJoinTypeChange }
                }))}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#1e1b4b" gap={24} size={1} />
                <Controls className="!bg-surface-900 !border-surface-800 !fill-white" />
                <MiniMap className="!bg-surface-900 !border-surface-800" />
            </ReactFlow>

            {/* Quick Actions floating bar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
               {isSaving ? (
                  <div className="flex items-center gap-1 bg-surface-900 border border-indigo-500/50 rounded-full px-2 py-1 shadow-2xl animate-fade-in">
                    <input 
                      className="bg-transparent border-none outline-none text-xs text-white px-2 py-1 w-32 placeholder:text-surface-600"
                      placeholder="Snippet name..."
                      autoFocus
                      value={snippetName}
                      onChange={e => setSnippetName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveSnippet()}
                    />
                    <button className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-full" onClick={handleSaveSnippet}><Check className="w-4 h-4" /></button>
                    <button className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-full" onClick={() => setIsSaving(false)}><X className="w-4 h-4" /></button>
                  </div>
               ) : (
                  <button 
                    onClick={() => setIsSaving(true)}
                    disabled={nodes.length === 0}
                    className="p-2.5 bg-surface-900 border border-surface-700 text-surface-400 hover:text-amber-400 hover:border-amber-400/50 rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50"
                    title="Save current canvas"
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>
               )}

               <button 
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full text-sm font-bold shadow-xl flex items-center gap-2 transition-all active:scale-95"
               >
                  {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Run Studio Preview
               </button>

               {/* Limit Selector */}
               <div className="flex items-center gap-2 bg-surface-900 border border-surface-700/60 rounded-full px-3 py-1.5 shadow-xl ml-1">
                  <Settings className="w-3.5 h-3.5 text-surface-500" />
                  <select 
                   className="bg-transparent border-none outline-none text-[10px] font-bold text-surface-400 capitalize cursor-pointer focus:text-indigo-400 transition-colors"
                   value={limit}
                   onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    {[10, 50, 100, 500, 1000, 5000].map(val => (
                      <option key={val} value={val} className="bg-surface-900 border-none">Limit: {val}</option>
                    ))}
                  </select>
               </div>
            </div>
         </div>
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="h-1 cursor-row-resize bg-surface-800/80 hover:bg-indigo-500/50 transition-colors z-30" 
      />

      {/* Bottom Resizable Panel */}
      <div 
        style={{ height: bottomHeight }} 
        className="bg-surface-900/90 border-t border-surface-800/60 flex flex-col backdrop-blur-md overflow-hidden"
      >
         {/* Tabs & Meta */}
         <div className="flex items-center justify-between px-4 py-2 bg-surface-950/40 border-b border-surface-800/40">
            <div className="flex gap-4">
               <button 
                  onClick={() => setActiveBottomTab('sql')}
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 transition-all ${activeBottomTab === 'sql' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-surface-500'}`}
                >
                  SQL Output
               </button>
               <button 
                  onClick={() => setActiveBottomTab('preview')}
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 transition-all ${activeBottomTab === 'preview' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-surface-500'}`}
                >
                  Table Preview {result?.row_count !== undefined && `(${result.row_count})`}
               </button>
            </div>
            
            <div className="flex gap-2">
               <button onClick={handleCopy} className="btn-ghost !p-2 text-surface-400 hover:text-white" title="Copy SQL">
                  {copyFeedback ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
               </button>
               <button 
                 className="btn-ghost !p-2 text-red-500/70 hover:text-red-400" 
                 onClick={() => { setNodes([]); setEdges([]); setFilters([]) }}
                 title="Reset Canvas"
               >
                  <Trash2 className="w-4 h-4" />
               </button>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-auto custom-scrollbar p-0">
            {activeBottomTab === 'sql' ? (
              <div className="p-4 bg-surface-950/40 h-full">
                <pre className="font-mono text-xs text-indigo-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
                    {generatedSQL}
                </pre>
              </div>
            ) : (
              <div className="h-full">
                {isExecuting ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-500">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-xs uppercase tracking-widest font-bold">Fetching Preview...</span>
                  </div>
                ) : error ? (
                   <div className="p-8 flex flex-col items-center justify-center gap-2 text-red-400">
                      <XCircle className="w-8 h-8" />
                      <span className="font-bold text-sm">Execution Error</span>
                      <pre className="text-[10px] mt-2 bg-red-500/10 p-4 rounded border border-red-500/20 max-w-2xl whitespace-pre-wrap">
                        {error.message || JSON.stringify(error)}
                      </pre>
                   </div>
                ) : result && result.columns ? (
                  <div className="overflow-x-auto h-full scrollbar-thin">
                    <table className="min-w-full text-[11px] font-mono border-collapse">
                      <thead className="sticky top-0 bg-surface-900 z-10">
                        <tr>
                          {result.columns.map(col => (
                            <th key={col} className="px-4 py-2.5 text-left border-b border-surface-800 text-indigo-300 uppercase tracking-tighter whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-800/30">
                        {result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-indigo-500/5 transition-colors">
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2 text-surface-300 whitespace-nowrap border-r border-surface-800/20 last:border-r-0">
                                {cell === null ? <span className="text-surface-600 italic">NULL</span> : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-surface-600 text-xs italic">
                    Click "Run Studio Preview" to see data results here.
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
})

export default memo(function QueryBuilder(props) {
    return (
        <ReactFlowProvider>
            <QueryBuilderInner {...props} />
        </ReactFlowProvider>
    )
})
