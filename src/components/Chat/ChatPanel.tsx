import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useElectronAPI'
import { useConversationStore } from '../../store/conversationStore'
import { ConversationList } from './ConversationList'
import type { ChatMessage } from '../../store/conversationStore'

interface ChatPanelProps {
  className?: string
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ className }) => {
  const {
    currentConversationId,
    messages,
    loadConversations,
    createConversation,
    addLocalMessage,
    updateLocalLastMessage,
    setLocalMessageStreaming,
    saveMessage,
  } = useConversationStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<'anthropic' | 'openai' | 'kimi'>('kimi')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const currentStreamId = useRef<string | null>(null)
  const streamingMessageId = useRef<string | null>(null)

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const { startStream } = useAIStream(
    async (chunk) => {
      updateLocalLastMessage(chunk)
    },
    async () => {
      setIsLoading(false)
      currentStreamId.current = null
      
      // Save the final message to database
      const { messages } = useConversationStore.getState()
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && streamingMessageId.current === lastMessage.id) {
        setLocalMessageStreaming(lastMessage.id, false)
        await saveMessage({ ...lastMessage, isStreaming: false })
        streamingMessageId.current = null
      }
    },
    (error) => {
      console.error('Stream error:', error)
      addLocalMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${error}`,
        timestamp: Date.now(),
      })
      setIsLoading(false)
      currentStreamId.current = null
      streamingMessageId.current = null
    }
  )

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    // Check if there's a current conversation, if not create one
    let conversationId = currentConversationId
    if (!conversationId) {
      await createConversation(input.trim().slice(0, 30) || '新对话')
      conversationId = useConversationStore.getState().currentConversationId
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    // Add messages locally
    addLocalMessage(userMessage)
    addLocalMessage(assistantMessage)
    streamingMessageId.current = assistantMessage.id
    
    // Save user message immediately
    await saveMessage(userMessage)

    setInput('')
    setIsLoading(true)

    // Build API messages
    const conversationMessages = [
      ...messages.filter((m) => !m.isStreaming && m.role !== 'system'),
      userMessage,
    ].map((m) => ({ role: m.role, content: m.content }))

    try {
      await startStream(conversationMessages, {
        provider: selectedProvider,
        temperature: 0.7,
        maxTokens: 2000,
      })
    } catch (error) {
      console.error('Failed to start stream:', error)
      setIsLoading(false)
      streamingMessageId.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className={`flex h-full bg-gray-900 ${className}`}>
      {/* Conversation List Sidebar */}
      <ConversationList />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="font-medium">AI Chat</span>
            {currentConversationId && (
              <span className="text-xs text-gray-500 ml-2">对话已保存</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as 'anthropic' | 'openai' | 'kimi')}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="anthropic">Claude</option>
              <option value="openai">GPT</option>
              <option value="kimi">Kimi</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>开始一个新的对话</p>
              <p className="text-sm mt-2">在左侧创建或选择对话</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 group ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'system'
                      ? 'bg-red-900/50 text-red-200'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1"></span>
                      )}
                    </div>
                  </div>

                  {!message.isStreaming && message.role !== 'system' && (
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-end gap-2 bg-gray-800 rounded-lg p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentConversationId ? "输入消息... (Shift+Enter 换行)" : "点击左侧 + 新建对话"}
              className="flex-1 bg-transparent resize-none outline-none text-white placeholder-gray-500 min-h-[20px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">AI 可能会生成不准确的信息，请验证重要信息。</p>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
