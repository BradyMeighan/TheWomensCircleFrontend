// Utility for managing timeouts with automatic cleanup

export const useSafeTimeout = () => {
  const timers: NodeJS.Timeout[] = []

  const safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }

  const clearAllTimeouts = () => {
    timers.forEach(timer => clearTimeout(timer))
    timers.length = 0
  }

  const clearSpecificTimeout = (timer: NodeJS.Timeout) => {
    clearTimeout(timer)
    const index = timers.indexOf(timer)
    if (index > -1) {
      timers.splice(index, 1)
    }
  }

  return { safeSetTimeout, clearAllTimeouts, clearSpecificTimeout }
}

// Hook version for React components
import { useEffect, useRef } from 'react'

export const useSafeTimeoutHook = () => {
  const timersRef = useRef<NodeJS.Timeout[]>([])

  const safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = setTimeout(callback, delay)
    timersRef.current.push(timer)
    return timer
  }

  const clearAllTimeouts = () => {
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current = []
  }

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts()
    }
  }, [])

  return { safeSetTimeout, clearAllTimeouts }
}

