// Service Worker for Push Notifications Only
// Keep it simple - no imports, no workbox, pure vanilla JS

const API_BASE_URL = 'https://thewomenscirclebackend-production.up.railway.app'

console.log('📱 Simple Push Service Worker loading...')

// Install event
self.addEventListener('install', (event) => {
  console.log('📱 Push Service Worker installing...')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('📱 Push Service Worker activating...')
  event.waitUntil(self.clients.claim())
})

// Message handler
self.addEventListener('message', (event) => {
  console.log('📱 Service Worker received message:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('📱 Skipping waiting and taking control...')
    self.skipWaiting()
  }
})

// Push event - THE MAIN PURPOSE OF THIS SERVICE WORKER
self.addEventListener('push', (event) => {
  console.log('📱 🚀 PUSH EVENT RECEIVED in service worker:', event)
  
  // Send message to main thread that push was received
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        timestamp: new Date().toISOString()
      })
    })
  })
  
  let data = {}
  let rawData = ''
  
  try {
    if (event.data) {
      rawData = event.data.text()
      console.log('📱 Raw push data:', rawData)
      data = JSON.parse(rawData)
      console.log('📱 Parsed push data:', data)
    } else {
      console.log('📱 No data in push event')
      data = { title: 'New Notification', body: 'You have a new notification' }
    }
  } catch (e) {
    console.error('📱 Error parsing push data:', e, 'Raw data:', rawData)
    data = { title: 'New Notification', body: 'You have a new notification' }
  }

  const options = {
    body: data.body || 'You have a new notification from The Womans Circle',
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    tag: data.tag || 'womans-circle-notification',
    requireInteraction: true,
    data: data.data || {},
    vibrate: [200, 100, 200],
    silent: false
  }

  console.log('📱 Showing notification with options:', options)

  event.waitUntil(
    self.registration.showNotification(data.title || 'The Womans Circle', options)
      .then(() => {
        console.log('📱 ✅ Notification displayed successfully')
        // Send success message to main thread
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_SHOWN',
              title: data.title || 'The Womans Circle',
              timestamp: new Date().toISOString()
            })
          })
        })
      })
      .catch((error) => {
        console.error('📱 ❌ Failed to show notification:', error)
        // Send error message to main thread
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_ERROR',
              error: error.message || 'Unknown error',
              timestamp: new Date().toISOString()
            })
          })
        })
      })
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event)
  
  event.notification.close()

  // Open the app when notification is clicked
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === self.registration.scope && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Otherwise, open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/')
      }
    })
  )
})

console.log('📱 Simple Push Service Worker loaded successfully')