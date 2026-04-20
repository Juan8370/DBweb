import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useDatabase } from './hooks/useDatabase'
import ConnectionForm from './components/ConnectionForm'
import Layout from './components/Layout'
import ERDiagram from './components/ERDiagram'
import DataTable from './components/DataTable'
import Terminal from './components/Terminal'
import QueryBuilder from './components/QueryBuilder'
import Documentation from './components/Documentation'

// Modals
import CreateTableModal from './components/modals/CreateTableModal'
import AddColumnModal from './components/modals/AddColumnModal'
import ModifyColumnModal from './components/modals/ModifyColumnModal'
import InsertRowModal from './components/modals/InsertRowModal'
import RenameModal from './components/modals/RenameModal'
import ConfirmModal from './components/modals/ConfirmModal'
import CreateRelationshipModal from './components/modals/CreateRelationshipModal'
import EditTableModal from './components/modals/EditTableModal'

export default function App() {
  const db = useDatabase()
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || 'er'
  })
  const [selectedTable, setSelectedTable] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('table') || null
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('dbweb_theme') || 'default')
  const [loadedSnippet, setLoadedSnippet] = useState(null)

  // Sync state TO URL
  useEffect(() => {
    const url = new URL(window.location)
    url.searchParams.set('tab', activeTab)
    if (selectedTable) {
      url.searchParams.set('table', selectedTable)
    } else {
      url.searchParams.delete('table')
    }
    window.history.pushState({}, '', url)
  }, [activeTab, selectedTable])

  // Sync state FROM URL (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveTab(params.get('tab') || 'er')
      setSelectedTable(params.get('table') || null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Sync Theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('dbweb_theme', theme)
  }, [theme])

  // Modal state
  const [modal, setModal] = useState(null)
  const closeModal = useCallback(() => setModal(null), [])

  // When a table is selected from ER diagram or sidebar, switch to data tab
  const handleTableSelect = useCallback((tableName) => {
    setSelectedTable(tableName)
    setActiveTab('data')
  }, [])

  const handleSnippetSelect = useCallback((snippet) => {
    setLoadedSnippet({ ...snippet, timestamp: Date.now() }) // Force update
    setActiveTab(snippet.type === 'sql' ? 'terminal' : 'query')
  }, [])


  // Get columns & schema_name for the selected table from schema
  const selectedTableInfo = useMemo(() => {
    if (!db.schema || !selectedTable) return null
    return db.schema.tables.find((t) => t.name === selectedTable) || null
  }, [db.schema, selectedTable])

  const selectedTableColumns = selectedTableInfo?.columns || null
  const selectedSchemaName = selectedTableInfo?.schema_name || 'public'

  const editTableInfo = useMemo(() => {
    if (modal?.type !== 'editTable') return null
    return db.schema?.tables?.find(t => t.name === modal.tableName) || null
  }, [db.schema, modal])

  // Connection info for the header
  const connectionInfo = db.savedCreds

  // -------- Modal handlers --------

  // Create Table
  const handleCreateTable = useCallback(() => {
    setModal({ type: 'createTable' })
  }, [])

  const handleCreateTableSubmit = useCallback(({ table, columns, importData }) => {
    db.createTable({ table, schemaName: selectedSchemaName, columns }, {
      onSuccess: () => {
        if (importData && importData.length > 0) {
            db.bulkInsert({ table, schemaName: selectedSchemaName, data: importData })
        }
        closeModal()
      },
    })
  }, [db, selectedSchemaName, closeModal])

  // Rename Table (from sidebar context menu)
  const handleRenameTable = useCallback((table) => {
    setModal({ type: 'renameTable', table })
  }, [])

  const handleRenameTableSubmit = useCallback((newName) => {
    if (!modal?.table) return
    db.renameTable({ table: modal.table.name, schemaName: modal.table.schema_name, newName })
    closeModal()
  }, [db, modal, closeModal])

  // Edit Table Request
  const handleEditTableRequested = useCallback((tableName) => {
    setModal({ type: 'editTable', tableName })
  }, [])

  // Drop Table (from sidebar context menu)
  // ------- Initial Load -------
  useEffect(() => {
    const saved = localStorage.getItem('dbweb_session')
    if (saved) {
      try {
        const { sessionId, host, dbType, database } = JSON.parse(saved)
        db.setSessionId(sessionId)
        db.setConnectionInfo({ host, dbType, database })
      } catch (e) {
        localStorage.removeItem('dbweb_session')
      }
    }
  }, [])

  // ------- Connection Handlers -------
  const handleConnectSuccess = useCallback((data, info) => {
    db.setSessionId(data.session_id)
    db.setConnectionInfo(info)
    
    // Persist session
    localStorage.setItem('dbweb_session', JSON.stringify({
      sessionId: data.session_id,
      ...info
    }))
  }, [db])

  const handleDisconnect = useCallback(async () => {
    await db.disconnect()
    setSelectedTable(null)
    localStorage.removeItem('dbweb_session')
  }, [db])

  const handleDropTable = useCallback((table) => {
    setModal({ type: 'dropTable', table })
  }, [])

  const handleDropTableConfirm = useCallback(() => {
    if (!modal?.table) return
    db.dropTable({ table: modal.table.name, schemaName: modal.table.schema_name })
    if (selectedTable === modal.table.name) setSelectedTable(null)
    closeModal()
  }, [db, modal, selectedTable, closeModal])

  // Add Column (from sidebar or DataTable toolbar)
  const handleAddColumn = useCallback((tableOrNull) => {
    const table = tableOrNull || selectedTableInfo
    if (!table) return
    setModal({ type: 'addColumn', table })
  }, [selectedTableInfo])

  const handleAddColumnSubmit = useCallback((column) => {
    if (!modal?.table) return
    db.addColumn({ 
        table: modal.table.name, 
        schemaName: modal.table.schema_name || 'public', 
        column 
    })
    closeModal()
  }, [db, modal, closeModal])

  // Modify Column (from DataTable column context menu)
  const handleModifyColumn = useCallback((colName, tableContext, colInfo) => {
    setModal({ type: 'modifyColumn', colName, table: tableContext || selectedTableInfo, colInfo })
  }, [selectedTableInfo])

  const handleModifyColumnSubmit = useCallback(({ new_data_type, new_nullable, is_primary, is_unique, is_autoincrement }) => {
    if (!modal?.colName || !modal?.table) return
    db.modifyColumn({
      table: modal.table.name,
      schemaName: modal.table.schema_name || 'public',
      columnName: modal.colName,
      newDataType: new_data_type,
      newNullable: new_nullable,
      isPrimary: is_primary,
      isUnique: is_unique,
      isAutoincrement: is_autoincrement,
    })
    closeModal()
  }, [db, modal, closeModal])

  // Drop Column (from DataTable or ER Diagram)
  const handleDropColumn = useCallback((colName, tableContext = null) => {
    setModal({ type: 'dropColumn', colName, table: tableContext || selectedTableInfo })
  }, [selectedTableInfo])

  const handleDropColumnConfirm = useCallback(() => {
    if (!modal?.colName || !modal?.table) return
    db.dropColumn({ 
      table: modal.table.name, 
      schemaName: modal.table.schema_name, 
      columnName: modal.colName 
    })
    closeModal()
  }, [db, modal, closeModal])

  // Rename Column (from DataTable column context menu)
  const handleRenameColumn = useCallback((colName) => {
    setModal({ type: 'renameColumn', colName })
  }, [])

  const handleRenameColumnSubmit = useCallback((newName) => {
    if (!modal?.colName) return
    db.renameColumn({
      table: selectedTable,
      schemaName: selectedSchemaName,
      columnName: modal.colName,
      newName,
    })
    closeModal()
  }, [db, modal, selectedTable, selectedSchemaName, closeModal])

  // Insert Row
  const handleInsertRow = useCallback(() => {
    if (!selectedTable || !selectedTableColumns) return
    setModal({ type: 'insertRow' })
  }, [selectedTable, selectedTableColumns])

  const handleInsertRowSubmit = useCallback((data) => {
    db.insertRecord({ table: selectedTable, schemaName: selectedSchemaName, data })
    closeModal()
  }, [db, selectedTable, selectedSchemaName, closeModal])

  // Delete Rows
  const handleDeleteRows = useCallback((pkValues) => {
    if (!selectedTable || !selectedTableColumns) return
    const pkCol = selectedTableColumns.find((c) => c.is_primary)?.name
    if (!pkCol) return
    setModal({ type: 'deleteRows', pkValues, pkCol })
  }, [selectedTable, selectedTableColumns])

  const handleDeleteRowsConfirm = useCallback(() => {
    if (!modal?.pkValues || !modal?.pkCol) return
    db.deleteRecords({
      table: selectedTable,
      schemaName: selectedSchemaName,
      pkColumn: modal.pkCol,
      pkValues: modal.pkValues,
    })
    closeModal()
  }, [db, modal, selectedTable, selectedSchemaName, closeModal])

  // Create Relationship (from ER Diagram)
  const handleCreateRelationship = useCallback((source, target) => {
    setModal({ type: 'createRelationship', source, target })
  }, [])

  const handleCreateRelationshipSubmit = useCallback(({ source, target, cardinality }) => {
    db.createForeignKey({ source, target, cardinality })
    closeModal()
  }, [db, closeModal])

  // Drop Relationship (from ER Diagram)
  const handleDropRelationship = useCallback((info) => {
    setModal({
      type: 'confirm',
      title: 'Delete Relationship',
      message: `Are you sure you want to remove the relationship "${info.constraintName}" on table "${info.table}"? This action cannot be undone.`,
      onConfirm: () => {
        db.dropForeignKey(info)
        closeModal()
      }
    })
  }, [db, closeModal])

  // ---------- Not connected → login ----------
  if (!db.isConnected) {
    return (
      <ConnectionForm
        onConnect={db.connect}
        isConnecting={db.isConnecting}
        error={db.connectError}
        savedCreds={db.savedCreds}
      />
    )
  }

  // Find the last error log to show as a notification
  const lastError = db.logs.filter(l => l.type === 'error').slice(-1)[0]

  // ---------- Connected → dashboard ----------
  return (
    <>
      {lastError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-up-modal">
            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 p-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-lg min-w-[320px]">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">!</div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none mb-1">Database Error</p>
                    <p className="text-xs text-red-200/90 font-medium leading-tight">{lastError.message}</p>
                </div>
                <button onClick={() => db.clearLogs()} className="p-1 hover:bg-white/10 rounded transition-colors text-red-400/50 hover:text-red-400">
                    <Plus className="w-4 h-4 rotate-45" />
                </button>
            </div>
        </div>
      )}
      <Layout
        schema={db.schema}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedTable={selectedTable}
        onTableSelect={handleTableSelect}
        onDisconnect={db.disconnect}
        isSchemaLoading={db.isSchemaLoading}
        onRefreshSchema={db.refetchSchema}
        connectionInfo={connectionInfo}
        onCreateTable={handleCreateTable}
        onRenameTable={handleRenameTable}
        onDropTable={handleDropTable}
        onAddColumn={handleAddColumn}
        theme={theme}
        onThemeChange={setTheme}
        onSnippetSelect={handleSnippetSelect}
      >
        {/* ER Diagram */}
        <div className={`h-full ${activeTab === 'er' ? 'block' : 'hidden'}`}>
          <ERDiagram
            schema={db.schema}
            onTableSelect={handleTableSelect}
            onCreateTable={handleCreateTable}
            onRenameTable={handleRenameTable}
            onAddColumn={handleAddColumn}
            onModifyColumn={handleModifyColumn}
            // Stabilized API handlers
            apiHandlers={useMemo(() => ({
                dropTable: db.dropTableAsync,
                addColumn: db.addColumnAsync, 
                modifyColumn: db.modifyColumnAsync,
                dropColumn: db.dropColumnAsync,
                createForeignKey: db.createForeignKeyAsync,
                dropForeignKey: db.dropForeignKeyAsync,
                createRelationship: handleCreateRelationship,
                onDropRelationship: handleDropRelationship
            }), [
              db.dropTableAsync, db.addColumnAsync, db.modifyColumnAsync, 
              db.dropColumnAsync, db.createForeignKeyAsync, db.dropForeignKeyAsync,
              handleCreateRelationship, handleDropRelationship
            ])}
          />
        </div>

        {/* Query Builder */}
        <div className={`h-full ${activeTab === 'query' ? 'block' : 'hidden'}`}>
          <QueryBuilder
            schema={db.schema}
            isExecuting={db.isExecuting}
            result={db.queryResult}
            error={db.queryError}
            onExecuteQuery={useCallback((sql) => {
              db.executeQuery({ sql })
            }, [db.executeQuery])}
            loadedSnippet={loadedSnippet?.type === 'visual' ? loadedSnippet : null}
          />
        </div>

        {/* Data Table */}
        <div className={`h-full ${activeTab === 'data' ? 'block' : 'hidden'}`}>
          <DataTable
            sessionId={db.sessionId}
            tableName={selectedTable}
            schemaName={selectedSchemaName}
            columns={selectedTableColumns}
            onInsertRow={handleInsertRow}
            onAddColumn={useCallback(() => handleAddColumn(selectedTableInfo), [handleAddColumn, selectedTableInfo])}
            onRenameColumn={handleRenameColumn}
            onModifyColumn={handleModifyColumn}
            onDropColumn={handleDropColumn}
            onDeleteRows={handleDeleteRows}
            onBulkInsert={useCallback((data) => db.bulkInsert({ table: selectedTable, schemaName: selectedSchemaName, data }), [db.bulkInsert, selectedTable, selectedSchemaName])}
            onEditTable={handleEditTableRequested}
            isImporting={db.isImporting}
            foreignKeys={db.schema?.foreign_keys}
          />
        </div>

        {/* Terminal */}
        <div className={`h-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
          <Terminal
            schema={db.schema}
            onExecute={db.executeQuery}
            isExecuting={db.isExecuting}
            result={db.queryResult}
            error={db.queryError}
            logs={db.logs}
            onClearLogs={db.clearLogs}
            loadedSnippet={loadedSnippet?.type === 'sql' ? loadedSnippet : null}
            connectionInfo={connectionInfo}
          />
        </div>
        
        {/* Documentation */}
        <div className={`h-full ${activeTab === 'docs' ? 'block' : 'hidden'}`}>
          <Documentation 
            schema={db.schema} 
            onTableSelect={handleTableSelect}
            connectionInfo={connectionInfo}
          />
        </div>
      </Layout>

      {/* ---- Modals ---- */}
      {modal?.type === 'createTable' && (
        <CreateTableModal
          onSubmit={handleCreateTableSubmit}
          onCancel={closeModal}
          isLoading={db.isCreatingTable}
        />
      )}

      {modal?.type === 'addColumn' && (
        <AddColumnModal
          tableName={modal.table.name}
          onSubmit={handleAddColumnSubmit}
          onCancel={closeModal}
          isLoading={db.isAddingColumn}
        />
      )}

      {modal?.type === 'modifyColumn' && (
        <ModifyColumnModal
          tableName={modal.table.name}
          columnName={modal.colName}
          currentType={modal.colInfo?.data_type}
          currentNullable={modal.colInfo?.is_nullable}
          onSubmit={handleModifyColumnSubmit}
          onCancel={closeModal}
          isLoading={db.isModifyingColumn}
        />
      )}

      {modal?.type === 'insertRow' && (
        <InsertRowModal
          tableName={selectedTable}
          columns={selectedTableColumns}
          onSubmit={handleInsertRowSubmit}
          onCancel={closeModal}
          isLoading={db.isInserting}
        />
      )}

      {modal?.type === 'renameTable' && (
        <RenameModal
          title={`Rename Table "${modal.table.name}"`}
          currentName={modal.table.name}
          onSubmit={handleRenameTableSubmit}
          onCancel={closeModal}
        />
      )}

      {modal?.type === 'renameColumn' && (
        <RenameModal
          title={`Rename Column "${modal.colName}"`}
          currentName={modal.colName}
          onSubmit={handleRenameColumnSubmit}
          onCancel={closeModal}
          isLoading={db.isRenamingColumn}
        />
      )}

      {modal?.type === 'dropTable' && (
        <ConfirmModal
          title="Drop Table"
          message={`Are you sure you want to drop table "${modal.table.name}"? This action cannot be undone.`}
          confirmLabel="Drop Table"
          onConfirm={handleDropTableConfirm}
          onCancel={closeModal}
          danger
        />
      )}

      {modal?.type === 'dropColumn' && (
        <ConfirmModal
          title="Drop Column"
          message={`Are you sure you want to drop column "${modal.colName}" from "${selectedTable}"? This action cannot be undone.`}
          confirmLabel="Drop Column"
          onConfirm={handleDropColumnConfirm}
          onCancel={closeModal}
          danger
        />
      )}

      {modal?.type === 'deleteRows' && (
        <ConfirmModal
          title="Delete Rows"
          message={`Are you sure you want to delete ${modal.pkValues.length} row(s)? This action cannot be undone.`}
          confirmLabel={`Delete ${modal.pkValues.length} Row(s)`}
          onConfirm={handleDeleteRowsConfirm}
          onCancel={closeModal}
          danger
        />
      )}
      {modal?.type === 'createRelationship' && (
        <CreateRelationshipModal
          source={modal.source}
          target={modal.target}
          sourceTable={db.schema?.tables?.find(t => t.name === modal.source.table)}
          targetTable={db.schema?.tables?.find(t => t.name === modal.target.table)}
          onSubmit={handleCreateRelationshipSubmit}
          onCancel={closeModal}
          isLoading={db.isCreatingFK}
        />
      )}
      
      {modal?.type === 'confirm' && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={closeModal}
          danger={modal.danger !== false}
        />
      )}

      {modal?.type === 'editTable' && editTableInfo && (
           <EditTableModal 
            table={editTableInfo}
            columns={editTableInfo.columns || []}
            onCancel={closeModal}
            onRenameTable={(newName) => {
              db.renameTable({ oldName: modal.tableName, newName, schemaName: selectedSchemaName }, {
                onSuccess: () => {
                  if (selectedTable === modal.tableName) setSelectedTable(newName)
                  closeModal()
                }
              })
            }}
            onAddColumn={(table) => setModal({ type: 'addColumn', table: { name: table.name, schema_name: table.schema_name } })}
            onModifyColumn={(colName, col) => setModal({ type: 'modifyColumn', table: { name: modal.tableName, schema_name: selectedSchemaName }, colName, colInfo: col })}
            onDropColumn={(colName) => setModal({ type: 'confirm', title: 'Drop Column', message: `Are you sure you want to drop column "${colName}" from "${modal.tableName}"?`, onConfirm: () => db.dropColumn({ table: modal.tableName, schemaName: selectedSchemaName, columnName: colName }, { onSuccess: () => setModal({ type: 'editTable', tableName: modal.tableName }) }) })}
            onDropTable={(table) => setModal({ type: 'confirm', title: 'Drop Table', message: `Are you sure you want to drop table "${table.name}"? This will delete ALL data.`, onConfirm: () => db.dropTable({ table: table.name, schemaName: selectedSchemaName }, { onSuccess: () => { setSelectedTable(null); setActiveTab('er'); closeModal(); } }) })}
            isLoading={db.isRenamingTable || db.isDroppingColumn || db.isDroppingTable}
           />
        )}
    </>
  )
}
