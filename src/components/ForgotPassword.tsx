import { useState } from 'react'
import { motion } from 'framer-motion'
import { apiCall } from '../config/api'

interface ForgotPasswordProps {
  onBackToLogin: () => void
}

function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!email) {
      setError('Email is required')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email')
      return
    }

    if (!code) {
      setError('Reset code is required')
      return
    }

    if (!newPassword) {
      setError('New password is required')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Submit password reset
    setIsSubmitting(true)
    
    try {
      const response = await apiCall('/api/auth/reset-password', 'POST', {
        email,
        code: code.toUpperCase().trim(),
        newPassword
      })

      if (response.success) {
        setIsSuccess(true)
      } else {
        setError(response.error || 'Failed to reset password')
      }
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.message || 'Failed to reset password')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-[#ebdfdf] flex items-center justify-center p-4 safe-area-padding">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            {/* Success icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Password Reset Successful!</h1>
            <p className="text-gray-600 mb-8">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            
            <button
              onClick={onBackToLogin}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-all"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#ebdfdf] flex items-center justify-center p-4 safe-area-padding">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/icons/pwa-192.png"
              alt="The Women's Circle Logo"
              className="w-16 h-16 mx-auto mb-4 rounded-2xl"
            />
            <h1 className="text-2xl font-semibold text-gray-900">Reset Your Password</h1>
            <p className="text-gray-600 mt-2">
              Enter the reset code provided by an admin
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Need a reset code?</strong> Contact Mariya to generate a password reset code for your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all"
                placeholder="your.email@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Reset Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all font-mono tracking-wider"
                placeholder="XXXXXXXX"
                maxLength={8}
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the 8-character code provided by an admin
              </p>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter new password"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 6 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all"
                placeholder="Confirm new password"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Resetting password...' : 'Reset Password'}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBackToLogin}
              disabled={isSubmitting}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:text-gray-400"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default ForgotPassword
