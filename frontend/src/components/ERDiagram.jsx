import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import TableNode from './TableNode'
import ContextMenu from './ContextMenu'
import CardinalityEdge from './CardinalityEdge'
import { Plus, Maximize, Layout as LayoutIcon, RefreshCcw, PenLine, Trash2, GitBranch, Eye, EyeOff, Bookmark, XCircle, Database, Loader2, Save } from 'lucide-react'
import '@xyflow/react/dist/style.css'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { cardinality: CardinalityEdge }

// ---------------------------------------------------------------------------
// Layout with dagre
// ---------------------------------------------------------------------------
function layoutElements(nodes, edges, direction = 'LR') {
  // 1. Identify connected vs floating nodes
  const connectedNodeIds = new Set()
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })

  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id))
  const floatingNodes = nodes.filter((n) => !connectedNodeIds.has(n.id))

  // 2. Layout floating nodes in a grid at the top
  const COLUMNS = 8
  const X_GAP = 280
  const Y_GAP = 350 // Sufficient for most tables
  
  const positionedFloating = floatingNodes.map((node, index) => {
    const row = Math.floor(index / COLUMNS)
    const col = index % COLUMNS
    return {
      ...node,
      position: { x: col * X_GAP, y: row * Y_GAP }
    }
  })

  const floatingBottom = floatingNodes.length > 0 
    ? (Math.floor((floatingNodes.length - 1) / COLUMNS) + 1) * Y_GAP 
    : 0

  // 3. Layout connected nodes with Dagre
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 200, ranksep: 320, marginx: 80, marginy: 80 })

  connectedNodes.forEach((node) => {
    const h = node.data.table.columns.length * 36 + 60
    g.setNode(node.id, { width: 180, height: h })
  })
  edges.forEach((edge) => g.setEdge(edge.source, edge.target))

  dagre.layout(g)

  const positionedConnected = connectedNodes.map((node) => {
    const pos = g.node(node.id)
    return { 
      ...node, 
      position: { 
        x: pos.x - 120, 
        y: pos.y - pos.height / 2 + floatingBottom + (floatingNodes.length > 0 ? 100 : 0) // Shift down
      } 
    }
  })

  return { nodes: [...positionedFloating, ...positionedConnected], edges }
}

// ---------------------------------------------------------------------------
// Schema → React Flow conversion
// ---------------------------------------------------------------------------
function schemaToFlow(schema, callbacks, direction = 'LR', metadata = []) {
  if (!schema) return { nodes: [], edges: [] }

  const nodes = schema.tables.map((t) => ({
    id: t.name,
    type: 'tableNode',
    position: { x: 0, y: 0 },
    data: {
      table: t,
      isIndex: metadata.find(m => m.table_name === t.name)?.is_index || false,
      ...callbacks
    },
  }))

  const edges = schema.foreign_keys.map((fk) => ({
    id: fk.constraint_name,
    source: fk.source_table,
    target: fk.target_table,
    sourceHandle: `${fk.source_column}-source`,
    targetHandle: `${fk.target_column}-target`,
    type: 'cardinality',
    data: { sourceLabel: 'n', targetLabel: '1' },
    animated: false,
    style: { stroke: '#4f46e5', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#4f46e5',
      width: 20,
      height: 20,
    },
  }))

  if (callbacks?.shouldLayout) {
    return layoutElements(nodes, edges, direction)
  }
  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Inner Component (where hooks live)
// ---------------------------------------------------------------------------
const ERDiagramInner = memo(({ 
    schema, 
    onTableSelect, 
    onCreateTable, 
    onAddColumn, 
    onDropColumn,
    onModifyColumn,
    onRenameTable,
    apiHandlers,
    metadata = [],
    onSaveMetadata
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [hiddenTables, setHiddenTables] = useState(new Set())
  const { setCenter, fitView } = useReactFlow()
  const [dbPositions, setDbPositions] = useState({})
  const [hasInitialPositionLoaded, setHasInitialPositionLoaded] = useState(false)
  const [layoutDirection, setLayoutDirection] = useState('LR') // 'LR' or 'TB'
  const initialFitRef = useRef(null) // Stores database name for which fit was done

  // Fetch saved positions from backend on mount or context change
  useEffect(() => {
    if (apiHandlers?.fetchNodePositions && schema?.database) {
        apiHandlers.fetchNodePositions({
            db_type: apiHandlers.connectionInfo?.db_type || '',
            host: apiHandlers.connectionInfo?.host || '',
            db_name: schema.database
        }).then(res => {
            const posMap = {}
            res.forEach(p => {
                posMap[p.table_name] = { x: parseFloat(p.x), y: parseFloat(p.y) }
            })
            setDbPositions(posMap)
            setHasInitialPositionLoaded(true)
        }).catch(err => {
            console.error('Failed to fetch positions:', err)
            setHasInitialPositionLoaded(true) // Proceed anyway
        })
    } else {
        setHasInitialPositionLoaded(true)
    }
  }, [schema?.database, apiHandlers])

  // We need a stable ref for recordAction so callbacks in useMemo can call it
  const recordActionRef = useRef(null)

  const callbacks = useMemo(() => ({
    onAddColumn: (t) => onAddColumn?.(t),
    onDropTable: (t) => recordActionRef.current?.('DROP_TABLE', { table: t }),
    onDropColumn: (c, t) => recordActionRef.current?.('DROP_COLUMN', { column: c, table: t }),
    onModifyColumn: (c, t, ci) => onModifyColumn?.(c, t, ci),
    onRenameTable: (t) => onRenameTable?.(t),
    onSaveMetadata: (n, val) => onSaveMetadata?.({ tableName: n, isIndex: val })
  }), [onAddColumn, onRenameTable, onModifyColumn, onSaveMetadata])

  const { nodes: allNodes, edges: allEdges } = useMemo(() => {
    const shouldLayout = initialFitRef.current !== schema?.database
    return schemaToFlow(schema, { ...callbacks, shouldLayout }, layoutDirection, metadata)
  }, [schema, callbacks, layoutDirection, metadata])

  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(allEdges)
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set())
  
  // --- Refs to always have current state (avoids stale closures) ---
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  const handleLayoutToggle = useCallback((dir) => {
    setLayoutDirection(dir)
    // Force immediate recalculation using current graph state
    const { nodes: ln, edges: le } = layoutElements(nodes, edges, dir)
    setNodes(ln)
    setEdges(le)
    // Slight delay to allow React Flow to process the new positions before fitting
    setTimeout(() => {
        fitView({ duration: 800, padding: 0.2 })
    }, 50)
  }, [nodes, edges, setNodes, setEdges, fitView])

  // --- Actions ---
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Surgical Sync: Only update what's necessary, preserving positions & handling visibility
  useEffect(() => {
    if (!hasInitialPositionLoaded) return

    setNodes((prev) => {
        return allNodes.map((newNode) => {
            const existing = prev.find((p) => p.id === newNode.id)
            const saved = dbPositions[newNode.id]
            const isHidden = hiddenTables.has(newNode.id)

            let position = newNode.position // Default from Dagre/Grid
            if (existing) {
                position = existing.position // Keep current session position
            } else if (saved) {
                position = saved // use backend position if first time seeing this node
            }

            // Stability check: if data and visibility haven't changed, return existing node
            if (existing && 
                existing.hidden === isHidden &&
                JSON.stringify(existing.data.table) === JSON.stringify(newNode.data.table)) {
                return { ...existing, position }
            }

            return { ...newNode, position, hidden: isHidden }
        })
    })

    setEdges((prev) => {
        const nextEdges = allEdges.map(edge => {
            const isNodeHidden = hiddenTables.has(edge.source) || hiddenTables.has(edge.target)
            return { ...edge, hidden: isNodeHidden }
        })
        
        if (JSON.stringify(prev) === JSON.stringify(nextEdges)) return prev
        return nextEdges
    })
  }, [allNodes, allEdges, dbPositions, hasInitialPositionLoaded, hiddenTables])

  // The core action recorder (Now immediate)
  const recordAction = useCallback(async (type, payload) => {
    setSaveError(null)
    setIsSaving(true)

    try {
        if (type === 'DROP_TABLE') {
            const connectedEdges = edgesRef.current.filter(e => e.source === payload.table.name || e.target === payload.table.name)
            if (connectedEdges.length > 0) {
                setSaveError(`Cannot delete "${payload.table.name}" — it has ${connectedEdges.length} active relationship(s).`)
                return
            }
            await apiHandlers?.dropTable?.({ 
               table: payload.table.name, 
               schemaName: payload.table.schema_name || 'public' 
            })
        } else if (type === 'CREATE_FK') {
            await apiHandlers?.createForeignKey?.(payload)
        } else if (type === 'DROP_FK') {
            const edge = edgesRef.current.find(e => e.id === payload.edgeId)
            if (edge) {
                const sourceNode = nodesRef.current.find(n => n.id === edge.source)
                const sName = sourceNode?.data?.table?.schema_name || 'public'
                await apiHandlers?.dropForeignKey?.({
                    table: edge.source,
                    schemaName: sName,
                    constraintName: edge.id
                })
            }
        } else if (type === 'DROP_COLUMN') {
            await apiHandlers?.dropColumn?.({
                table: payload.table.name,
                schemaName: payload.table.schema_name || 'public',
                columnName: payload.column
            })
        }
    } catch (err) {
        setSaveError(err.message || 'Operation failed')
    } finally {
        setIsSaving(false)
    }
  }, [apiHandlers])

  // Keep ref in sync
  useEffect(() => { recordActionRef.current = recordAction }, [recordAction])


  // Auto-fit Logic: ONLY on first load per database
  useEffect(() => {
    if (hasInitialPositionLoaded && nodes.length > 0 && initialFitRef.current !== schema?.database) {
        const timer = setTimeout(() => {
            fitView({ duration: 800, padding: 0.2 })
            initialFitRef.current = schema?.database
        }, 300)
        return () => clearTimeout(timer)
    }
  }, [hasInitialPositionLoaded, nodes.length, fitView, schema?.database])

  const onConnect = useCallback((params) => {
    const sourceCol = params.sourceHandle.replace('-source', '')
    const targetCol = params.targetHandle.replace('-target', '')
    const sourceTableInfo = schema?.tables?.find(t => t.name === params.source)
    const targetTableInfo = schema?.tables?.find(t => t.name === params.target)

    const source = { table: params.source, schema: sourceTableInfo?.schema_name, column: sourceCol }
    const target = { table: params.target, schema: targetTableInfo?.schema_name, column: targetCol }

    if (apiHandlers?.createRelationship) {
        apiHandlers.createRelationship(source, target)
    } else {
        recordAction('CREATE_FK', { source, target })
    }
  }, [schema, apiHandlers, recordAction])
  
  const onSelectionChange = useCallback(({ nodes }) => {
    setSelectedNodeIds(new Set(nodes.map(n => n.id)))
  }, [])

  const onSelectionContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'selection'
    })
  }, [])

  // Persist positions only when drag stops
  const persistPositions = useCallback((nodesToPersist) => {
    if (apiHandlers?.saveNodePositions) {
        const positions = nodesToPersist.map(n => ({
            table_name: n.id,
            x: String(n.position.x),
            y: String(n.position.y)
        }))

        apiHandlers.saveNodePositions({
            positions,
            db_type: apiHandlers.connectionInfo?.db_type || '',
            host: apiHandlers.connectionInfo?.host || '',
            db_name: schema.database
        }).catch(err => console.error('Failed to save positions:', err))
    }
  }, [apiHandlers, schema?.database])

  const onNodeDragStop = useCallback((_, node) => {
    persistPositions([node])
  }, [persistPositions])

  const onSelectionDragStop = useCallback((_, nodes) => {
    persistPositions(nodes)
  }, [persistPositions])

  const onNodeClick = useCallback((_, node) => {
    if (onTableSelect) onTableSelect(node.id)
  }, [onTableSelect])

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'pane'
    })
  }, [])

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'node',
        node
    })
  }, [])

  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'edge',
        edge
    })
  }, [])

  const flyToTable = useCallback((tableName) => {
    // Search in current nodes state to get the real, live position
    const node = nodes.find(n => n.id === tableName)
    if (!node) return
    
    if (hiddenTables.has(tableName)) {
        setHiddenTables(prev => {
            const next = new Set(prev)
            next.delete(tableName)
            return next
        })
    }

    setCenter(node.position.x + 120, node.position.y + 50, { zoom: 0.8, duration: 800 })
  }, [nodes, hiddenTables, setCenter])

  const toggleTableVisibility = (tableName) => {
    setHiddenTables(prev => {
        const next = new Set(prev)
        if (next.has(tableName)) next.delete(tableName)
        else next.add(tableName)
        return next
    })
  }

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []

    if (contextMenu.type === 'node') {
        const table = contextMenu.node.data.table
        const isSelected = selectedNodeIds.has(table.name)
        const selectionSize = selectedNodeIds.size

        const items = [
            { label: 'Add Column', icon: Plus, onClick: () => onAddColumn?.(table) },
            { label: 'Rename Table', icon: PenLine, onClick: () => onRenameTable?.(table) },
            { label: 'Hide Table', icon: EyeOff, onClick: () => toggleTableVisibility(table.name) },
            { 
                label: contextMenu.node.data.isIndex ? 'Unmark as Index' : 'Mark as Index', 
                icon: Bookmark, 
                onClick: () => onSaveMetadata?.({ tableName: table.name, isIndex: !contextMenu.node.data.isIndex }) 
            },
            { divider: true },
            { label: 'Manage Relations', icon: GitBranch, onClick: () => alert('Drag from a column handle to create relationships!') },
            { divider: true },
        ]

        if (isSelected && selectionSize > 1) {
            items.push({ 
                label: `Hide ${selectionSize} Selected`, 
                icon: Eye, 
                onClick: () => {
                    setHiddenTables(prev => {
                        const next = new Set(prev)
                        selectedNodeIds.forEach(id => next.add(id))
                        return next
                    })
                }
            })
            items.push({ 
                label: `Delete ${selectionSize} Selected`, 
                icon: Trash2, 
                danger: true, 
                onClick: async () => {
                    if (window.confirm(`Are you sure you want to delete ${selectionSize} tables and their dependencies?`)) {
                        for (const id of selectedNodeIds) {
                            const node = nodesRef.current.find(n => n.id === id)
                            if (node) await recordAction('DROP_TABLE', { table: node.data.table })
                        }
                    }
                }
            })
        } else {
            items.push({ label: 'Delete Table', icon: Trash2, danger: true, onClick: () => recordAction('DROP_TABLE', { table }) })
        }

        return items
    }

    if (contextMenu.type === 'selection') {
        const selectionSize = selectedNodeIds.size
        return [
            { 
                label: `Hide ${selectionSize} Selected`, 
                icon: Eye, 
                onClick: () => {
                    setHiddenTables(prev => {
                        const next = new Set(prev)
                        selectedNodeIds.forEach(id => next.add(id))
                        return next
                    })
                }
            },
            { 
                label: `Delete ${selectionSize} Selected`, 
                icon: Trash2, 
                danger: true, 
                onClick: async () => {
                    if (window.confirm(`Are you sure you want to delete ${selectionSize} tables and their dependencies?`)) {
                        for (const id of selectedNodeIds) {
                            const node = nodesRef.current.find(n => n.id === id)
                            if (node) await recordAction('DROP_TABLE', { table: node.data.table })
                        }
                    }
                }
            }
        ]
    }

    if (contextMenu.type === 'edge') {
        const edge = contextMenu.edge
        return [
            { label: 'Switch to 1:1', icon: GitBranch, onClick: () => recordAction('SET_CARDINALITY', { edgeId: edge.id, mode: '1:1' }) },
            { label: 'Switch to 1:N', icon: GitBranch, onClick: () => recordAction('SET_CARDINALITY', { edgeId: edge.id, mode: '1:N' }) },
            { divider: true },
            { label: 'Delete Relationship', icon: Trash2, danger: true, onClick: () => {
                const sourceNode = nodesRef.current.find(n => n.id === edge.source)
                const schemaName = sourceNode?.data?.table?.schema_name || 'public'
                if (apiHandlers?.onDropRelationship) {
                    apiHandlers.onDropRelationship({
                        table: edge.source,
                        schemaName,
                        constraintName: edge.id
                    })
                }
            }},
        ]
    }

    const paneActions = [
        { label: 'Add Table Here', icon: Plus, onClick: () => onCreateTable?.() },
        { label: 'Auto-Layout', icon: LayoutIcon, onClick: () => {
            const { nodes: ln, edges: le } = layoutElements(nodes, edges, layoutDirection)
            setNodes(ln)
            setEdges(le)
        }},
        { label: 'Reset Zoom', icon: Maximize, onClick: () => fitView({ duration: 800 }) },
        { divider: true },
        { label: 'Refresh Schema', icon: RefreshCcw, onClick: () => schemaToFlow(schema, callbacks) },
        { label: 'Manual Sync (Total)', icon: Database, onClick: () => window.location.reload() },
    ]

    if (selectedNodeIds.size > 0) {
        paneActions.unshift({ divider: true })
        paneActions.unshift({ 
            label: `Delete ${selectedNodeIds.size} Selected`, 
            icon: Trash2, 
            danger: true, 
            onClick: async () => {
                if (window.confirm(`Are you sure you want to delete ${selectedNodeIds.size} selected tables?`)) {
                    for (const id of selectedNodeIds) {
                        const node = nodesRef.current.find(n => n.id === id)
                        if (node) await recordAction('DROP_TABLE', { table: node.data.table })
                    }
                }
            }
        })
        paneActions.unshift({ 
            label: `Hide ${selectedNodeIds.size} Selected`, 
            icon: Eye, 
            onClick: () => {
                setHiddenTables(prev => {
                    const next = new Set(prev)
                    selectedNodeIds.forEach(id => next.add(id))
                    return next
                })
            }
        })
    }

    return paneActions
  }, [contextMenu, onAddColumn, onRenameTable, onCreateTable, nodes, edges, setNodes, setEdges, fitView, schema, callbacks, recordAction, apiHandlers, selectedNodeIds])

  if (nodes.length === 0 && (!schema || schema.tables?.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-surface-500 bg-surface-950">
        <div className="p-8 border-2 border-dashed border-surface-800 rounded-3xl flex flex-col items-center gap-4 max-w-sm text-center">
            <Database className="w-12 h-12 text-surface-700" />
            <p className="text-sm">No tables found in this database. Start by creating your first entity or exploring the schema.</p>
            <button className="btn-primary text-xs mt-2" onClick={() => onCreateTable?.()}>
                <Plus className="w-4 h-4" /> Create First Table
            </button>
        </div>
      </div>
    )
  }

  const filteredTables = schema.tables.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="w-full h-full flex overflow-hidden bg-surface-950" id="er-diagram">
      {/* Sidebar explorer */}
      <div className="w-64 border-r border-surface-800/80 bg-surface-950/50 flex flex-col z-10">
         <div className="p-4 border-b border-surface-800/80">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Explorer</h3>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setHiddenTables(new Set())}
                        title="Show all tables"
                        className="p-1.5 hover:bg-surface-800 rounded-md text-surface-400 hover:text-primary-400 transition-colors"
                    >
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => setHiddenTables(new Set(schema.tables.map(t => t.name)))}
                        title="Hide all tables"
                        className="p-1.5 hover:bg-surface-800 rounded-md text-surface-400 hover:text-red-400 transition-colors"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div className="relative">
                <input 
                    className="input !py-1.5 !px-3 !text-[11px] !bg-surface-900/50" 
                    placeholder="Filter tables..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
         </div>
         <div className="flex-1 overflow-auto p-2 custom-scrollbar space-y-1">
            {filteredTables.map(table => {
                const isHidden = hiddenTables.has(table.name)
                const isSelected = selectedNodeIds.has(table.name)
                return (
                    <div 
                        key={table.name}
                        className={`group flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer 
                            ${isHidden ? 'opacity-40 grayscale' : 'hover:bg-surface-800/60'} 
                            ${isSelected ? 'bg-primary-500/15 border border-primary-500/40 shadow-[0_0_15px_-5px_rgba(99,102,241,0.5)]' : 'border border-transparent'}`}
                    >
                        <div 
                            className="flex items-center gap-2 flex-1 min-w-0"
                            onDoubleClick={() => flyToTable(table.name)}
                            title="Double-click to center in diagram"
                        >
                            <Database className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary-300' : 'text-primary-400'}`} />
                            <span className={`text-[11px] truncate font-semibold ${isSelected ? 'text-white' : 'text-surface-200'}`}>{table.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                             <button
                                onClick={(e) => { e.stopPropagation(); toggleTableVisibility(table.name) }}
                                className="p-1 hover:bg-surface-700 rounded text-surface-500 hover:text-white transition-colors"
                             >
                                {isHidden ? <XCircle className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                             </button>
                        </div>
                    </div>
                )
            })}
         </div>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onSelectionChange={onSelectionChange}
            onSelectionContextMenu={onSelectionContextMenu}
            onNodeDragStop={onNodeDragStop}
            onSelectionDragStop={onSelectionDragStop}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.05}
            zoomOnScroll={false}
            panOnScroll={true}
            selectionOnDrag={true}
            panOnDrag={[2]}
            selectionMode={SelectionMode.Partial}
            elevateEdgesOnSelect={true}
        >
            <Background color="#0f172a" gap={20} size={1} />
            <Controls showInteractive={true} />
            <MiniMap
            nodeColor="#1e293b"
            maskColor="rgba(2, 6, 23, 0.7)"
            pannable
            zoomable
            />
        </ReactFlow>

        {contextMenu && (
            <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
            />
        )}

        {/* Floating Toolbar & Status Bar */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-20">
            <div className="flex gap-2 p-1 bg-surface-900 border border-surface-700/60 rounded-xl shadow-xl">
                 <button 
                  onClick={() => handleLayoutToggle('LR')}
                  title="Horizontal Layout"
                  className={`p-2 rounded-lg transition-all ${layoutDirection === 'LR' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                 >
                    <LayoutIcon className="w-4 h-4 rotate-0" />
                 </button>
                 <button 
                  onClick={() => handleLayoutToggle('TB')}
                  title="Vertical Layout"
                  className={`p-2 rounded-lg transition-all ${layoutDirection === 'TB' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}
                 >
                    <LayoutIcon className="w-4 h-4 -rotate-90" />
                 </button>
                 <div className="w-px h-6 bg-surface-800 self-center mx-1" />
                 <button 
                  className="btn-primary text-[10px] px-3 h-8"
                  onClick={() => onCreateTable?.()}
                 >
                    <Plus className="w-3.5 h-3.5" />
                    New Table
                 </button>
            </div>

            {saveError && (
                <div className="flex flex-col items-end gap-2 max-w-md">
                    <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl shadow-2xl animate-shake text-left">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Execution Error</p>
                            <p className="text-[11px] text-red-200/90 leading-relaxed break-words">{saveError}</p>
                        </div>
                        <button onClick={() => setSaveError(null)} className="text-red-400/50 hover:text-red-400">
                            <Plus className="w-3 h-3 rotate-45" />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Export with Provider
// ---------------------------------------------------------------------------
export default memo(function ERDiagram(props) {
    return (
        <ReactFlowProvider>
            <ERDiagramInner {...props} />
        </ReactFlowProvider>
    )
})
