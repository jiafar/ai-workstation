import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook to safely use Electron IPC with automatic cleanup
 * Prevents memory leaks from event listeners
 */
export function useElectronAPI() {
  const cleanupFns = useRef<Array<() => void>>([])

  /**
   * Register an event listener that will be automatically cleaned up
   */
  const on = useCallback(
    <T>(
      registerFn: (callback: (data: T) => void) => () => void,
      callback: (data: T) => void
    ) => {
      const cleanup = registerFn(callback)
      cleanupFns.current.push(cleanup)
      return cleanup
    },
    []
  )

  /**
   * Register a one-time event listener
   */
  const once = useCallback(
    <T>(
      registerFn: (callback: (data: T) => void) => () => void,
      callback: (data: T) => void
    ) => {
      let cleanup: (() => void) | null = null

      const wrappedCallback = (data: T) => {
        callback(data)
        if (cleanup) {
          cleanup()
          cleanupFns.current = cleanupFns.current.filter((fn) => fn !== cleanup)
        }
      }

      cleanup = registerFn(wrappedCallback)
      cleanupFns.current.push(cleanup)
    },
    []
  )

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      cleanupFns.current.forEach((cleanup) => cleanup())
      cleanupFns.current = []
    }
  }, [])

  return { on, once }
}

/**
 * Hook for terminal output with automatic cleanup
 */
export function useTerminalOutput(
  terminalId: string,
  onData: (data: string) => void,
  onExit?: (code: number) => void
) {

  useEffect(() => {
    if (!terminalId) return

    const cleanupData = window.api.terminal.onData((id: string, data: string) => {
      if (id === terminalId) onData(data)
    })

    let cleanupExit: (() => void) | undefined
    if (onExit) {
      cleanupExit = window.api.terminal.onExit((id: string, code: number) => {
        if (id === terminalId) onExit(code)
      })
    }

    return () => {
      cleanupData()
      cleanupExit?.()
    }
  }, [terminalId, onData, onExit])
}

/**
 * Hook for AI stream with automatic cleanup.
 * Uses requestId correlation to prevent concurrent stream mixing.
 */
export function useAIStream(
  onChunk: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) {
  const cleanupRef = useRef<Array<() => void>>([])

  const startStream = useCallback(
    async (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => {
      // Clean up any previous listeners
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []

      // Start the stream — returns requestId
      const requestId = await window.api.ai.chatStream(messages, options)

      // Listen for chunks filtered by requestId
      const cleanupChunk = window.api.ai.onStreamChunk((rid: string, chunk: string) => {
        if (rid === requestId) {
          onChunk(chunk)
        }
      })
      cleanupRef.current.push(cleanupChunk)

      // Listen for completion filtered by requestId
      const cleanupEnd = window.api.ai.onStreamEnd((rid: string) => {
        if (rid === requestId) {
          onComplete?.()
        }
      })
      cleanupRef.current.push(cleanupEnd)

      // Listen for errors filtered by requestId
      const cleanupErr = window.api.ai.onStreamError((rid: string, error: string) => {
        if (rid === requestId) {
          onError?.(error)
        }
      })
      cleanupRef.current.push(cleanupErr)

      return () => {
        cleanupRef.current.forEach((fn) => fn())
        cleanupRef.current = []
      }
    },
    [onChunk, onComplete, onError]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
    }
  }, [])

  return { startStream }
}

/**
 * Hook for skill progress with automatic cleanup
 */
export function useSkillProgress(
  onProgress: (data: { skillName: string; progress: number; message: string }) => void
) {
  const { on } = useElectronAPI()

  useEffect(() => {
    const cleanup = on(window.api.skill.onProgress, onProgress)
    return cleanup
  }, [onProgress, on])
}

/**
 * Hook for workflow events with automatic cleanup
 */
export function useWorkflowEvents(
  onStepComplete?: (data: unknown) => void,
  onDone?: (data: unknown) => void
) {
  const { on } = useElectronAPI()

  useEffect(() => {
    const cleanups: Array<() => void> = []

    if (onStepComplete) {
      cleanups.push(on(window.api.workflow.onStepComplete, onStepComplete))
    }

    if (onDone) {
      cleanups.push(on(window.api.workflow.onDone, onDone))
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [onStepComplete, onDone, on])
}

export default useElectronAPI
