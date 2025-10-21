import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiCall } from '../config/api'

interface HomeProps {
  onLogout: () => void
  onAdminDashboard: () => void
  onMeetTheCircle: () => void
  onProfileSettings: () => void
  onPhotoGallery: () => void
  onGala: () => void
  onAppSettings: () => void
  onAnnouncements: () => void
  onEvents: () => void
  onChat: () => void
  user: { username: string; email?: string; isAdmin?: boolean } | null
}

function Home({ onLogout, onAdminDashboard, onMeetTheCircle, onProfileSettings, onPhotoGallery, onGala, onAppSettings, onAnnouncements, onEvents, onChat, user }: HomeProps) {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [eventCount, setEventCount] = useState<number>(0)
  const [unreadCounts, setUnreadCounts] = useState<{ [channelId: string]: number }>({})
  const [galaChannelId, setGalaChannelId] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    try {
      const response = await apiCall('/api/recent-activity', 'GET')
      if (response.success) {
        setRecentActivity(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error)
    }
  }

  // Fetch event count
  const fetchEventCount = async () => {
    try {
      const response = await apiCall('/api/events?upcoming=true', 'GET')
      if (response.success) {
        setEventCount(response.data.length)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    }
  }

  // Fetch unread message counts
  const fetchUnreadCounts = async () => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/chat/unread-counts', 'GET')
      if (response.success) {
        setUnreadCounts(response.data)
        
        // Get Gala channel ID
        const channelsResponse = await apiCall('/api/chat/channels', 'GET')
        if (channelsResponse.success) {
          const galaChannel = channelsResponse.data.find((ch: any) => ch.slug === 'gala-chat')
          if (galaChannel) {
            setGalaChannelId(galaChannel._id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch unread counts:', error)
    }
  }

  // Handle PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setInstallPrompt(e)
  })

  // Fetch user profile on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { apiCall } = await import('../config/api')
        const response = await apiCall('/api/profile/me')
        if (response.success) {
          setUserProfile(response.data)
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      }
    }
    
    if (user) {
      fetchUserProfile()
      fetchRecentActivity()
      fetchEventCount()
      fetchUnreadCounts()
    }
  }, [user])

  // Handle click outside profile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

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

  // Calculate total unread messages for Chat (excluding Gala)
  const getChatUnreadCount = () => {
    if (!galaChannelId) return 0
    return Object.entries(unreadCounts)
      .filter(([channelId]) => channelId !== galaChannelId)
      .reduce((total, [, count]) => total + count, 0)
  }

  // Get Gala unread count
  const getGalaUnreadCount = () => {
    if (!galaChannelId) return 0
    return unreadCounts[galaChannelId] || 0
  }

  // Set up real-time updates for unread counts
  useEffect(() => {
    if (!user) return

    // Refresh unread counts every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCounts()
    }, 30000)

    return () => clearInterval(interval)
  }, [user])

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    const firstName = user?.username?.split(' ')[0] || 'Beautiful'
    
    if (hour < 12) return `Good morning, ${firstName}`
    if (hour < 17) return `Good afternoon, ${firstName}`
    if (hour < 21) return `Good evening, ${firstName}`
    return `Good night, ${firstName}`
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  const buttonVariants = {
    rest: { 
      scale: 1,
      boxShadow: "0 2px 8px 0 rgba(0, 0, 0, 0.1)"
    },
    hover: { 
      scale: 1.02,
      boxShadow: "0 8px 20px 0 rgba(0, 0, 0, 0.15)",
      y: -2,
      transition: {
        duration: 0.2
      }
    },
    tap: { 
      scale: 0.98,
      transition: {
        duration: 0.1
      }
    }
  }

  // Parallax effect
  const [scrollY, setScrollY] = useState(0)
  
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.div 
      className="min-h-screen relative overflow-hidden safe-area-padding"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Parallax Floral Background */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/floral-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: `translateY(${scrollY * 0.5}px)`,
          opacity: 0.4,
        }}
      />
      
      {/* Overlay to soften background */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      
      {/* Content wrapper */}
      <div className="relative z-10">
      {/* Header - No background, flush with main content */}
      <motion.div 
        className="px-4 pt-6 pb-4"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between">
          {/* Dynamic Greeting */}
          <motion.h1 
            className="text-2xl font-bold text-gray-800"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {getGreeting()}
          </motion.h1>
          
          {/* Profile Menu - Bigger */}
          <div className="relative" ref={profileMenuRef}>
            <motion.button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-12 h-12 bg-white border-2 border-gray-800 rounded-full flex items-center justify-center shadow-md overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {userProfile?.profile?.profilePicture ? (
                <img
                  src={userProfile.profile.profilePicture}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className={`w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  userProfile?.profile?.profilePicture ? 'hidden' : ''
                }`}
              >
                {user?.username?.charAt(0) || 'U'}
              </div>
            </motion.button>
            
            <AnimatePresence>
              {showProfileMenu && (
              <motion.div 
                className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl z-[100] py-3 border-2 border-gray-800"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-600 mt-1">{user?.email}</p>
                </div>
                <div className="py-2">
                  <motion.button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      onProfileSettings()
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                    whileHover={{ backgroundColor: "#f9fafb", x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Profile Settings</span>
                  </motion.button>
                  <motion.button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      onAppSettings()
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                    whileHover={{ backgroundColor: "#f9fafb", x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>App Settings</span>
                  </motion.button>
                  {user?.isAdmin && (
                    <motion.button
                      onClick={() => {
                        setShowProfileMenu(false)
                        onAdminDashboard()
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-purple-600 hover:bg-purple-50 flex items-center space-x-3"
                      whileHover={{ backgroundColor: "#faf5ff", x: 2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Admin Panel</span>
                    </motion.button>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <motion.button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                    whileHover={{ backgroundColor: "#fef2f2", x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </motion.button>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div className="px-4" variants={itemVariants}>
        {/* 6-Button Grid */}
        <motion.div 
          className="grid grid-cols-2 gap-4 mb-6"
          variants={containerVariants}
        >
          {/* Chatroom */}
          <motion.button 
            onClick={onChat}
            className="bg-pink-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2 relative"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            {/* Unread badge */}
            {getChatUnreadCount() > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 z-10">
                {getChatUnreadCount() > 99 ? '99+' : getChatUnreadCount()}
              </div>
            )}
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Chatroom</span>
            <motion.div>
            </motion.div>
          </motion.button>

          {/* Events */}
          <motion.button 
            onClick={onEvents}
            className="bg-purple-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ rotate: -5 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Events</span>
            <motion.div
              className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.0, type: "spring", stiffness: 500 }}
            >
              {eventCount === 0 ? 'No upcoming events' : 
               eventCount === 1 ? '1 upcoming event' : 
               `${eventCount} upcoming events`}
            </motion.div>
          </motion.button>

          {/* Photo Gallery */}
          <motion.button 
            onClick={onPhotoGallery}
            className="bg-blue-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Photo Gallery</span>
          </motion.button>

          {/* Announcements */}
          <motion.button 
            onClick={onAnnouncements}
            className="bg-amber-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ rotate: 10 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Announcements</span>
          </motion.button>

          {/* Gala */}
          <motion.button 
            onClick={onGala}
            className="bg-teal-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2 relative"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            {/* Unread badge */}
            {getGalaUnreadCount() > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 z-10">
                {getGalaUnreadCount() > 99 ? '99+' : getGalaUnreadCount()}
              </div>
            )}
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Gala</span>
          </motion.button>

          {/* Meet the Circle */}
          <motion.button 
            onClick={onMeetTheCircle}
            className="bg-rose-100/80 backdrop-blur-sm border-2 border-gray-800 rounded-3xl p-6 h-32 flex flex-col items-center justify-center space-y-2"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <motion.div 
              className="w-8 h-8 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 400 }}
            >
              <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </motion.div>
            <span className="text-gray-800 font-semibold text-base">Meet the Circle</span>
          </motion.button>
        </motion.div>

        {/* Recent Activity - Back by popular demand! */}
        <motion.div 
          className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-gray-800 p-6 mb-6"
          variants={itemVariants}
          whileHover={{ 
            boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
            transition: { duration: 0.3 }
          }}
        >
          <motion.h3 
            className="text-lg font-bold text-gray-900 mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            Recent Activity
          </motion.h3>
          <motion.div 
            className="space-y-4"
            variants={containerVariants}
          >
            {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
              <motion.div 
                key={index}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer"
                variants={itemVariants}
                whileHover={{ 
                  backgroundColor: "#f9fafb",
                  x: 4,
                  transition: { duration: 0.2 }
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + index * 0.1 }}
              >
                <motion.div 
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2, type: "spring", stiffness: 400 }}
                >
                  {activity.authorProfilePicture ? (
                    <img 
                      src={activity.authorProfilePicture} 
                      alt={activity.authorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${
                      activity.type === 'announcement' ? 'from-blue-400 to-indigo-600' :
                      activity.type === 'event' ? 'from-purple-400 to-pink-600' :
                      'from-green-400 to-teal-600'
                    } flex items-center justify-center text-white text-sm font-medium`}>
                      {activity.authorName?.charAt(0) || activity.type.charAt(0).toUpperCase()}
                    </div>
                  )}
                </motion.div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.authorName} {
                      activity.type === 'announcement' ? 'posted an announcement' :
                      activity.type === 'event' ? 'created an event' :
                      'shared a photo'
                    }
                  </p>
                  <p className="text-xs text-gray-600 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString()}</p>
                </div>
                <motion.svg 
                  className="w-4 h-4 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </motion.svg>
              </motion.div>
            )) : (
              <motion.div 
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
              >
                <p className="text-gray-500 text-sm">No recent activity yet</p>
                <p className="text-gray-400 text-xs mt-1">Activity will appear here when members post announcements, events, or photos</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Install prompt */}
        {installPrompt && (
          <motion.div 
            className="mt-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.button
              onClick={handleInstall}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Install W App
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      {/* Close profile menu on outside click */}
      {showProfileMenu && (
        <motion.div 
          className="fixed inset-0 z-[90]"
          onClick={() => setShowProfileMenu(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      </div>
    </motion.div>
  )
}

export default Home