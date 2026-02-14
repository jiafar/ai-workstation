import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTerminalStore } from '../../store/terminalStore';

interface TerminalInstanceProps {
  terminalId: string;
  isActive: boolean;
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ terminalId, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create terminal backend
    window.api.terminal.create(terminalId).catch(console.error);

    // Handle data from backend
    const unsubscribe = window.api.terminal.onData(terminalId, (data: string) => {
      terminal.write(data);
    });

    // Handle user input
    terminal.onData((data) => {
      window.api.terminal.write(terminalId, data).catch(console.error);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      window.api.terminal.resize(terminalId, terminal.cols, terminal.rows).catch(console.error);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      terminal.dispose();
      window.api.terminal.destroy(terminalId).catch(console.error);
    };
  }, [terminalId]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 0);
    }
  }, [isActive]);

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
};

export const TerminalPanel: React.FC = () => {
  const { terminals, activeTerminalId, addTerminal, removeTerminal, setActiveTerminal } = useTerminalStore();

  const handleAddTerminal = () => {
    addTerminal();
  };

  const handleCloseTerminal = (e: React.MouseEvent, terminalId: string) => {
    e.stopPropagation();
    removeTerminal(terminalId);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <div className="flex items-center bg-bg-secondary border-b border-border-primary">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`flex items-center px-4 py-2 border-r border-border-primary cursor-pointer hover:bg-bg-surface ${
              terminal.id === activeTerminalId ? 'bg-bg-surface' : ''
            }`}
            onClick={() => setActiveTerminal(terminal.id)}
          >
            <span className="text-text-primary text-sm mr-2">{terminal.name}</span>
            <button
              onClick={(e) => handleCloseTerminal(e, terminal.id)}
              className="ml-2 text-text-muted hover:text-text-primary"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={handleAddTerminal}
          className="px-3 py-2 text-text-primary hover:bg-bg-surface"
          title="New Terminal"
        >
          +
        </button>
      </div>
      <div className="flex-1 relative">
        {terminals.map((terminal) => (
          <TerminalInstance
            key={terminal.id}
            terminalId={terminal.id}
            isActive={terminal.id === activeTerminalId}
          />
        ))}
      </div>
    </div>
  );
};
