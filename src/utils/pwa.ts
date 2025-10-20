// Utility functions for PWA detection and installation

export const isPWA = (): boolean => {
  // Check if app is running in standalone mode (installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }
  
  // Check for iOS standalone mode
  if ((window.navigator as any).standalone === true) {
    return true
  }
  
  // Check for Android TWA (Trusted Web Activity)
  if (document.referrer.includes('android-app://')) {
    return true
  }
  
  return false
}

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent)
}

export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

export const getIOSVersion = (): number | null => {
  const match = navigator.userAgent.match(/OS (\d+)_?(\d+)?/)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

export const canInstallPWA = (): boolean => {
  // Can't install if already in PWA mode
  if (isPWA()) {
    return false
  }
  
  // iOS Safari can install
  if (isIOS() && isSafari()) {
    return true
  }
  
  // Android browsers with beforeinstallprompt event can install
  if (isAndroid()) {
    return true
  }
  
  // Desktop browsers with beforeinstallprompt can install
  return true
}

export const shouldShowInstallInstructions = (): boolean => {
  // Don't show if already installed
  if (isPWA()) {
    return false
  }
  
  // Show for mobile devices
  if (isIOS() || isAndroid()) {
    return true
  }
  
  // Don't show on desktop
  return false
}

export const hasSeenInstallInstructions = (): boolean => {
  return localStorage.getItem('pwa-install-seen') === 'true'
}

export const markInstallInstructionsSeen = (): void => {
  localStorage.setItem('pwa-install-seen', 'true')
}


