import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode } from '@xyflow/react'
import { Settings2 } from 'lucide-react'

export default function JoinEdge({
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const { joinType = 'INNER', onTypeChange } = data || {}

  const onJoinTypeClick = (e) => {
    e.stopPropagation()
    const types = ['INNER', 'LEFT', 'RIGHT', 'FULL']
    const nextIdx = (types.indexOf(joinType) + 1) % types.length
    onTypeChange?.(id, types[nextIdx])
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 3 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={onJoinTypeClick}
            className={`
              flex flex-col items-center justify-center p-1 font-mono text-[9px] font-bold rounded shadow-lg border-2 transition-all
              ${joinType === 'INNER' ? 'bg-indigo-600 border-indigo-400 text-white' : 
                joinType === 'LEFT' ? 'bg-emerald-600 border-emerald-400 text-white' :
                joinType === 'RIGHT' ? 'bg-amber-600 border-amber-400 text-white' :
                'bg-rose-600 border-rose-400 text-white'}
            `}
            title="Click to change Join Type"
          >
            <Settings2 className="w-2.5 h-2.5 mb-0.5 opacity-60" />
            {joinType}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
