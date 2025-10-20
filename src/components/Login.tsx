import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PWAInstallPrompt from './PWAInstallPrompt'
import { shouldShowInstallInstructions, hasSeenInstallInstructions, markInstallInstructionsSeen } from '../utils/pwa'

interface LoginProps {
  onLogin: (user: { _id: string; username: string; email: string; isAdmin: boolean }) => void
  onForgotPassword: () => void
  onCreateAccount: () => void
}

function Login({ onLogin, onForgotPassword, onCreateAccount }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)  // Auto-checked for better UX
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  // Check if we should show PWA install instructions
  useEffect(() => {
    const shouldShow = shouldShowInstallInstructions() && !hasSeenInstallInstructions()
    if (shouldShow) {
      // Show after a short delay to let the page load
      setTimeout(() => {
        setShowInstallPrompt(true)
      }, 1500)
    }
  }, [])

  const handleDismissInstallPrompt = () => {
    setShowInstallPrompt(false)
    markInstallInstructionsSeen()
  }

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    
    if (!email) {
      newErrors.email = 'Email is required'
    }
    
    if (!password) {
      newErrors.password = 'Password is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      try {
        // Import the API helper
        const { apiCall, startTokenRefreshTimer } = await import('../config/api')
        
        const response = await apiCall('/api/auth/login', 'POST', {
          email: email,
          password: password
        })

        if (response.success) {
          const userData = {
            _id: response.data.user._id,
            username: response.data.user.firstName + ' ' + response.data.user.lastName,
            email: response.data.user.email,
            isAdmin: response.data.user.isAdmin
          }

          // Store auth token
          localStorage.setItem('authToken', response.data.token)
          
          // Store user data if remember me is checked
          if (rememberMe) {
            localStorage.setItem('rememberedUser', JSON.stringify(userData))
          }

          // Start automatic token refresh
          startTokenRefreshTimer()

          onLogin(userData)
        }
      } catch (error: any) {
        console.error('Login error:', error)
        setErrors({ 
          email: error.message || 'Login failed. Please check your credentials.',
          password: '' 
        })
      }
    }
  }

  const [installPrompt, setInstallPrompt] = useState<any>(null)

  // Handle PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setInstallPrompt(e)
  })

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt()
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('PWA installed')
        }
        setInstallPrompt(null)
      })
    }
  }

  return (
    <motion.div 
      className="min-h-screen bg-[#ebdfdf] flex items-center justify-center p-4 safe-area-padding"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div 
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Install prompt button */}
        {installPrompt && (
          <div className="mb-4 text-center">
            <button
              onClick={handleInstall}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Install W App
            </button>
          </div>
        )}

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/icons/pwa-192.png"
              alt="The Women's Circle Logo"
              className="w-16 h-16 mx-auto mb-4 rounded-2xl"
            />
            <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter your email address"
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember me checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
            >
              Sign in
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Forgot password?
            </button>
            <div className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onCreateAccount}
                className="text-gray-900 hover:underline font-medium"
              >
                Create account
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PWA Install Prompt */}
      {showInstallPrompt && <PWAInstallPrompt onDismiss={handleDismissInstallPrompt} />}
    </motion.div>
  )
}

export default Login
