// Push Notification Utilities

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://thewomenscirclebackend-production.up.railway.app'

// VAPID public key - real generated key
const VAPID_PUBLIC_KEY = 'BIlEt9wAfXgF9xgbtBNPocX6v1slhKMWi9r7_Zzbr22ZCBm7poA-t3-V9xPUkAlxV3-pQfVcndsIBbMBBFceEQg'

export interface NotificationPayload {
  title: string
  body: string
  type: 'announcement' | 'event' | 'gallery' | 'general'
  data?: any
}

class NotificationService {
  private static instance: NotificationService
  private swRegistration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  // Initialize service worker and notifications
  async init(): Promise<boolean> {
    console.log('📱 🚀 ENTERING init() method...')
    try {
      console.log('📱 🚀 Inside try block...')
      
      // Debug VAPID key
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY
      console.log('📱 VAPID Public Key length:', vapidKey.length)
      console.log('📱 VAPID Key (first 20 chars):', vapidKey.substring(0, 20) + '...')
      
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('📱 Service Workers not supported')
        return false
      }

      // Check if push notifications are supported
      if (!('PushManager' in window)) {
        console.warn('📱 Push Notifications not supported')
        return false
      }

      // Register our custom service worker for push notifications
      console.log('📱 Attempting to register push notification service worker...')
      
      try {
        // Simple approach: just register our service worker
        console.log('📱 Registering push service worker...')
        this.swRegistration = await navigator.serviceWorker.register('/sw.js')
        
        console.log('📱 Service worker registered successfully')
        
        // Wait for it to be ready
        await navigator.serviceWorker.ready
        
        console.log('📱 Service worker is ready!')
        
      } catch (swError) {
        console.error('📱 Service worker registration failed:', swError)
        throw swError
      }
      
      console.log('📱 Final service worker state:', {
        scope: this.swRegistration.scope,
        state: this.swRegistration.active?.state
      })
      
      // Check if pushManager is available
      if (!this.swRegistration.pushManager) {
        throw new Error('Push manager not available on service worker')
      }
      
      console.log('📱 Push manager available on service worker')

      return true
    } catch (error) {
      console.error('📱 Service Worker registration failed:', error)
      return false
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('📱 Notifications not supported')
      return 'denied'
    }

    let permission = Notification.permission

    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    console.log('📱 Notification permission:', permission)
    return permission
  }

  // Subscribe to push notifications
  async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.swRegistration) {
        throw new Error('Service Worker not registered')
      }

      console.log('📱 Starting subscription process...')
      console.log('📱 Service worker registration state:', {
        scope: this.swRegistration.scope,
        activeState: this.swRegistration.active?.state,
        pushManagerAvailable: !!this.swRegistration.pushManager
      })

      console.log('📱 Checking existing subscription...')
      // Check if already subscribed
      this.subscription = await this.swRegistration.pushManager.getSubscription()
      
      if (this.subscription) {
        console.log('📱 Found existing subscription:', {
          endpoint: this.subscription.endpoint ? 'EXISTS' : 'MISSING',
          hasKeys: !!this.subscription.getKey
        })
        console.log('📱 Ensuring backend has subscription...')
        // Even if browser is subscribed, make sure backend has the subscription
        await this.sendSubscriptionToBackend(this.subscription)
        return this.subscription
      }

      console.log('📱 No existing subscription found, creating new one...')
      console.log('📱 VAPID key being used:', {
        length: VAPID_PUBLIC_KEY.length,
        firstChars: VAPID_PUBLIC_KEY.substring(0, 20) + '...'
      })
      
      // Subscribe to push notifications
      console.log('📱 Calling pushManager.subscribe...')
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY
      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      })
      
      console.log('📱 New subscription created successfully:', {
        endpoint: this.subscription.endpoint ? 'EXISTS' : 'MISSING',
        hasKeys: !!this.subscription.getKey
      })

      console.log('📱 Subscribed to push notifications:', this.subscription)

      // Send subscription to backend
      await this.sendSubscriptionToBackend(this.subscription)

      return this.subscription
    } catch (error) {
      console.error('📱 Failed to subscribe to push notifications:', error)
      
      // Log mobile-specific error details
      if (error instanceof Error) {
        console.error('📱 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
          isStandalone: window.matchMedia('(display-mode: standalone)').matches
        })
      }
      
      return null
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true
      }

      await this.subscription.unsubscribe()
      this.subscription = null

      // Remove subscription from backend
      await this.removeSubscriptionFromBackend()

      console.log('📱 Unsubscribed from push notifications')
      return true
    } catch (error) {
      console.error('📱 Failed to unsubscribe from push notifications:', error)
      return false
    }
  }

  // Get current subscription status
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      return null
    }

    this.subscription = await this.swRegistration.pushManager.getSubscription()
    return this.subscription
  }

  // Send subscription to backend
  private async sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
    try {
      console.log('📱 Starting backend subscription process...')
      
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.error('📱 No authentication token found in localStorage')
        throw new Error('No authentication token')
      }
      
      console.log('📱 Auth token found, preparing subscription data...')
      
      const subscriptionData = subscription.toJSON()
      console.log('📱 Subscription data prepared:', {
        hasEndpoint: !!subscriptionData.endpoint,
        hasKeys: !!subscriptionData.keys,
        keysAuth: !!subscriptionData.keys?.auth,
        keysP256dh: !!subscriptionData.keys?.p256dh
      })

      console.log('📱 Making request to backend...')
      const response = await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscriptionData
        })
      })
      
      console.log('📱 Backend response received:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('📱 Backend subscription error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Failed to send subscription to backend: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      console.log('📱 Subscription sent to backend successfully:', result)
    } catch (error) {
      console.error('📱 Failed to send subscription to backend:', error)
      throw error
    }
  }

  // Remove subscription from backend
  private async removeSubscriptionFromBackend(): Promise<void> {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        return // No token, nothing to remove
      }

      const response = await fetch(`${API_BASE_URL}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        console.warn('📱 Failed to remove subscription from backend')
      }

      console.log('📱 Subscription removed from backend')
    } catch (error) {
      console.error('📱 Failed to remove subscription from backend:', error)
    }
  }

  // Show local notification (fallback for testing)
  showLocalNotification(payload: NotificationPayload): void {
    if (Notification.permission === 'granted') {
      console.log('📱 Creating local notification:', payload)
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: '/icons/pwa-192.png',
        badge: '/icons/pwa-192.png',
        tag: 'womans-circle',
        requireInteraction: true
      })
      
      notification.onclick = () => {
        console.log('📱 Local notification clicked')
        notification.close()
        window.focus()
      }
      
      console.log('📱 Local notification created successfully')
    } else {
      console.error('📱 Cannot show local notification: permission not granted')
    }
  }

  // Utility function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()

// Notification types for different actions
export const NotificationTypes = {
  ANNOUNCEMENT: 'announcement' as const,
  EVENT: 'event' as const,
  GALLERY: 'gallery' as const,
  GENERAL: 'general' as const
}
