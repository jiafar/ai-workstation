import React, { useState, useEffect } from 'react'
import { useMemoryStore } from '../../store/memoryStore'

export const MemorySidebar: React.FC = () => {
  const {
    memories,
    enabled,
    isLoading,
    loadMemories,
    addMemory,
    deleteMemory,
    toggleEnabled,
  } = useMemoryStore()
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<'fact' | 'preference' | 'context' | 'important'>('fact')

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  const handleAddMemory = async () => {
    if (!newContent.trim()) return
    try {
      await addMemory(newContent.trim(), newType, 'manual')
      setNewContent('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add memory:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条记忆吗？')) {
      try {
        await deleteMemory(id)
      } catch (error) {
        console.error('Failed to delete memory:', error)
      }
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'important':
        return 'text-red-400 bg-red-400/10'
      case 'preference':
        return 'text-blue-400 bg-blue-400/10'
      case 'context':
        return 'text-green-400 bg-green-400/10'
      default:
        return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'important':
        return '重要'
      case 'preference':
        return '偏好'
      case 'context':
        return '上下文'
      default:
        return '事实'
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="font-medium">记忆系统</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleEnabled}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              enabled ? 'bg-purple-600' : 'bg-gray-700'
            }`}
            title={enabled ? '记忆系统已启用' : '记忆系统已禁用'}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Add Memory Form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-800 bg-gray-800/50">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入要记忆的内容..."
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 mb-3 min-h-[80px]"
            autoFocus
          />
          <div className="flex items-center gap-2 mb-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
            >
              <option value="fact">事实</option>
              <option value="preference">偏好</option>
              <option value="context">上下文</option>
              <option value="important">重要</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMemory}
              disabled={!newContent.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewContent('')
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mx-4 mt-4 mb-2 py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加新记忆
        </button>
      )}

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">加载中...</div>
        ) : memories.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-4">🧠</div>
            <div className="mb-2">还没有记忆</div>
            <div className="text-sm">点击上方按钮添加</div>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-gray-800 rounded-lg p-3 group hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${getTypeColor(memory.type)}`}
                  >
                    {getTypeLabel(memory.type)}
                  </span>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-200 mb-2 whitespace-pre-wrap">{memory.content}</p>
                <div className="text-xs text-gray-500">{formatDate(memory.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
        {enabled ? (
          <>
            已启用 • {memories.length} 条记忆
            <br />
            AI 会自动使用相关记忆
          </>
        ) : (
          '记忆系统已禁用'
        )}
      </div>
    </div>
  )
}

export default MemorySidebar
