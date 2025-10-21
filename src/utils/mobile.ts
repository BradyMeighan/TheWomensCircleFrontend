// Mobile utility functions for better touch handling

export const createMobileButtonHandler = (callback: () => void) => {
  let touchStartTime = 0
  let hasMoved = false

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartTime = Date.now()
    hasMoved = false
    e.stopPropagation()
  }

  const handleTouchMove = () => {
    hasMoved = true
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const touchDuration = Date.now() - touchStartTime
    
    // Only trigger if it was a quick tap (not a long press) and no movement
    if (!hasMoved && touchDuration < 500) {
      callback()
    }
  }

  const handleClick = () => {
    // Prevent double firing on devices that support both touch and mouse
    if (touchStartTime && Date.now() - touchStartTime < 1000) {
      return
    }
    callback()
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onClick: handleClick,
    style: { touchAction: 'manipulation' as const },
    className: 'touch-manipulation'
  }
}

export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export const isIOSDevice = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

export const preventMobileZoom = () => {
  // Prevent pinch zoom on mobile
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  }, { passive: false })

  // Prevent double-tap zoom
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      e.preventDefault()
    }
    lastTouchEnd = now
  }, { passive: false })
}

export const fixMobileKeyboard = () => {
  // Fix iOS keyboard issues
  if (isIOSDevice()) {
    // Force keyboard to show on input focus
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Scroll into view after a short delay
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    })

    // Handle viewport changes when keyboard appears/disappears
    const initialViewportHeight = window.visualViewport?.height || window.innerHeight
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport?.height || window.innerHeight
        const keyboardHeight = initialViewportHeight - currentHeight
        
        if (keyboardHeight > 150) {
          // Keyboard is likely open
          document.body.style.paddingBottom = `${keyboardHeight}px`
        } else {
          // Keyboard is likely closed
          document.body.style.paddingBottom = '0px'
        }
      })
    }
  }
}

// Initialize mobile fixes
export const initMobileFixes = () => {
  if (isMobileDevice()) {
    preventMobileZoom()
    fixMobileKeyboard()
  }
}
