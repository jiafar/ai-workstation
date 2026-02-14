import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatPanel: React.FC = () => {
  const { messages, isStreaming, addMessage, updateLastMessage, setStreaming } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userMessage });

    // Check if it's a skill command
    if (userMessage.startsWith('/')) {
      const skillName = userMessage.slice(1).split(' ')[0];
      const args = userMessage.slice(skillName.length + 2).trim();

      try {
        setStreaming(true);
        const result = await window.api.skill.run(skillName, args);
        addMessage({ role: 'assistant', content: result });
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `Error running skill: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      } finally {
        setStreaming(false);
      }
      return;
    }

    // Regular chat
    try {
      setStreaming(true);
      addMessage({ role: 'assistant', content: '' });

      const unsubscribe = await window.api.ai.chatStream(
        messages.concat({ role: 'user', content: userMessage }),
        (chunk: string) => {
          updateLastMessage(chunk);
        },
        (error: string) => {
          console.error('Chat error:', error);
          updateLastMessage(`\n\nError: ${error}`);
        }
      );

      // Clean up subscription when done
      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to start chat:', error);
      updateLastMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">AI Assistant</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-surface text-text-primary'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-bg-surface text-text-primary px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border-primary">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or /skill-name..."
            className="flex-1 px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
            rows={3}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-6 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
