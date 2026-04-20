/**
 * useDatabase — custom hook for connection state, schema, query and DDL/DML management.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import * as api from '../lib/api'

const COOKIE_KEY = 'dbweb_session'
const CREDS_KEY  = 'dbweb_creds'

import { getTableMetadata, saveTableMetadata } from '../lib/snippets'

export function useDatabase() {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState(() => Cookies.get(COOKIE_KEY) || null)
  const [logs, setLogs] = useState([])
  const wsRef = useRef(null)

  // ----- WebSocket log stream -----
  useEffect(() => {
    if (!sessionId) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${proto}://${window.location.host}/ws/logs`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        setLogs((prev) => [...prev.slice(-200), msg])
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = () => { wsRef.current = null }
    wsRef.current = ws

    return () => ws.close()
  }, [sessionId])

  // ----- Log helper -----
  const addLog = useCallback((type, message) => {
    const msgString = typeof message === 'string' ? message : JSON.stringify(message)
    setLogs((prev) => [
      ...prev.slice(-200),
      { type, message: msgString, timestamp: new Date().toISOString() },
    ])
  }, [])

  // ----- Connect -----
  const connectMutation = useMutation({
    mutationFn: (creds) => api.connectDB(creds),
    onSuccess: (data, creds) => {
      setSessionId(data.session_id)
      Cookies.set(COOKIE_KEY, data.session_id, { expires: 1, sameSite: 'Strict' })
      Cookies.set(CREDS_KEY, JSON.stringify({
        db_type: creds.db_type,
        host: creds.host,
        port: creds.port,
        username: creds.username,
        database: creds.database,
      }), { expires: 1, sameSite: 'Strict' })
      addLog('success', `Connected to ${data.db_type}://${creds.host}:${creds.port}/${data.database}`)
    },
    onError: (err) => {
      addLog('error', `Connection failed: ${err.message}`)
    },
  })

  // ----- Disconnect -----
  const disconnect = useCallback(async () => {
    if (sessionId) {
      try { await api.disconnectDB(sessionId) } catch { /* ignore */ }
    }
    setSessionId(null)
    Cookies.remove(COOKIE_KEY)
    Cookies.remove(CREDS_KEY)
    queryClient.clear()
    addLog('info', 'Disconnected')
  }, [sessionId, queryClient, addLog])

  // ----- Schema (auto-fetch when connected) -----
  const schemaQuery = useQuery({
    queryKey: ['schema', sessionId],
    queryFn: () => api.fetchSchema(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
    retry: 1,
  })

  // Auto-disconnect if session is invalid (e.g. backend restarted)
  useEffect(() => {
    if (schemaQuery.error && (schemaQuery.error.status === 404 || schemaQuery.error.message.includes('not found'))) {
      disconnect()
      addLog('error', 'Session expired or database connection lost')
    }
  }, [schemaQuery.error, disconnect, addLog])

  // ----- Execute query -----
  const executeQueryMutation = useMutation({
    mutationFn: ({ sql, allowDestructive }) => {
      if (typeof sql !== 'string' || !sql.trim()) {
        throw new Error('SQL query cannot be empty')
      }
      return api.executeQuery(sessionId, sql, allowDestructive)
    },
    onSuccess: (data) => {
      addLog('success', `Query OK — ${data.row_count} rows (${data.execution_time_ms}ms)`)
    },
    onError: (err) => {
      addLog('error', `Query error: ${err.message}`)
    },
  })

  // ----- Table Metadata -----
  const metadataQuery = useQuery({
    queryKey: ['table-metadata', sessionId],
    queryFn: () => getTableMetadata(JSON.parse(Cookies.get(CREDS_KEY) || '{}')),
    enabled: !!sessionId,
    staleTime: 300_000,
  })

  const saveMetadataMutation = useMutation({
    mutationFn: ({ tableName, isIndex }) => saveTableMetadata(tableName, isIndex, JSON.parse(Cookies.get(CREDS_KEY) || '{}')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table-metadata'] })
    }
  })

  // ----- Table data -----
  const fetchTable = useCallback(
    (table, schema = 'public', page = 1, pageSize = 50) =>
      api.fetchTableData(sessionId, table, schema, page, pageSize),
    [sessionId],
  )

  // ----- DDL: Create Table -----
  const createTableMutation = useMutation({
    mutationFn: ({ table, schemaName, columns }) =>
      api.createTable(sessionId, table, schemaName, columns),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Create table failed: ${err.message}`),
  })

  // ----- DDL: Drop Table -----
  const dropTableMutation = useMutation({
    mutationFn: ({ table, schemaName }) =>
      api.dropTable(sessionId, table, schemaName),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Drop table failed: ${err.message}`),
  })

  // ----- DDL: Rename Table -----
  const renameTableMutation = useMutation({
    mutationFn: ({ table, schemaName, newName }) =>
      api.renameTable(sessionId, table, schemaName, newName),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Rename table failed: ${err.message}`),
  })

  // ----- DDL: Add Column -----
  const addColumnMutation = useMutation({
    mutationFn: ({ table, schemaName, column }) =>
      api.addColumn(sessionId, table, schemaName, column),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Add column failed: ${err.message}`),
  })

  // ----- DDL: Modify Column -----
  const modifyColumnMutation = useMutation({
    mutationFn: ({ table, schemaName, columnName, newDataType, newNullable, isPrimary, isUnique, isAutoincrement }) =>
      api.modifyColumn(sessionId, table, schemaName, columnName, newDataType, newNullable, isPrimary, isUnique, isAutoincrement),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Modify column failed: ${err.message}`),
  })

  // ----- DDL: Drop Column -----
  const dropColumnMutation = useMutation({
    mutationFn: ({ table, schemaName, columnName }) =>
      api.dropColumn(sessionId, table, schemaName, columnName),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Drop column failed: ${err.message}`),
  })

  // ----- DDL: Rename Column -----
  const renameColumnMutation = useMutation({
    mutationFn: ({ table, schemaName, columnName, newName }) =>
      api.renameColumn(sessionId, table, schemaName, columnName, newName),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Rename column failed: ${err.message}`),
  })

  // ----- DDL: Create Foreign Key -----
  const createForeignKeyMutation = useMutation({
    mutationFn: ({ source, target }) =>
      api.createForeignKey(sessionId, source, target),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Relationship failed: ${err.message}`),
  })

  // ----- DDL: Drop Foreign Key -----
  const dropForeignKeyMutation = useMutation({
    mutationFn: ({ table, schemaName, constraintName }) =>
      api.dropForeignKey(sessionId, table, schemaName, constraintName),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['schema'] })
    },
    onError: (err) => addLog('error', `Drop relationship failed: ${err.message}`),
  })

  // ----- Records: Insert -----
  const insertRecordMutation = useMutation({
    mutationFn: ({ table, schemaName, data }) =>
      api.insertRecord(sessionId, table, schemaName, data),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Insert failed: ${err.message}`),
  })

  // ----- Records: Delete -----
  const deleteRecordsMutation = useMutation({
    mutationFn: ({ table, schemaName, pkColumn, pkValues }) =>
      api.deleteRecords(sessionId, table, schemaName, pkColumn, pkValues),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Delete failed: ${err.message}`),
  })

  // ----- Records: Bulk Insert -----
  const bulkInsertMutation = useMutation({
    mutationFn: ({ table, schemaName, data }) =>
      api.bulkInsert(sessionId, table, schemaName, data),
    onSuccess: (data) => {
      addLog('success', data.message)
      queryClient.invalidateQueries({ queryKey: ['table-data'] })
    },
    onError: (err) => addLog('error', `Bulk import failed: ${err.message}`),
  })

  // ----- Saved credentials -----
  const savedCreds = useMemo(() => {
    try { 
      return JSON.parse(Cookies.get(CREDS_KEY) || 'null') 
    } catch { 
      return null 
    }
  }, [sessionId]) // Only re-parse if session changes

  return {
    // State
    sessionId,
    isConnected: !!sessionId,
    isConnecting: connectMutation.isPending,
    savedCreds,

    // Schema
    schema: schemaQuery.data ?? null,
    isSchemaLoading: schemaQuery.isLoading,
    refetchSchema: schemaQuery.refetch,
    metadata: metadataQuery.data ?? [],
    isMetadataLoading: metadataQuery.isLoading,

    // Actions
    connect: connectMutation.mutate,
    connectError: connectMutation.error,
    disconnect,
    executeQuery: executeQueryMutation.mutate,
    isExecuting: executeQueryMutation.isPending,
    queryResult: executeQueryMutation.data ?? null,
    queryError: executeQueryMutation.error,
    fetchTable,
    saveTableMetadata: saveMetadataMutation.mutate,
    saveTableMetadataAsync: saveMetadataMutation.mutateAsync,

    // DDL
    createTable: createTableMutation.mutate,
    createTableAsync: createTableMutation.mutateAsync,
    isCreatingTable: createTableMutation.isPending,
    dropTable: dropTableMutation.mutate,
    dropTableAsync: dropTableMutation.mutateAsync,
    renameTable: renameTableMutation.mutate,
    renameTableAsync: renameTableMutation.mutateAsync,
    addColumn: addColumnMutation.mutate,
    addColumnAsync: addColumnMutation.mutateAsync,
    isAddingColumn: addColumnMutation.isPending,
    modifyColumn: modifyColumnMutation.mutate,
    modifyColumnAsync: modifyColumnMutation.mutateAsync,
    isModifyingColumn: modifyColumnMutation.isPending,
    dropColumn: dropColumnMutation.mutate,
    dropColumnAsync: dropColumnMutation.mutateAsync,
    renameColumn: renameColumnMutation.mutate,
    renameColumnAsync: renameColumnMutation.mutateAsync,
    isRenamingColumn: renameColumnMutation.isPending,
    createForeignKey: createForeignKeyMutation.mutate,
    createForeignKeyAsync: createForeignKeyMutation.mutateAsync,
    isCreatingFK: createForeignKeyMutation.isPending,
    dropForeignKey: dropForeignKeyMutation.mutate,
    dropForeignKeyAsync: dropForeignKeyMutation.mutateAsync,
    isDeletingFK: dropForeignKeyMutation.isPending,

    // Records
    insertRecord: insertRecordMutation.mutate,
    isInserting: insertRecordMutation.isPending,
    bulkInsert: bulkInsertMutation.mutate,
    isImporting: bulkInsertMutation.isPending,
    deleteRecords: deleteRecordsMutation.mutate,
    isDeleting: deleteRecordsMutation.isPending,

    // Logs
    logs,
    addLog,
    clearLogs: () => setLogs([]),
    connectionInfo: savedCreds,
  }
}
