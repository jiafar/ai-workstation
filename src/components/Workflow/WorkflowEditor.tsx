import React, { useState, useCallback, useRef } from 'react'

interface WorkflowNode {
  id: string
  type: 'start' | 'action' | 'condition' | 'end'
  label: string
  x: number
  y: number
  config?: Record<string, any>
}

interface WorkflowEdge {
  id: string
  from: string
  to: string
  label?: string
}

interface WorkflowEditorProps {
  className?: string
}

const NODE_WIDTH = 120
const NODE_HEIGHT = 60

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ className }) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: 'start', type: 'start', label: 'Start', x: 100, y: 200 },
    { id: 'action1', type: 'action', label: 'Process Data', x: 300, y: 200 },
    { id: 'condition1', type: 'condition', label: 'Check Result', x: 500, y: 200 },
    { id: 'end', type: 'end', label: 'End', x: 700, y: 200 },
  ])
  
  const [edges, setEdges] = useState<WorkflowEdge[]>([
    { id: 'e1', from: 'start', to: 'action1' },
    { id: 'e2', from: 'action1', to: 'condition1' },
    { id: 'e3', from: 'condition1', to: 'end', label: 'success' },
  ])
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    setDraggingNode(nodeId)
    setDragOffset({
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    })
    setSelectedNode(nodeId)
  }, [nodes])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode) return

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const newX = e.clientX - rect.left - dragOffset.x
    const newY = e.clientY - rect.top - dragOffset.y

    setNodes((prev) =>
      prev.map((n) =>
        n.id === draggingNode ? { ...n, x: newX, y: newY } : n
      )
    )
  }, [draggingNode, dragOffset])

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null)
  }, [])

  const addNode = (type: WorkflowNode['type']) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label: type === 'action' ? 'New Action' : type === 'condition' ? 'New Condition' : 'New Node',
      x: 200 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    }
    setNodes((prev) => [...prev, newNode])
  }

  const deleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId))
    if (selectedNode === nodeId) {
      setSelectedNode(null)
    }
  }

  const getNodeColor = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'start':
        return '#10b981'
      case 'end':
        return '#ef4444'
      case 'condition':
        return '#f59e0b'
      case 'action':
        return '#3b82f6'
      default:
        return '#6b7280'
    }
  }

  const getNodeShape = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'start':
      case 'end':
        return 'circle'
      case 'condition':
        return 'diamond'
      case 'action':
      default:
        return 'rect'
    }
  }

  return (
    <div className={`flex h-full bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => addNode('action')}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
          title="Add Action"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
        <button
          onClick={() => addNode('condition')}
          className="w-10 h-10 bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center justify-center transition-colors"
          title="Add Condition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <div className="w-8 h-px bg-gray-700 my-2" />
        <button
          onClick={() => selectedNode && deleteNode(selectedNode)}
          disabled={!selectedNode}
          className="w-10 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
          title="Delete Selected"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>

          {/* Grid */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from)
            const toNode = nodes.find((n) => n.id === edge.to)
            if (!fromNode || !toNode) return null

            return (
              <g key={edge.id}>
                <line
                  x1={fromNode.x + NODE_WIDTH / 2}
                  y1={fromNode.y + NODE_HEIGHT / 2}
                  x2={toNode.x + NODE_WIDTH / 2}
                  y2={toNode.y + NODE_HEIGHT / 2}
                  stroke="#6b7280"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(fromNode.x + toNode.x) / 2 + NODE_WIDTH / 2}
                    y={(fromNode.y + toNode.y) / 2 + NODE_HEIGHT / 2 - 5}
                    fill="#9ca3af"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const color = getNodeColor(node.type)
            const isSelected = selectedNode === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                className="cursor-pointer"
              >
                {getNodeShape(node.type) === 'circle' ? (
                  <circle
                    cx={NODE_WIDTH / 2}
                    cy={NODE_HEIGHT / 2}
                    r={NODE_HEIGHT / 2}
                    fill={color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? '3' : '0'}
                  />
                ) : getNodeShape(node.type) === 'diamond' ? (
                  <polygon
                    points={`${NODE_WIDTH / 2},0 ${NODE_WIDTH},${NODE_HEIGHT / 2} ${NODE_WIDTH / 2},${NODE_HEIGHT} 0,${NODE_HEIGHT / 2}`}
                    fill={color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? '3' : '0'}
                  />
                ) : (
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="8"
                    fill={color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? '3' : '0'}
                  />
                )}
                <text
                  x={NODE_WIDTH / 2}
                  y={NODE_HEIGHT / 2}
                  fill="white"
                  fontSize="12"
                  fontWeight="500"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Properties Panel */}
        {selectedNode && (
          <div className="absolute right-4 top-4 w-64 bg-gray-800 rounded-lg shadow-xl p-4">
            <h3 className="font-medium mb-4">Node Properties</h3>
            {(() => {
              const node = nodes.find((n) => n.id === selectedNode)
              if (!node) return null
              return (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400">Label</label>
                    <input
                      type="text"
                      value={node.label}
                      onChange={(e) =>
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === selectedNode
                              ? { ...n, label: e.target.value }
                              : n
                          )
                        )
                      }
                      className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Type</label>
                    <div className="mt-1 text-sm capitalize">{node.type}</div>
                  </div>
                  <div className="pt-2 border-t border-gray-700">
                    <button
                      onClick={() => deleteNode(selectedNode)}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                    >
                      Delete Node
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkflowEditor
