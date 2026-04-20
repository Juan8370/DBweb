import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react'
import { useState } from 'react'

/**
 * Custom Edge with 1:n / 1:1 labels at the ends and hover tooltips.
 */
export default function CardinalityEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [isHovered, setIsHovered] = useState(false)
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Heuristic for cardinality (simplified)
  // Source side is 'n' (FK), Target side is '1' (PK/Unique)
  const sourceLabel = data?.sourceLabel || 'n'
  const targetLabel = data?.targetLabel || '1'

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      className="cursor-pointer"
    >
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
            ...style,
            stroke: isHovered ? '#818cf8' : (style.stroke || '#4f46e5'),
            strokeWidth: isHovered ? 4 : (style.strokeWidth || 2),
            transition: 'all 0.2s ease',
            filter: isHovered ? 'drop-shadow(0 0 8px rgba(129, 140, 248, 0.5))' : 'none'
        }} 
      />
      
      {/* Invisible thicker path for easier hovering */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      <EdgeLabelRenderer>
        {/* Hover Tooltip (Center) */}
        {isHovered && (
            <div
                style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                    pointerEvents: 'none',
                    zIndex: 1000,
                }}
                className="animate-in fade-in zoom-in duration-200"
            >
                <div className="bg-surface-950/90 backdrop-blur-md border border-indigo-500/50 px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[10px] font-bold text-surface-200 uppercase tracking-tight">{source}</span>
                    <span className="text-primary-400 font-bold">→</span>
                    <span className="text-[10px] font-bold text-surface-200 uppercase tracking-tight">{target}</span>
                </div>
            </div>
        )}

        {/* Source Cardinality Label (n) */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${sourceX + (sourcePosition === 'left' ? -12 : 12)}px, ${sourceY - 10}px)`,
            fontSize: 9,
            fontWeight: '900',
            background: '#0f172a',
            color: '#94a3b8',
            padding: '1px 4px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
          className="border border-surface-700/50 shadow-sm font-mono"
        >
          {sourceLabel}
        </div>

        {/* Target Cardinality Label (1) */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${targetX + (targetPosition === 'left' ? -12 : 12)}px, ${targetY - 10}px)`,
            fontSize: 9,
            fontWeight: '900',
            background: '#0f172a',
            color: '#818cf8',
            padding: '1px 4px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
          className="border border-indigo-500/30 shadow-sm font-mono"
        >
          {targetLabel}
        </div>
      </EdgeLabelRenderer>
    </g>
  )
}
