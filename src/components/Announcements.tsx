import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnnouncementsProps {
  onBack: () => void
  user: { _id: string; username: string; email: string; isAdmin: boolean } | null
}

interface Announcement {
  _id: string
  title: string
  content: string
  author: {
    firstName: string
    lastName: string
  }
  priority: 'low' | 'normal' | 'high' | 'urgent'
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

function Announcements({ onBack, user }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal' as const,
    isPinned: false
  })
  const [scrollY, setScrollY] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [touchIndicators, setTouchIndicators] = useState<Array<{id: number, x: number, y: number}>>([])
  
  // Show debug mode only when modal is open (admin only)
  const showDebugMode = (showCreateModal || showEditModal) && user?.isAdmin

  useEffect(() => {
    fetchAnnouncements()
    
    // Restore form state from sessionStorage
    const savedFormState = sessionStorage.getItem('announcementsFormState')
    if (savedFormState) {
      try {
        const parsed = JSON.parse(savedFormState)
        setShowCreateModal(parsed.showCreateModal || false)
        setNewAnnouncement(parsed.newAnnouncement || { title: '', content: '', priority: 'normal', isPinned: false })
      } catch (error) {
        console.error('Failed to restore announcements form state:', error)
      }
    }
  }, [])

  // Save form state to sessionStorage whenever it changes
  useEffect(() => {
    const formState = {
      showCreateModal,
      newAnnouncement
    }
    sessionStorage.setItem('announcementsFormState', JSON.stringify(formState))
  }, [showCreateModal, newAnnouncement])

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Touch visualization for debugging
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      if (!showDebugMode) return
      
      Array.from(e.touches).forEach((touch) => {
        const id = Date.now() + Math.random()
        const indicator = {
          id,
          x: touch.clientX,
          y: touch.clientY
        }
        
        setTouchIndicators(prev => [...prev, indicator])
        
        // Vibrate for haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(10)
        }
        
        // Remove indicator after animation
        setTimeout(() => {
          setTouchIndicators(prev => prev.filter(i => i.id !== id))
        }, 1000)
      })
    }
    
    document.addEventListener('touchstart', handleTouch, { passive: true })
    return () => document.removeEventListener('touchstart', handleTouch)
  }, [showDebugMode])

  const fetchAnnouncements = async () => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/announcements')
      
      if (response.success) {
        setAnnouncements(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const createAnnouncement = async () => {
    // Clear any previous errors
    setErrorMessage('')
    
    // Validate inputs
    if (!newAnnouncement.title.trim()) {
      setErrorMessage('Please enter a title for your announcement')
      return
    }
    
    if (newAnnouncement.title.length > 200) {
      setErrorMessage('Title is too long (maximum 200 characters)')
      return
    }
    
    if (!newAnnouncement.content.trim()) {
      setErrorMessage('Please enter content for your announcement')
      return
    }
    
    if (newAnnouncement.content.length > 2000) {
      setErrorMessage('Content is too long (maximum 2000 characters)')
      return
    }
    
    // Prevent double-clicks
    if (isCreating) {
      console.log('⚠️ Already creating, ignoring duplicate click')
      return
    }
    
    setIsCreating(true)
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/announcements', 'POST', newAnnouncement)
      
      if (response.success) {
        setAnnouncements([response.data, ...announcements])
        setShowCreateModal(false)
        setNewAnnouncement({ title: '', content: '', priority: 'normal', isPinned: false })
        setErrorMessage('')
        // Clear saved form state after successful submission
        sessionStorage.removeItem('announcementsFormState')
        alert('✅ Announcement created successfully!')
      }
    } catch (error: any) {
      console.error('Failed to create announcement:', error)
      const errorMsg = error?.message || 'Failed to create announcement. Please try again.'
      setErrorMessage(errorMsg)
      alert(`Failed to create announcement: ${errorMsg}`)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/announcements/${announcementId}`, 'DELETE')
      
      if (response.success) {
        setAnnouncements(announcements.filter(a => a._id !== announcementId))
      }
    } catch (error) {
      console.error('Failed to delete announcement:', error)
    }
  }

  const editAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setNewAnnouncement({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isPinned: announcement.isPinned
    })
    setShowEditModal(true)
  }

  const updateAnnouncement = async () => {
    if (!editingAnnouncement) return
    
    // Clear any previous errors
    setErrorMessage('')
    
    // Validate inputs
    if (!newAnnouncement.title.trim()) {
      setErrorMessage('Please enter a title for your announcement')
      return
    }
    
    if (newAnnouncement.title.length > 200) {
      setErrorMessage('Title is too long (maximum 200 characters)')
      return
    }
    
    if (!newAnnouncement.content.trim()) {
      setErrorMessage('Please enter content for your announcement')
      return
    }
    
    if (newAnnouncement.content.length > 2000) {
      setErrorMessage('Content is too long (maximum 2000 characters)')
      return
    }
    
    // Prevent double-clicks
    if (isCreating) {
      console.log('⚠️ Already updating, ignoring duplicate click')
      return
    }
    
    setIsCreating(true)
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/announcements/${editingAnnouncement._id}`, 'PUT', newAnnouncement)
      
      if (response.success) {
        setAnnouncements(announcements.map(a => 
          a._id === editingAnnouncement._id ? response.data : a
        ))
        setShowEditModal(false)
        setEditingAnnouncement(null)
        setNewAnnouncement({ title: '', content: '', priority: 'normal', isPinned: false })
        setErrorMessage('')
        alert('✅ Announcement updated successfully!')
      }
    } catch (error: any) {
      console.error('Failed to update announcement:', error)
      const errorMsg = error?.message || 'Failed to update announcement. Please try again.'
      setErrorMessage(errorMsg)
      alert(`Failed to update announcement: ${errorMsg}`)
    } finally {
      setIsCreating(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-600 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-600 border-orange-200'
      case 'normal': return 'bg-blue-100 text-blue-600 border-blue-200'
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  if (loading) {
    return (
      <motion.div 
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', opacity: 0.4 }} />
        <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 relative z-10"></div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="min-h-screen relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Touch Debug Indicators */}
      {touchIndicators.map(indicator => (
        <div
          key={indicator.id}
          style={{
            position: 'fixed',
            left: indicator.x - 30,
            top: indicator.y - 30,
            width: '60px',
            height: '60px',
            border: '4px solid red',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 99999,
            animation: 'touchPulse 1s ease-out forwards',
            background: 'rgba(255, 0, 0, 0.2)'
          }}
        />
      ))}
      
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', transform: `translateY(${scrollY * 0.5}px)`, opacity: 0.4 }} />
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      <div className="relative z-10">
      {/* Header */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          </div>
          
          {user?.isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center space-x-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Post</span>
              <span className="sm:hidden">+</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {announcements.length === 0 ? (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No announcements yet</h3>
            <p className="text-gray-600 text-sm">Check back later for updates from the circle!</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <motion.div
                key={announcement._id}
                className={`bg-white rounded-3xl border-2 border-gray-800 overflow-hidden ${
                  announcement.isPinned ? 'ring-2 ring-purple-300' : ''
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {announcement.isPinned && (
                          <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4a1 1 0 00-1-1H9a1 1 0 00-1 1v8H7a1 1 0 00-1 1v2a1 1 0 001 1h3v5a1 1 0 001 1h2a1 1 0 001-1v-5h3a1 1 0 001-1v-2a1 1 0 00-1-1h-1z"/>
                          </svg>
                        )}
                      <h3 className="text-xl font-semibold text-gray-900">{announcement.title}</h3>
                    </div>
                    <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                  </div>
                    
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getPriorityColor(announcement.priority)}`}>
                      {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{announcement.author.firstName} {announcement.author.lastName}</span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                      {user?.isAdmin && (
                        <>
                          <button
                            onClick={() => editAnnouncement(announcement)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit announcement"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteAnnouncement(announcement._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete announcement"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowCreateModal(false)
              setErrorMessage('')
            }}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-2xl w-full my-auto"
              style={{
                maxHeight: 'calc(100dvh - 100px)',
                pointerEvents: 'auto'
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Create New Announcement</h3>
                
                {/* Error Message */}
                {errorMessage && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-700">{errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title ({newAnnouncement.title.length}/200)
                    </label>
                    <input
                      type="text"
                      value={newAnnouncement.title}
                      onChange={(e) => {
                        if (e.target.value.length <= 200) {
                          setNewAnnouncement({...newAnnouncement, title: e.target.value})
                        }
                      }}
                      placeholder="Enter announcement title..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content ({newAnnouncement.content.length}/2000)
                    </label>
                    <textarea
                      value={newAnnouncement.content}
                      onChange={(e) => {
                        if (e.target.value.length <= 2000) {
                          setNewAnnouncement({...newAnnouncement, content: e.target.value})
                        }
                      }}
                      placeholder="Write your announcement here..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      maxLength={2000}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={newAnnouncement.priority}
                        onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value as any})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center space-x-3 pb-3">
                        <input
                          type="checkbox"
                          checked={newAnnouncement.isPinned}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, isPinned: e.target.checked})}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Pin announcement</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Sticky button container for iOS */}
                <div 
                  className="flex space-x-3 mt-8 sticky bottom-0 bg-white pt-4 -mx-6 px-6 pb-6"
                  style={{ 
                    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
                    zIndex: 10,
                    pointerEvents: 'auto',
                    touchAction: 'manipulation'
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if ('vibrate' in navigator) navigator.vibrate(10)
                      setShowCreateModal(false)
                      setNewAnnouncement({ title: '', content: '', priority: 'normal', isPinned: false })
                      setErrorMessage('')
                    }}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10])
                      // Dismiss keyboard on iOS
                      if (document.activeElement && 
                          (document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA')) {
                        (document.activeElement as HTMLElement).blur()
                      }
                      createAnnouncement()
                    }}
                    disabled={!newAnnouncement.title || !newAnnouncement.content || isCreating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isCreating ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Create Announcement</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Announcement Modal */}
      <AnimatePresence>
        {showEditModal && editingAnnouncement && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowEditModal(false)
              setEditingAnnouncement(null)
              setErrorMessage('')
            }}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-2xl w-full my-auto"
              style={{
                maxHeight: 'calc(100dvh - 100px)',
                pointerEvents: 'auto'
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Edit Announcement</h3>
                
                {/* Error Message */}
                {errorMessage && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-700">{errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title ({newAnnouncement.title.length}/200)
                    </label>
                    <input
                      type="text"
                      value={newAnnouncement.title}
                      onChange={(e) => {
                        if (e.target.value.length <= 200) {
                          setNewAnnouncement({...newAnnouncement, title: e.target.value})
                        }
                      }}
                      placeholder="Enter announcement title..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content ({newAnnouncement.content.length}/2000)
                    </label>
                    <textarea
                      value={newAnnouncement.content}
                      onChange={(e) => {
                        if (e.target.value.length <= 2000) {
                          setNewAnnouncement({...newAnnouncement, content: e.target.value})
                        }
                      }}
                      placeholder="Write your announcement here..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      maxLength={2000}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={newAnnouncement.priority}
                        onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value as any})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center space-x-3 pb-3">
                        <input
                          type="checkbox"
                          checked={newAnnouncement.isPinned}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, isPinned: e.target.checked})}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Pin announcement</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Sticky button container for iOS */}
                <div 
                  className="flex space-x-3 mt-8 sticky bottom-0 bg-white pt-4 -mx-6 px-6 pb-6"
                  style={{ 
                    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
                    zIndex: 10,
                    pointerEvents: 'auto',
                    touchAction: 'manipulation'
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if ('vibrate' in navigator) navigator.vibrate(10)
                      setShowEditModal(false)
                      setEditingAnnouncement(null)
                      setNewAnnouncement({ title: '', content: '', priority: 'normal', isPinned: false })
                      setErrorMessage('')
                    }}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10])
                      // Dismiss keyboard on iOS
                      if (document.activeElement && 
                          (document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA')) {
                        (document.activeElement as HTMLElement).blur()
                      }
                      updateAnnouncement()
                    }}
                    disabled={!newAnnouncement.title || !newAnnouncement.content || isCreating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isCreating ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Announcement</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default Announcements
