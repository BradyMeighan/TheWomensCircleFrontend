import { useState } from 'react'
import { motion } from 'framer-motion'

interface CreateAccountProps {
  onBackToLogin: () => void
}

function CreateAccount({ onBackToLogin }: CreateAccountProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    invitationCode: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName) newErrors.firstName = 'First name is required'
    if (!formData.lastName) newErrors.lastName = 'Last name is required'
    
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.invitationCode) {
      newErrors.invitationCode = 'Invitation code is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      try {
        // Import the API helper
        const { apiCall } = await import('../config/api')
        
        const response = await apiCall('/api/auth/register', 'POST', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          invitationCode: formData.invitationCode
        })

        if (response.success) {
          setIsSubmitted(true)
        }
      } catch (error: any) {
        console.error('Registration error:', error)
        
        // Set specific field errors based on the error message
        if (error.message.includes('Email already exists')) {
          setErrors({ email: 'This email is already registered' })
        } else if (error.message.includes('Invalid invitation code')) {
          setErrors({ invitationCode: 'Invalid invitation code' })
        } else {
          setErrors({ invitationCode: error.message || 'Registration failed. Please try again.' })
        }
      }
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#ebdfdf] flex items-center justify-center p-4 safe-area-padding">
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
            
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Welcome to the circle!</h1>
            <p className="text-gray-600 mb-8">
              Your account has been created successfully. You can now sign in and start connecting with the community!
            </p>
            
            <button
              onClick={onBackToLogin}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-all"
            >
              Continue to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#ebdfdf] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/icons/pwa-192.png"
              alt="The Women's Circle Logo"
              className="w-16 h-16 mx-auto mb-4 rounded-2xl"
            />
            <h1 className="text-2xl font-semibold text-gray-900">Join the circle</h1>
            <p className="text-gray-600 mt-2">Create your account with an invitation</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invitation Code - highlighted */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <label htmlFor="invitationCode" className="block text-sm font-medium text-purple-900 mb-2">
                Invitation Code *
              </label>
              <input
                id="invitationCode"
                type="text"
                value={formData.invitationCode}
                onChange={(e) => handleInputChange('invitationCode', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${
                  errors.invitationCode ? 'border-red-300 bg-red-50' : 'border-purple-300 bg-white'
                }`}
                placeholder="Enter your invitation code"
                aria-describedby={errors.invitationCode ? 'invitation-error' : undefined}
              />
              {errors.invitationCode && (
                <p id="invitation-error" className="mt-1 text-sm text-red-600">
                  {errors.invitationCode}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                    errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="First name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                    errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Create a password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                  errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
            >
              Create account
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBackToLogin}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default CreateAccount
