import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { notificationService } from '../utils/notifications'
import { useSafeTimeoutHook } from '../utils/timeout'
import { apiCall } from '../config/api'

interface AppSettingsProps {
  onBack: () => void
  user: { username: string; email?: string; isAdmin?: boolean } | null
}

interface AppSettings {
  notifications: {
    enabled: boolean
    announcements: boolean
    events: boolean
    gallery: boolean
    replies: boolean
    directMessages: boolean
  }
  preferences: {
    announcements: boolean
    events: boolean
    gallery: boolean
    replies: boolean
    directMessages: boolean
  }
}

const defaultSettings: AppSettings = {
  notifications: {
    enabled: false,
    announcements: true,
    events: true,
    gallery: true,
    replies: true,
    directMessages: true
  },
  preferences: {
    announcements: true,
    events: true,
    gallery: true,
    replies: true,
    directMessages: true
  }
}

function AppSettings({ onBack, user }: AppSettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [pushEventLogs, setPushEventLogs] = useState<string[]>([])
  const [showPushDebug, setShowPushDebug] = useState(false)
  
  // Safe timeout management to prevent memory leaks
  const { safeSetTimeout } = useSafeTimeoutHook()

  // Debug logger that shows on UI
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `${timestamp}: ${message}`
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 9)]) // Keep last 10 logs
    console.log(message) // Also log to console
  }

  // Push event logger
  const addPushLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `${timestamp}: ${message}`
    console.log('PUSH: ' + logEntry)
    setPushEventLogs(prev => [logEntry, ...prev.slice(0, 9)]) // Keep last 10 push logs
  }

  useEffect(() => {
    // Listen for service worker messages about push events
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        addPushLog(`📱 Push received: ${event.data.title || 'No title'}`)
      } else if (event.data && event.data.type === 'NOTIFICATION_SHOWN') {
        addPushLog(`✅ Notification shown: ${event.data.title || 'No title'}`)
      } else if (event.data && event.data.type === 'NOTIFICATION_ERROR') {
        addPushLog(`❌ Notification error: ${event.data.error}`)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return
      
      try {
        // Load settings from server
        const response = await apiCall('/api/settings/app', 'GET')
        if (response.success) {
          const serverSettings = response.data
          console.log('Loaded server settings:', serverSettings)
          // Merge with defaults to ensure all properties exist
          const mergedSettings = {
            notifications: { ...defaultSettings.notifications, ...serverSettings.notifications },
            preferences: { ...defaultSettings.preferences, ...serverSettings.preferences }
          }
          setSettings(mergedSettings)
        }
      } catch (error) {
        console.error('Failed to load server settings, using defaults:', error)
        // Fallback to localStorage for now
        const savedSettings = localStorage.getItem(`app_settings_${user?.username}`)
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings)
            // Merge with defaults to ensure all properties exist
            const mergedSettings = {
              notifications: { ...defaultSettings.notifications, ...parsed.notifications },
              preferences: { ...defaultSettings.preferences, ...parsed.preferences }
            }
            setSettings(mergedSettings)
          } catch (error) {
            console.error('Failed to parse saved settings:', error)
          }
        }
      }
    }

    loadSettings()
    // Initialize notification service and check permission
    initializeNotifications()
  }, [user])



  const saveSettings = async () => {
    setSaving(true)
    try {
      // Save to server
      const response = await apiCall('/api/settings/app', 'PUT', settings)
      if (response.success) {
        // Also save to localStorage as backup
        localStorage.setItem(`app_settings_${user?.username}`, JSON.stringify(settings))
        
        setSuccess('Settings saved successfully!')
        safeSetTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Failed to save settings to server')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      // Fallback to localStorage
      localStorage.setItem(`app_settings_${user?.username}`, JSON.stringify(settings))
      setSuccess('Settings saved locally!')
      safeSetTimeout(() => setSuccess(''), 3000)
    } finally {
      setSaving(false)
    }
  }


  const initializeNotifications = async () => {
    try {
      // Initialize notification service
      await notificationService.init()
      
      // Check current permission without requesting
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission)
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
  }

  const requestNotificationPermission = async () => {
    try {
      addDebugLog('🔔 Requesting notification permission...')
      
      const deviceInfo = {
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        serviceWorkerSupport: 'serviceWorker' in navigator,
        pushManagerSupport: 'PushManager' in window,
        notificationSupport: 'Notification' in window
      }
      addDebugLog(`📱 Device: Mobile=${deviceInfo.isMobile}, Standalone=${deviceInfo.isStandalone}`)
      
      // Add comprehensive browser and device info for debugging
      addDebugLog(`🌐 Browser Details:`)
      addDebugLog(`  User Agent: ${navigator.userAgent}`)
      addDebugLog(`  Platform: ${navigator.platform}`)
      addDebugLog(`  Language: ${navigator.language}`)
      addDebugLog(`  Online: ${navigator.onLine}`)
      addDebugLog(`  SW Support: ${deviceInfo.serviceWorkerSupport}`)
      addDebugLog(`  Push Support: ${deviceInfo.pushManagerSupport}`)
      addDebugLog(`  Notification Support: ${deviceInfo.notificationSupport}`)
      
      const permission = await notificationService.requestPermission()
      addDebugLog(`✅ Permission result: ${permission}`)
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        addDebugLog('🔐 Permission granted, starting subscription...')
        
        // Check for iOS Safari specific requirements with multiple detection methods
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone === true ||
                            window.location.search.includes('homescreen=1')
        
        addDebugLog(`🍎 iOS Detection: isIOS=${isIOS}, isStandalone=${isStandalone}`)
        addDebugLog(`🍎 Display mode: ${window.matchMedia('(display-mode: standalone)').matches}`)
        addDebugLog(`🍎 Navigator standalone: ${(window.navigator as any).standalone}`)
        
        // TEMPORARILY DISABLED - Skip iOS standalone check for testing
        // if (isIOS && !isStandalone) {
        //   addDebugLog('🍎 iOS Safari detected - needs PWA installation')
        //   alert('On iOS, please "Add to Home Screen" first, then enable notifications from within the installed app.')
        //   return
        // }
        
        addDebugLog('🔧 Proceeding with notification setup (iOS check bypassed for testing)')
        
        // Make sure service worker is initialized first
        addDebugLog('🔧 Initializing service worker...')
        try {
          addDebugLog('🔧 About to call notificationService.init()...')
          
          // Add timeout to catch hanging init
          const initPromise = notificationService.init()
          const timeoutPromise = new Promise((_, reject) => 
            safeSetTimeout(() => reject(new Error('Init timeout after 10 seconds')), 10000)
          )
          
          addDebugLog('🔧 Calling notificationService.init() with timeout...')
          const initSuccess = await Promise.race([initPromise, timeoutPromise])
          addDebugLog(`🔧 Init completed with result: ${initSuccess}`)
          
          if (!initSuccess) {
            addDebugLog('❌ Service worker initialization failed')
            return
          }
          addDebugLog('✅ Service worker ready')
        } catch (error) {
          addDebugLog(`❌ Service worker init error: ${error instanceof Error ? error.message : error}`)
          addDebugLog(`❌ Error stack: ${error instanceof Error ? error.stack : 'No stack'}`)
          return
        }
        
        // Subscribe to push notifications
        addDebugLog('📡 Creating subscription...')
        let subscription = null
        try {
          addDebugLog('📡 Calling notificationService.subscribe()...')
          subscription = await notificationService.subscribe()
          addDebugLog(`📡 Subscription result: ${subscription ? 'SUCCESS' : 'FAILED'}`)
          addDebugLog(`📡 Subscription type: ${typeof subscription}`)
          
          if (subscription) {
            addDebugLog('🎯 Subscription object created successfully')
            addDebugLog(`🎯 Subscription endpoint: ${subscription.endpoint ? 'EXISTS' : 'MISSING'}`)
          } else {
            addDebugLog('❌ No subscription object returned')
          }
        } catch (error) {
          addDebugLog(`❌ Subscription error: ${error instanceof Error ? error.message : error}`)
          addDebugLog(`❌ Subscription error stack: ${error instanceof Error ? error.stack : 'No stack'}`)
        }
        
        if (subscription) {
          console.log('Successfully subscribed to push notifications')
          
          setSettings(prev => ({
            ...prev,
            notifications: { ...prev.notifications, enabled: true }
          }))
          
          // Show test notification
          notificationService.showLocalNotification({
            title: 'The Women\'s Circle',
            body: 'Notifications are now enabled!',
            type: 'general'
          })
        } else {
          console.error('Failed to subscribe to push notifications - no subscription returned')
          
          // Try to get more details about why subscription failed
          console.log('📱 Debugging subscription failure...')
          try {
            const swReady = await navigator.serviceWorker.ready
            console.log('📱 Service worker state:', {
              swRegistration: !!window.navigator.serviceWorker,
              swReady: !!swReady,
              pushManager: !!swReady.pushManager
            })
          } catch (err) {
            console.log('📱 Could not get service worker state:', err)
          }
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      
      // Add mobile-specific debugging
      if (error instanceof Error) {
        console.error('Permission error details:', {
          name: error.name,
          message: error.message,
          isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
          isStandalone: window.matchMedia('(display-mode: standalone)').matches
        })
      }
    }
  }

  const testNotification = async () => {
    try {
      console.log('Sending test notification...')
      // Try to send a test notification through the service
      notificationService.showLocalNotification({
        title: 'Test Notification',
        body: 'Push notifications are working correctly!',
        type: 'general'
      })
      console.log('Test notification sent successfully')
    } catch (error) {
      console.error('Failed to send test notification:', error)
      alert('Failed to send test notification. Check browser console for details.')
    }
  }

  const resetNotifications = async () => {
    try {
      // Unsubscribe from push notifications
      await notificationService.unsubscribe()
      
      // Reset permission state
      setNotificationPermission('default')
      
      // Update settings
      setSettings(prev => ({
        ...prev,
        notifications: { ...prev.notifications, enabled: false }
      }))
      
      alert('Notifications reset! You can now re-enable them to test the full flow.')
    } catch (error) {
      console.error('Failed to reset notifications:', error)
      alert('Failed to reset notifications. You may need to clear browser data manually.')
    }
  }

  const updateSetting = (category: keyof AppSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  return (
    <motion.div 
      className="min-h-screen bg-[#ebdfdf] safe-area-padding"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <motion.div 
        className="px-4 pt-6 pb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={onBack}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6 text-gray-700 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <h1 className="text-3xl font-bold text-gray-800 ">App Settings</h1>
          </div>
          
          <motion.button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </motion.button>
        </div>
      </motion.div>

      {/* Success Message */}
      {success && (
        <motion.div
          className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <p className="text-green-600 text-sm">{success}</p>
        </motion.div>
      )}

      {/* Settings Sections */}
      <div className="px-4 pb-6 space-y-6">

        {/* Notification Settings */}
        <motion.div 
          className="bg-white  rounded-3xl border-2 border-gray-800  p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-gray-900  mb-4">Notifications</h2>
          <div className="space-y-4">
            {/* Enable Notifications */}
            <div className="flex items-center justify-between p-4 bg-gray-50  rounded-xl">
              <div>
                <h3 className="font-medium text-gray-900 ">Push Notifications</h3>
                <p className="text-sm text-gray-600 ">
                  {notificationPermission === 'granted' 
                    ? 'Notifications are enabled' 
                    : notificationPermission === 'denied'
                    ? 'Notifications are blocked'
                    : 'Enable notifications to stay updated'}
                </p>
              </div>
              {notificationPermission !== 'granted' ? (
                <button
                  onClick={requestNotificationPermission}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                  Enable
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <button
                    onClick={testNotification}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                  >
                    Test
                  </button>
                  <button
                    onClick={resetNotifications}
                    className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

          </div>
        </motion.div>


        {/* Notification Preferences */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Types</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Choose which types of activities you want to receive push notifications for.
            </p>
            
            {settings.preferences && Object.entries(settings.preferences)
              .filter(([key]) => ['announcements', 'events', 'gallery', 'replies', 'directMessages'].includes(key))
              .map(([key, value]) => {
              const labels: Record<string, string> = {
                announcements: 'Announcements',
                events: 'Events',
                gallery: 'Photo Gallery',
                replies: 'Replies to My Messages',
                directMessages: 'Direct Messages'
              }
              
              return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {labels[key] || key}
                </span>
                <button
                  onClick={() => updateSetting('preferences', key, !value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    value ? 'bg-gray-800' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}) || null}
          </div>
        </motion.div>


        {/* Debug Panel */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Debug Console</h2>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 py-1 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              {showDebug ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showDebug && (
            <div className="space-y-2">
              <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                {debugLogs.length === 0 ? (
                  <p className="text-gray-500">No debug logs yet...</p>
                ) : (
                  debugLogs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
              <button
                onClick={() => setDebugLogs([])}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Clear Logs
              </button>
            </div>
          )}
        </motion.div>

        {/* App Info */}
        <motion.div 
          className="bg-white  rounded-3xl border-2 border-gray-800  p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-gray-900  mb-4">About</h2>
          <div className="space-y-2 text-sm text-gray-600 ">
            <p>Version: 1.0.0</p>
            <p>Build: PWA-2024.09</p>
            <p>© 2024 The Women's Circle</p>
          </div>
        </motion.div>

        {/* Push Event Monitor */}
        <motion.div
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Push Event Monitor</h2>
            <button
              onClick={() => setShowPushDebug(!showPushDebug)}
              className="px-3 py-1 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors"
            >
              {showPushDebug ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showPushDebug && (
            <div className="space-y-2">
              <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                {pushEventLogs.length === 0 ? (
                  <p className="text-orange-600">🔍 No push events detected yet. Send a custom notification from admin panel to test.</p>
                ) : (
                  pushEventLogs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
              <button
                onClick={() => setPushEventLogs([])}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
              >
                Clear Push Logs
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default AppSettings
