import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ProfileSettingsProps {
  onBack: () => void
  user: { username: string; email?: string; isAdmin?: boolean } | null
}

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  profile: {
    bio?: string
    interests?: string[]
    profilePicture?: string
    location?: string
  }
}

function ProfileSettings({ onBack, user }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    location: '',
    interests: [] as string[]
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall('/api/profile/me', 'GET')
      
      if (response.success) {
        setProfile(response.data)
        setFormData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          bio: response.data.profile?.bio || '',
          location: response.data.profile?.location || '',
          interests: response.data.profile?.interests || []
        })
      } else {
        setError(response.error || 'Failed to fetch profile')
      }
    } catch (err: any) {
      console.error('Profile fetch error:', err)
      setError(err.message || 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      // Validate inputs
      if (!formData.firstName.trim()) {
        setError('First name is required')
        setSaving(false)
        return
      }
      
      if (formData.firstName.length > 50) {
        setError('First name is too long (maximum 50 characters)')
        setSaving(false)
        return
      }
      
      if (!formData.lastName.trim()) {
        setError('Last name is required')
        setSaving(false)
        return
      }
      
      if (formData.lastName.length > 50) {
        setError('Last name is too long (maximum 50 characters)')
        setSaving(false)
        return
      }
      
      if (formData.bio.length > 500) {
        setError('Bio is too long (maximum 500 characters)')
        setSaving(false)
        return
      }
      
      if (formData.location.length > 100) {
        setError('Location is too long (maximum 100 characters)')
        setSaving(false)
        return
      }
      
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall('/api/profile/me', 'PUT', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        profile: {
          bio: formData.bio,
          location: formData.location,
          interests: formData.interests
        }
      })
      
      if (response.success) {
        setProfile(response.data)
        setSuccess('✅ Profile updated successfully!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(response.error || 'Failed to update profile')
      }
    } catch (err: any) {
      console.error('Profile update error:', err)
      
      let errorMsg = 'Failed to update profile'
      
      if (err?.message?.includes('Network error')) {
        errorMsg = 'Network error. Please check your internet connection.'
      } else if (err?.message?.includes('timed out')) {
        errorMsg = 'Request timed out. Please try again.'
      } else if (err?.message) {
        errorMsg = err.message
      }
      
      setError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, GIF, etc.)')
      event.target.value = ''
      return
    }

    // Validate file size (10MB limit for profile pictures)
    if (file.size > 10 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      setError(`Image file is too large (${sizeMB}MB). Maximum file size is 10MB.`)
      event.target.value = ''
      return
    }

    try {
      setUploading(true)
      setError('')
      setSuccess('')

      const { apiCall } = await import('../config/api')
      
      const formData = new FormData()
      formData.append('profilePicture', file)

      const response = await apiCall('/api/profile/upload-picture', 'POST', formData, 60000) // 60 second timeout

      if (response.success) {
        setProfile(response.data.user)
        setSuccess('✅ Profile picture updated!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        let errorMsg = 'Failed to upload image'
        
        if (response.error?.includes('too large') || response.error?.includes('10MB')) {
          errorMsg = 'Image file is too large. Maximum file size is 10MB.'
        } else if (response.error?.includes('format') || response.error?.includes('type')) {
          errorMsg = 'Invalid image format. Please use JPG, PNG, or GIF images.'
        } else if (response.error) {
          errorMsg = response.error
        }
        
        setError(errorMsg)
      }
    } catch (err: any) {
      console.error('Image upload error:', err)
      
      let errorMsg = 'Failed to upload image'
      
      if (err?.message?.includes('Network error')) {
        errorMsg = 'Network error. Please check your internet connection.'
      } else if (err?.message?.includes('timed out')) {
        errorMsg = 'Upload timed out. Please try again with a better connection.'
      } else if (err?.message) {
        errorMsg = err.message
      }
      
      setError(errorMsg)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const addInterest = () => {
    if (formData.interests.length < 10) {
      setFormData({
        ...formData,
        interests: [...formData.interests, '']
      })
    }
  }

  const updateInterest = (index: number, value: string) => {
    const newInterests = [...formData.interests]
    newInterests[index] = value
    setFormData({
      ...formData,
      interests: newInterests
    })
  }

  const removeInterest = (index: number) => {
    setFormData({
      ...formData,
      interests: formData.interests.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ebdfdf] safe-area-padding flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
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
        <div className="flex items-center space-x-3">
          <motion.button
            onClick={onBack}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <h1 className="text-2xl font-bold text-gray-800">Profile Settings</h1>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        className="p-4 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* Error/Success Messages */}
        {error && (
          <motion.div 
            className="bg-red-50 border border-red-200 rounded-xl p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-red-600">{error}</p>
          </motion.div>
        )}
        
        {success && (
          <motion.div 
            className="bg-green-50 border border-green-200 rounded-xl p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-green-600">{success}</p>
          </motion.div>
        )}

        {/* Profile Picture */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          whileHover={{ 
            boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
            transition: { duration: 0.3 }
          }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
          <div className="flex items-start space-x-6">
            <div className="relative">
              {profile?.profile?.profilePicture ? (
                <img
                  src={profile.profile.profilePicture}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-purple-100"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold ring-4 ring-purple-100">
                  {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="profile-picture-upload"
                disabled={uploading}
              />
              <label
                htmlFor="profile-picture-upload"
                className="inline-block px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer text-sm font-medium"
              >
                {uploading ? 'Uploading...' : 'Change Picture'}
              </label>
              <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                JPG, PNG or GIF. Max 10MB.<br/>
                Images are automatically converted to WebP for optimal quality and size.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Basic Info */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          whileHover={{ 
            boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
            transition: { duration: 0.3 }
          }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location ({formData.location.length}/100)</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setFormData({...formData, location: e.target.value})
                  }
                }}
                placeholder="City, State"
                maxLength={100}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio ({formData.bio.length}/500)</label>
              <textarea
                value={formData.bio}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData({...formData, bio: e.target.value})
                  }
                }}
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/500 characters</p>
            </div>
          </div>
        </motion.div>

        {/* Interests */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6"
          whileHover={{ 
            boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
            transition: { duration: 0.3 }
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Interests</h2>
            <button
              onClick={addInterest}
              disabled={formData.interests.length >= 10}
              className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:bg-gray-300"
            >
              Add Interest
            </button>
          </div>
          <div className="space-y-2">
            {formData.interests.map((interest, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => updateInterest(index, e.target.value)}
                  placeholder="Enter an interest..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={() => removeInterest(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {formData.interests.length === 0 && (
              <p className="text-gray-500 text-sm">No interests added yet. Click "Add Interest" to get started!</p>
            )}
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gray-800 text-white p-4 rounded-3xl hover:bg-gray-700 transition-colors font-semibold disabled:bg-gray-400"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

export default ProfileSettings
