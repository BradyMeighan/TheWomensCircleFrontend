import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AnimatePresence } from 'framer-motion'
import Splash from './components/Splash'
import { notificationService } from './utils/notifications'
import { startTokenRefreshTimer, stopTokenRefreshTimer } from './config/api'
import Login from './components/Login'
import Home from './components/Home'
import ForgotPassword from './components/ForgotPassword'
import CreateAccount from './components/CreateAccount'
import AdminDashboard from './components/AdminDashboard'
import MeetTheCircle from './components/MeetTheCircle'
import ProfileSettings from './components/ProfileSettings'
import PhotoGallery from './components/PhotoGallery'
import Gala from './components/Gala'
import AppSettings from './components/AppSettings'
import Announcements from './components/Announcements'
import Events from './components/Events'
import Chat from './components/Chat'

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

type Screen = 'splash' | 'login' | 'home' | 'forgot-password' | 'create-account' | 'admin-dashboard' | 'meet-the-circle' | 'profile-settings' | 'photo-gallery' | 'gala' | 'app-settings' | 'announcements' | 'events' | 'chat'

interface User {
  _id: string
  username: string
  email: string
  firstName: string
  lastName: string
  isAdmin: boolean
  profile?: {
    profilePicture?: string
  }
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash')
  const [user, setUser] = useState<User | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is remembered and token exists
    const rememberedUser = localStorage.getItem('rememberedUser')
    const authToken = localStorage.getItem('authToken')
    
    if (rememberedUser && authToken) {
      const userData = JSON.parse(rememberedUser)
      setUser(userData)
      
      // Start automatic token refresh
      startTokenRefreshTimer()
      
      // Restore last screen if available (for app switching)
      const lastScreen = sessionStorage.getItem('lastScreen')
      if (lastScreen && lastScreen !== 'splash' && lastScreen !== 'login') {
        setCurrentScreen(lastScreen as Screen)
      } else {
        setCurrentScreen('home')
      }
    }

    // Auto-transition from splash to appropriate screen after animation
    const timer = setTimeout(() => {
      setShowSplash(false)
      if (!rememberedUser || !authToken) {
        setCurrentScreen('login')
      }
    }, 1600) // 1.6s total including exit animation

    return () => clearTimeout(timer)
  }, [])

  // Listen for session expiration events
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent
      const message = customEvent.detail?.message || 'Your session has expired. Please log in again.'
      
      console.log('🔔 Session expired event received:', message)
      
      // Show notification
      setSessionExpiredMessage(message)
      
      // Clear user data and redirect to login
      setTimeout(() => {
        handleLogout()
        setSessionExpiredMessage(null)
      }, 4000) // Show message for 4 seconds
    }

    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent
      const message = customEvent.detail?.message || 'Authentication error'
      
      console.log('🔔 Auth error event received:', message)
      
      // Only log out for critical auth errors, not for every 401
      // The apiCall function will handle retries automatically
    }

    window.addEventListener('auth:session-expired', handleSessionExpired)
    window.addEventListener('auth:error', handleAuthError)

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired)
      window.removeEventListener('auth:error', handleAuthError)
    }
  }, [])

  // Save current screen to sessionStorage whenever it changes (for app switching persistence)
  useEffect(() => {
    if (currentScreen !== 'splash') {
      sessionStorage.setItem('lastScreen', currentScreen)
    }
  }, [currentScreen])

  const handleSplashComplete = () => {
    if (!user) {
      setCurrentScreen('login')
    }
  }

  const handleLogin = async (userData: User) => {
    setUser(userData)
    setCurrentScreen('home')
    
    // Start automatic token refresh
    startTokenRefreshTimer()
    
    // Initialize notifications after login
    try {
      await notificationService.init()
    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('rememberedUser')
    localStorage.removeItem('authToken')
    setCurrentScreen('login')
    
    // Stop automatic token refresh
    stopTokenRefreshTimer()
  }

  const handleForgotPassword = () => {
    setCurrentScreen('forgot-password')
  }

  const handleCreateAccount = () => {
    setCurrentScreen('create-account')
  }

  const handleBackToLogin = () => {
    setCurrentScreen('login')
  }

  const handleAdminDashboard = () => {
    setCurrentScreen('admin-dashboard')
  }

  const handleMeetTheCircle = () => {
    setCurrentScreen('meet-the-circle')
  }

  const handleProfileSettings = () => {
    setCurrentScreen('profile-settings')
  }

  const handlePhotoGallery = () => {
    setCurrentScreen('photo-gallery')
  }

  const handleGala = () => {
    setCurrentScreen('gala')
  }

  const handleAppSettings = () => {
    setCurrentScreen('app-settings')
  }

  const handleAnnouncements = () => {
    setCurrentScreen('announcements')
  }

  const handleEvents = () => {
    setCurrentScreen('events')
  }

  const handleChat = () => {
    setCurrentScreen('chat')
  }

  const handleBackToHome = () => {
    setCurrentScreen('home')
  }

  return (
    <Elements stripe={stripePromise}>
    <div className="min-h-screen bg-[#ebdfdf]">
      {/* Session Expired Notification */}
      {sessionExpiredMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-4">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl max-w-md w-full text-center animate-bounce">
            <div className="text-lg font-semibold mb-1">⚠️ Session Expired</div>
            <div className="text-sm">{sessionExpiredMessage}</div>
          </div>
        </div>
      )}
      
      {showSplash && (
        <Splash onComplete={handleSplashComplete} />
      )}
      <AnimatePresence mode="wait">
        {!showSplash && currentScreen === 'login' && (
          <Login 
            key="login"
            onLogin={handleLogin}
            onForgotPassword={handleForgotPassword}
            onCreateAccount={handleCreateAccount}
          />
        )}
        {!showSplash && currentScreen === 'home' && (
          <Home 
            key="home"
            onLogout={handleLogout}
            onAdminDashboard={handleAdminDashboard}
            onMeetTheCircle={handleMeetTheCircle}
            onProfileSettings={handleProfileSettings}
            onPhotoGallery={handlePhotoGallery}
            onGala={handleGala}
            onAppSettings={handleAppSettings}
            onAnnouncements={handleAnnouncements}
            onEvents={handleEvents}
            onChat={handleChat}
            user={user}
          />
        )}
        {!showSplash && currentScreen === 'forgot-password' && (
          <ForgotPassword key="forgot-password" onBackToLogin={handleBackToLogin} />
        )}
        {!showSplash && currentScreen === 'create-account' && (
          <CreateAccount key="create-account" onBackToLogin={handleBackToLogin} />
        )}
      </AnimatePresence>
      {!showSplash && currentScreen === 'admin-dashboard' && (
        <AdminDashboard 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'meet-the-circle' && (
        <MeetTheCircle 
          onBack={handleBackToHome}
        />
      )}
      {!showSplash && currentScreen === 'profile-settings' && (
        <ProfileSettings 
          onBack={handleBackToHome}
        />
      )}
      {!showSplash && currentScreen === 'photo-gallery' && (
        <PhotoGallery 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'gala' && (
        <Gala 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'app-settings' && (
        <AppSettings 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'announcements' && (
        <Announcements 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'events' && (
        <Events 
          onBack={handleBackToHome}
          user={user}
        />
      )}
      {!showSplash && currentScreen === 'chat' && (
        <Chat 
          onBack={handleBackToHome}
          user={user}
        />
      )}
    </div>
    </Elements>
  )
}

export default App
