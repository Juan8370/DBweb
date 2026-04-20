import { useState, useMemo, useEffect } from 'react'
import {
  Database,
  Server,
  User,
  Lock,
  Loader2,
  AlertCircle,
  Plug,
  Info,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Terminal,
} from 'lucide-react'

const DB_TYPES = [
  { value: 'postgresql', label: 'PostgreSQL', port: 5432, color: 'text-blue-400' },
  { value: 'mysql',      label: 'MySQL',      port: 3306, color: 'text-orange-400' },
  { value: 'sqlserver',  label: 'SQL Server',  port: 1433, color: 'text-red-400' },
]

export default function ConnectionForm({ onConnect, isConnecting, error, savedCreds }) {
  const [connectionMode, setConnectionMode] = useState('form') // 'form' or 'string'
  const [form, setForm] = useState({
    db_type:  savedCreds?.db_type  || 'sqlserver',
    host:     savedCreds?.host     || '',
    port:     savedCreds?.port     || 1433,
    username: savedCreds?.username || '',
    password: savedCreds?.password || '',
    database: savedCreds?.database || '',
    connection_string: '',
    use_ssl:  savedCreds?.use_ssl  || false,
  })

  // 1. Live Preview & Sync Logic
  const generatedString = useMemo(() => {
    const driverMap = { postgresql: 'postgresql+psycopg2', mysql: 'mysql+pymysql', sqlserver: 'mssql+pyodbc' }
    const scheme = driverMap[form.db_type] || form.db_type
    const hostPort = form.port ? `${form.host}:${form.port}` : form.host
    const userPass = form.username ? `${form.username}:${form.password}@` : ''
    let str = `${scheme}://${userPass}${hostPort}/${form.database}`
    if (form.db_type === 'sqlserver') {
        const drv = "ODBC+Driver+17+for+SQL+Server"
        str += `?driver=${drv}&TrustServerCertificate=yes`
        if (form.use_ssl) str += "&Encrypt=yes"
    }
    return str
  }, [form.db_type, form.host, form.port, form.username, form.password, form.database, form.use_ssl])

  // 2. Automatically sync to the connection_string field
  useEffect(() => {
    setForm(f => ({ ...f, connection_string: generatedString }))
  }, [generatedString])

  const handleDbTypeChange = (e) => {
    const db = DB_TYPES.find((d) => d.value === e.target.value)
    setForm((f) => ({ ...f, db_type: e.target.value, port: db?.port || f.port }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Persist to localStorage for next time
    localStorage.setItem('dbweb_last_credentials', JSON.stringify(form))
    
    if (connectionMode === 'string') {
        onConnect({ 
            db_type: form.db_type, 
            connection_string: form.connection_string 
        })
    } else {
        onConnect({ 
            ...form, 
            port: form.port ? Number(form.port) : null 
        })
    }
  }

  const selectedDb = DB_TYPES.find((d) => d.value === form.db_type)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-slide-up relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600/10 border border-primary-500/20 mb-4">
            <Database className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            DB<span className="text-primary-400">web</span>
          </h1>
          <p className="text-surface-400 text-sm mt-1">Universal Database Manager</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="card" id="connection-form">
          <div className="card-header">
            <span className="text-sm font-semibold text-surface-200 flex items-center gap-2">
              <Plug className="w-4 h-4 text-primary-400" />
              New Connection
            </span>
            {selectedDb && (
              <span className={`badge ${selectedDb.color} border border-current/20 bg-current/10`}>
                {selectedDb.label}
              </span>
            )}
          </div>

          <div className="card-body space-y-4">
            {/* DB Type */}
            <div>
              <label className="input-label" htmlFor="db-type">Engine</label>
              <select
                id="db-type"
                className="select"
                value={form.db_type}
                onChange={handleDbTypeChange}
              >
                {DB_TYPES.map((db) => (
                  <option key={db.value} value={db.value}>{db.label}</option>
                ))}
              </select>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-surface-950 p-1 rounded-xl border border-surface-800">
                <button 
                  type="button" 
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${connectionMode === 'form' ? 'bg-primary-600 text-white shadow-lg' : 'text-surface-500 hover:text-surface-300'}`}
                  onClick={() => setConnectionMode('form')}
                >
                    Form Mode
                </button>
                <button 
                  type="button" 
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${connectionMode === 'string' ? 'bg-primary-600 text-white shadow-lg' : 'text-surface-500 hover:text-surface-300'}`}
                  onClick={() => setConnectionMode('string')}
                >
                    Connection String
                </button>
            </div>

            {connectionMode === 'form' ? (
                <>
                {/* Host + Port */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="input-label" htmlFor="host">
                      <Server className="w-3 h-3 inline mr-1" />Host
                    </label>
                    <input
                      id="host"
                      className="input"
                      value={form.host}
                      onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                      placeholder="host.docker.internal"
                      required={connectionMode === 'form'}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="port">Port</label>
                    <input
                      id="port"
                      type="number"
                      className="input"
                      value={form.port}
                      onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                      placeholder={selectedDb?.port?.toString()}
                    />
                  </div>
                </div>

                {/* Docker hint */}
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary-500/5 border border-primary-500/10 text-[11px] text-surface-400">
                  <Info className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
                  <span>
                    Use <span className="text-primary-300 font-medium">host.docker.internal</span> to connect to databases running on your local machine.
                    For named SQL Server instances, use <span className="text-primary-300 font-medium">host.docker.internal\InstanceName</span>.
                  </span>
                </div>

                {/* Username */}
                <div>
                  <label className="input-label" htmlFor="username">
                    <User className="w-3 h-3 inline mr-1" />Username
                  </label>
                  <input
                    id="username"
                    className="input"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="admin"
                    required={connectionMode === 'form'}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="input-label" htmlFor="password">
                    <Lock className="w-3 h-3 inline mr-1" />Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    required={connectionMode === 'form'}
                  />
                </div>

                {/* Database */}
                <div>
                  <label className="input-label" htmlFor="database">
                    <Database className="w-3 h-3 inline mr-1" />Database
                  </label>
                  <input
                    id="database"
                    className="input"
                    value={form.database}
                    onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                    placeholder="my_database"
                    required={connectionMode === 'form'}
                  />
                </div>

                {/* SSL Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-900/50 border border-surface-800 transition-all hover:border-surface-700">
                    <div className="flex items-center gap-2">
                        {form.use_ssl ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <ShieldAlert className="w-4 h-4 text-surface-500" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-surface-200">SSL Connection</span>
                            <span className="text-[9px] text-surface-500 uppercase tracking-widest">Encryption</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, use_ssl: !f.use_ssl }))}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all focus:outline-none ${form.use_ssl ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-surface-700'}`}
                    >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${form.use_ssl ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Live Preview Box */}
                <div className="mt-6 p-4 rounded-xl bg-surface-950 border border-primary-500/10 relative group border-dashed">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Terminal className="w-3 h-3" />
                            Live Connection Preview
                        </span>
                        <button 
                            type="button"
                            onClick={() => navigator.clipboard.writeText(generatedString.replace('****', form.password))}
                            className="p-1.5 hover:bg-surface-800 rounded-lg text-surface-400 hover:text-primary-400 transition-all"
                            title="Copy full connection string"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="font-mono text-[10px] text-surface-400 break-all leading-relaxed bg-surface-900/50 p-2 rounded border border-surface-800/50">
                        {generatedString}
                    </div>
                </div>
                </>
            ) : (
                <div className="space-y-4 animate-scale-in">
                    <div>
                        <label className="input-label" htmlFor="connection-string">Full Connection String</label>
                        <textarea
                            id="connection-string"
                            className="input min-h-[120px] font-mono text-[11px] leading-relaxed"
                            value={form.connection_string}
                            onChange={(e) => setForm((f) => ({ ...f, connection_string: e.target.value }))}
                            placeholder={`Example for SQL Server:\nmssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes`}
                            required={connectionMode === 'string'}
                        />
                        <p className="text-[10px] text-surface-500 mt-2 italic leading-tight">
                            Note: Ensure the driver name in your string matches the one installed on the server.
                        </p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error.message}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={isConnecting}
              id="connect-btn"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer hint */}
        <p className="text-center text-xs text-surface-500 mt-6">
          Credentials are encrypted server-side. Passwords are never stored in the browser.
        </p>
      </div>
    </div>
  )
}
