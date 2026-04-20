import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeMirror from '@uiw/react-codemirror'
import { markdown as langMarkdown } from '@codemirror/lang-markdown'
import { autocompletion } from '@codemirror/autocomplete'
import mermaid from 'mermaid'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { 
  FileText, Database, Plus, Save, Trash2, 
  ChevronLeft, ChevronRight, Edit3, Eye, Loader2, 
  Download, Search, Clock, FileCode, ZoomIn, ZoomOut, RefreshCw, Maximize2, MousePointer2,
  ExternalLink, Hash
} from 'lucide-react'
import { generateSchemaMarkdown } from '../utils/docGenerator'
import { getDocuments, saveDocument, updateDocument, deleteDocument } from '../lib/snippets'

// Initialize Mermaid with larger base rendering to prevent "too small" look
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  er: { 
    useMaxWidth: false,
    diagramPadding: 50,
    minEntityWidth: 150,
    minEntityHeight: 70
  },
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#fff',
    primaryBorderColor: '#4f46e5',
    lineColor: '#818cf8',
    secondaryColor: '#1e1b4b',
    tertiaryColor: '#111827',
    fontSize: '13px'
  }
})

// --- Internal Table Link Component ---
const TableLink = ({ tableName, onNavigate }) => (
  <button
    onClick={() => onNavigate(tableName)}
    className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 hover:text-primary-300 border border-primary-500/20 rounded-md transition-all font-bold text-[0.9em] align-baseline group shadow-sm active:scale-95"
  >
    <Hash className="w-3 h-3 text-primary-500/50 group-hover:text-primary-400" />
    {tableName}
  </button>
)

const MermaidChart = ({ chart }) => {
  const ref = useRef(null)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    if (ref.current && chart && chart.trim().length > 10) {
      try {
        setError(null)
        ref.current.removeAttribute('data-processed')
        // Clean previous content to be safe
        ref.current.innerHTML = chart
        mermaid.init(undefined, ref.current)
      } catch (e) {
        console.error('Mermaid Init Error:', e)
        setError(e.message)
      }
    }
  }, [chart])

  if (error) {
    return (
      <div className="my-8 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center gap-3">
        <Database className="w-8 h-8 text-red-500/40" />
        <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Diagram Rendering Failed</p>
        <p className="text-[11px] text-red-300/60 font-mono text-center max-w-md">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 my-12 w-full group">
      <div 
        className="relative overflow-hidden bg-[#0a0a0f] rounded-3xl border border-surface-800/60 shadow-[0_0_100px_-20px_rgba(99,102,241,0.2)]"
        style={{ height: '600px' }}
      >
        <TransformWrapper
          initialScale={0.8}
          minScale={0.01}
          maxScale={12}
          centerOnInit={true}
          limitToBounds={false}
          wheel={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform, centerView }) => (
            <>
              <div className="absolute top-6 right-6 z-30 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                <button onClick={() => zoomIn(0.3)} className="p-3.5 bg-surface-900/95 hover:bg-primary-600 text-white rounded-2xl border border-surface-800/50 backdrop-blur-2xl transition-all shadow-2xl hover:scale-110 active:scale-95">
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button onClick={() => zoomOut(0.3)} className="p-3.5 bg-surface-900/95 hover:bg-primary-600 text-white rounded-2xl border border-surface-800/50 backdrop-blur-2xl transition-all shadow-2xl hover:scale-110 active:scale-95">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button onClick={() => { resetTransform(); setTimeout(() => centerView(), 150); }} className="p-3.5 bg-surface-900/95 hover:bg-primary-600 text-white rounded-2xl border border-surface-800/50 backdrop-blur-2xl transition-all shadow-2xl hover:scale-110 active:scale-95">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              
              <div className="absolute top-6 left-8 z-20 pointer-events-none transition-all">
                <div className="px-5 py-2 bg-primary-500/10 border border-primary-500/20 rounded-2xl backdrop-blur-md">
                   <span className="text-[10px] text-primary-400 font-black uppercase tracking-[0.4em]">Exploration Mode</span>
                </div>
              </div>

              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentClassName="w-full h-full flex justify-center items-center"
              >
                <div className="mermaid min-w-max p-60 select-none" ref={ref}>
                  {chart}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
      
      <div className="flex items-center justify-center gap-10 py-5 px-12 bg-[#0a0a0f] rounded-full border border-surface-800/50 self-center shadow-2xl transition-all group-hover:border-primary-500/30">
        <div className="flex items-center gap-3 text-[11px] text-surface-500 font-black uppercase tracking-[0.25em]">
          <MousePointer2 className="w-4 h-4 text-primary-500" />
          <span>Infinite Scroll Zoom</span>
        </div>
        <div className="w-px h-5 bg-surface-800" />
        <div className="flex items-center gap-3 text-[11px] text-surface-500 font-black uppercase tracking-[0.25em]">
          <Maximize2 className="w-4 h-4 text-primary-500" />
          <span>Deep Pan Exploration</span>
        </div>
      </div>
    </div>
  )
}

export default memo(function Documentation({ schema, onTableSelect, connectionInfo }) {
  const [docs, setDocs] = useState([])
  const [selectedId, setSelectedId] = useState('auto-schema')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const connectionContext = useMemo(() => ({
    dbName: connectionInfo?.database || schema?.database || '',
    dbType: connectionInfo?.db_type || '',
    host: connectionInfo?.host || ''
  }), [connectionInfo?.database, connectionInfo?.db_type, connectionInfo?.host, schema?.database])

  const refreshDocs = useCallback(async () => {
    setIsLoading(true)
    const data = await getDocuments(connectionContext)
    setDocs(data)
    setIsLoading(false)
  }, [connectionContext])

  useEffect(() => {
    refreshDocs()
    window.addEventListener('dbweb_docs_updated', refreshDocs)
    return () => window.removeEventListener('dbweb_docs_updated', refreshDocs)
  }, [refreshDocs])

  const autoDoc = useMemo(() => generateSchemaMarkdown(schema), [schema])

  const selectedDoc = useMemo(() => {
    if (selectedId === 'auto-schema') {
      return { id: 'auto-schema', title: 'Database Structure', content: autoDoc, type: 'system' }
    }
    return docs.find(d => d.id === selectedId)
  }, [selectedId, docs, autoDoc])

  const filteredDocs = useMemo(() => {
    return docs.filter(d => 
      d.title.toLowerCase().includes(search.toLowerCase()) || 
      d.content.toLowerCase().includes(search.toLowerCase())
    )
  }, [docs, search])

  // --- Autocomplete Setup ---
  const tableCompletionSource = useCallback((context) => {
    // Check if we are inside [[ or just typing
    const before = context.matchBefore(/\[\[\w*/)
    if (!before) return null
    
    return {
      from: before.from + 2, // Start after [[
      options: (schema?.tables || []).map(t => ({
        label: t.name,
        type: "keyword",
        boost: 99
      }))
    }
  }, [schema])

  const editorExtensions = useMemo(() => [
    langMarkdown(),
    autocompletion({ override: [tableCompletionSource] })
  ], [tableCompletionSource])

  const handleCreate = async () => {
    const newDoc = await saveDocument('Untitled Note', '# New Note\nWrite your business logic here...', 'custom', connectionContext)
    setSelectedId(newDoc.id)
    setIsEditing(true)
    setEditTitle(newDoc.title)
    setEditContent(newDoc.content)
  }

  const handleSave = async () => {
    if (!selectedDoc || selectedDoc.type === 'system') return
    await updateDocument(selectedDoc.id, editTitle, editContent)
    setIsEditing(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(id)
      if (selectedId === id) setSelectedId('auto-schema')
    }
  }

  const startEditing = () => {
    if (!selectedDoc || selectedDoc.type === 'system') return
    setEditTitle(selectedDoc.title)
    setEditContent(selectedDoc.content)
    setIsEditing(true)
  }

  const exportDoc = () => {
    if (!selectedDoc) return
    const blob = new Blob([selectedDoc.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedDoc.title.replace(/\s+/g, '_').toLowerCase()}.md`
    a.click()
  }

  const handleInternalTableNavigation = (tableName) => {
    setSelectedId('auto-schema');
    setTimeout(() => {
      const id = `table-${tableName.toLowerCase()}`;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  const MarkdownComponents = {
    // Custom Table Reference Parser for paragraphs
    p: ({ children, ...props }) => {
      const processText = (child) => {
        if (typeof child !== 'string') return child;
        
        // Match [[TableName]]
        const parts = child.split(/(\[\[[\w-]+\]\])/g);
        return parts.map((part, i) => {
          if (part.startsWith('[[') && part.endsWith(']]')) {
            const tableName = part.slice(2, -2);
            return (
              <TableLink 
                key={i} 
                tableName={tableName} 
                onNavigate={handleInternalTableNavigation} 
              />
            );
          }
          return part;
        });
      };

      const newChildren = Array.isArray(children) 
        ? children.map(processText) 
        : processText(children);

      return <p {...props}>{newChildren}</p>;
    },

    a: ({ href, children, ...props }) => {
      if (href && href.startsWith('navigate-table-')) {
        const tableName = href.replace('navigate-table-', '');
        return (
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); onTableSelect(tableName); }}
            className="text-primary-400 hover:text-primary-300 no-underline hover:underline transition-all font-black decoration-2 inline-flex items-center gap-1.5"
            {...props}
          >
            {children}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        );
      }

      if (href && href.startsWith('#')) {
        return (
          <a 
            href={href} 
            className="text-primary-400 hover:text-primary-300 underline underline-offset-4 decoration-primary-500/30 hover:decoration-primary-400 transition-all font-semibold"
            {...props}
          >
            {children}
          </a>
        );
      }

      return <a href={href} className="text-primary-400 hover:text-primary-300 underline font-semibold" {...props}>{children}</a>;
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : null
      if (!inline && language === 'mermaid') return <MermaidChart chart={String(children).replace(/\n$/, '')} />
      return <code className={className} {...props}>{children}</code>
    },
    h3: ({ children, ...props }) => {
      const flatten = (text, child) => {
        if (typeof child === 'string') return text + child;
        if (Array.isArray(child)) return child.reduce(flatten, text);
        if (child?.props?.children) return flatten(text, child.props.children);
        return text;
      };
      const content = flatten('', children);
      const contentLower = content.toLowerCase();
      const isTable = contentLower.includes('table:');
      let id = '';
      if (isTable) {
        const parts = content.split(/table:/i);
        const tableName = parts[1] ? parts[1].trim() : 'unknown';
        id = `table-${tableName.toLowerCase().replace(/\s+/g, '-')}`;
      } else {
        id = contentLower.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      }
      return <h3 id={id} className="scroll-mt-24" {...props}>{children}</h3>;
    }
  }

  if (isLoading && docs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-surface-500 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <p className="text-xs uppercase tracking-widest font-bold">Loading Documentation...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-surface-950">
      {/* Sidebar */}
      <div className="w-64 border-r border-surface-800/60 flex flex-col bg-[#0a0a0f]">
        <div className="p-4 border-b border-surface-800/40">
          <button onClick={handleCreate} className="w-full btn-primary !py-2 flex items-center justify-center gap-2 group shadow-glow-primary active:scale-95 transition-transform">
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            New Document
          </button>
        </div>

        <div className="p-3 border-b border-surface-800/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-600" />
            <input 
              className="w-full bg-surface-950/50 border border-surface-800 rounded-md pl-8 pr-2 py-1.5 text-[11px] text-surface-400 placeholder:text-surface-700 focus:outline-none focus:border-primary-500/50 shadow-sm"
              placeholder="Search docs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-4">
          <div>
            <h3 className="px-2 mb-2 text-[10px] font-bold text-surface-600 uppercase tracking-wider">System</h3>
            <button 
              onClick={() => { setSelectedId('auto-schema'); setIsEditing(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${selectedId === 'auto-schema' ? 'bg-primary-600/10 text-primary-400' : 'text-surface-400 hover:bg-surface-800/40 hover:text-surface-200'}`}
            >
              <Database className="w-4 h-4" />
              Database Structure
            </button>
          </div>

          <div>
            <h3 className="px-2 mb-2 text-[10px] font-bold text-surface-600 uppercase tracking-wider">User Notes</h3>
            <div className="space-y-1">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="group relative">
                  <button 
                    onClick={() => { setSelectedId(doc.id); setIsEditing(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${selectedId === doc.id ? 'bg-surface-800 text-white shadow-xl translate-x-1' : 'text-surface-400 hover:bg-surface-800/30 hover:text-surface-200'}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-red-500/0 group-hover:text-red-500/60 hover:!text-red-500 transition-all font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#07070a] relative">
        {selectedDoc ? (
          <>
            <div className="h-14 px-6 border-b border-surface-800/40 flex items-center justify-between bg-surface-900/40 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${selectedDoc.type === 'system' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 'bg-surface-800 text-surface-400 border border-surface-700/50'}`}>
                  {selectedDoc.type === 'system' ? <Database className="w-5 h-5 shadow-glow" /> : <FileCode className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  {isEditing ? (
                    <input 
                      className="bg-transparent border-none outline-none text-lg font-bold text-white w-full focus:ring-0"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Document Title"
                      autoFocus
                    />
                  ) : (
                    <h2 className="text-lg font-bold text-white truncate px-1 tracking-tight">{selectedDoc.title}</h2>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={exportDoc} className="btn-ghost !px-3 !py-1.5 text-xs flex items-center gap-2 text-surface-400 border border-surface-800 hover:bg-surface-800 transition-all font-bold tracking-widest uppercase rounded-lg">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                {selectedDoc.type !== 'system' && (
                  <>
                    {isEditing ? (
                      <button onClick={handleSave} className="btn-primary !px-4 !py-1.5 text-xs flex items-center gap-2 shadow-glow-primary active:scale-95 transition-transform font-bold tracking-widest uppercase rounded-lg">
                        <Save className="w-4 h-4" />
                        Save Data
                      </button>
                    ) : (
                      <button onClick={startEditing} className="btn-ghost !px-4 !py-1.5 text-xs border border-surface-800 flex items-center gap-2 hover:bg-surface-800 transition-all active:scale-95 font-bold tracking-widest uppercase rounded-lg">
                        <Edit3 className="w-4 h-4 text-primary-500/70" />
                        Edit Insight
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar scroll-smooth">
              {isEditing ? (
                <div className="h-full flex flex-col sm:flex-row">
                  <div className="flex-1 h-full border-r border-surface-800/40 bg-surface-950">
                    <CodeMirror
                      value={editContent}
                      height="100%"
                      theme="dark"
                      extensions={editorExtensions}
                      onChange={(value) => setEditContent(value)}
                      className="text-sm h-full font-mono"
                    />
                  </div>
                  <div className="flex-1 h-full overflow-auto bg-surface-950 p-8 prose prose-invert max-w-none prose-pre:bg-surface-900 prose-headings:text-primary-400 prose-a:text-primary-400 prose-th:bg-surface-900 prose-td:p-4 prose-td:border-surface-800/60">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {editContent}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="w-full px-8 md:px-24 py-16">
                   <div className="prose prose-invert max-w-none 
                    prose-headings:text-primary-400 prose-headings:font-black
                    prose-p:text-surface-300 prose-p:leading-relaxed prose-p:text-lg
                    prose-table:border-collapse prose-table:w-full prose-table:overflow-hidden prose-table:rounded-3xl shadow-glow
                    prose-th:bg-surface-900/90 prose-th:text-primary-400 prose-th:uppercase prose-th:text-[10px] prose-th:tracking-widest prose-th:p-5 prose-th:text-left prose-th:border-b prose-th:border-surface-800
                    prose-td:p-5 prose-td:border-b prose-td:border-surface-800/40 prose-td:text-surface-400 prose-td:text-sm
                    prose-hr:border-surface-800/60 prose-hr:my-16
                   ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {selectedDoc.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-600 gap-4">
             <FileText className="w-16 h-16 opacity-10 animate-pulse text-primary-500" />
             <p className="text-sm font-black tracking-widest uppercase">Select a node to begin documentation</p>
          </div>
        )}
      </div>
    </div>
  )
})
