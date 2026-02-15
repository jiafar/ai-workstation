import React, { useState, useEffect, useCallback } from 'react'
import { useConversationStore } from '../../store/conversationStore'

export const ConversationList: React.FC = () => {
  const { conversations, currentConversationId, loadConversations, createConversation, switchConversation, deleteConversation } = useConversationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleCreateConversation = useCallback(async () => {
    if (!newTitle.trim()) return
    setIsLoading(true)
    try {
      await createConversation(newTitle.trim())
      setNewTitle('')
      setShowNewDialog(false)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [newTitle, createConversation])

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这个对话吗？')) {
      try {
        await deleteConversation(id)
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      }
    }
  }, [deleteConversation])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('zh-CN', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="font-medium text-sm">对话历史</span>
        <button
          onClick={() => setShowNewDialog(true)}
          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          title="新建对话"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* New Conversation Dialog */}
      {showNewDialog && (
        <div className="p-3 border-b border-gray-800 bg-gray-800/50">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateConversation()}
            placeholder="输入对话标题..."
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateConversation}
              disabled={!newTitle.trim() || isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition-colors"
            >
              创建
            </button>
            <button
              onClick={() => {
                setShowNewDialog(false)
                setNewTitle('')
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            暂无对话记录
            <br />
            点击上方 + 新建对话
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => switchConversation(conversation.id)}
                className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                  currentConversationId === conversation.id
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-800 border-l-2 border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${
                    currentConversationId === conversation.id ? 'text-blue-400' : 'text-gray-200'
                  }`}>
                    {conversation.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDate(conversation.updated_at)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-600/20 hover:text-red-400 rounded transition-all"
                  title="删除对话"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationList
