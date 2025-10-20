import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MeetTheCircleProps {
  onBack: () => void
}

interface Member {
  _id: string
  firstName: string
  lastName: string
  profile: {
    bio?: string
    interests?: string[]
    profilePicture?: string
    location?: string
    joinedDate: string
  }
}

function MeetTheCircle({ onBack }: MeetTheCircleProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    fetchMembers()
  }, [])

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchMembers = async () => {
    try {
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall('/api/profile/members', 'GET')
      
      if (response.success) {
        setMembers(response.data)
      } else {
        console.error('Failed to fetch members:', response.error)
        // Fall back to mock data if API fails
        const mockMembers: Member[] = [
          {
            _id: '1',
            firstName: 'Sarah',
            lastName: 'Johnson',
            profile: {
              bio: 'Passionate about mindfulness and women\'s empowerment. Love connecting with like-minded souls.',
              interests: ['Yoga', 'Meditation', 'Reading', 'Hiking'],
              profilePicture: null,
              location: 'San Francisco, CA',
              joinedDate: '2024-01-15'
            }
          },
          {
            _id: '2',
            firstName: 'Maya',
            lastName: 'Patel',
            profile: {
              bio: 'Creative soul and mother of two. Always looking for inspiration and growth opportunities.',
              interests: ['Art', 'Creativity', 'Parenting', 'Self-Care'],
              profilePicture: null,
              location: 'Austin, TX',
              joinedDate: '2024-01-20'
            }
          }
        ]
        setMembers(mockMembers)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching members:', error)
      setLoading(false)
    }
  }

  const nextMember = () => {
    setCurrentIndex((prev) => (prev + 1) % members.length)
  }

  const prevMember = () => {
    setCurrentIndex((prev) => (prev - 1 + members.length) % members.length)
  }

  const goToMember = (index: number) => {
    setCurrentIndex(index)
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    })
  }

  const [direction, setDirection] = useState(0)

  const handleNext = () => {
    setDirection(1)
    nextMember()
  }

  const handlePrev = () => {
    setDirection(-1)
    prevMember()
  }

  const handleDotClick = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1)
    goToMember(index)
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden safe-area-padding screen-transition flex items-center justify-center">
        <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', opacity: 0.4 }} />
        <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading members...</p>
        </div>
      </div>
    )
  }

  const currentMember = members[currentIndex]

  return (
    <motion.div 
      className="min-h-screen relative overflow-hidden safe-area-padding"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', transform: `translateY(${scrollY * 0.5}px)`, opacity: 0.4 }} />
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      <div className="relative z-10">
      {/* Header - No background, flush with content */}
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
          <h1 className="text-2xl font-bold text-gray-800">Meet the Circle</h1>
        </div>
      </motion.div>

      {/* Member Carousel */}
      <motion.div 
        className="p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {members.length > 0 && (
          <div className="relative">
            <motion.div 
              className="bg-white rounded-3xl border-2 border-gray-800 p-6 mb-6 overflow-hidden"
              whileHover={{ 
                boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
                transition: { duration: 0.3 }
              }}
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 }
                  }}
                >
                  {currentMember && (
                    <>
                      {/* Profile Picture */}
                      <div className="text-center mb-6">
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 260, 
                            damping: 20,
                            delay: 0.2
                          }}
                        >
                          {currentMember.profile.profilePicture ? (
                            <img
                              src={currentMember.profile.profilePicture}
                              alt={`${currentMember.firstName} ${currentMember.lastName}`}
                              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-purple-100"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 ring-4 ring-purple-100">
                              {currentMember.firstName.charAt(0)}{currentMember.lastName.charAt(0)}
                            </div>
                          )}
                        </motion.div>
                        
                        <motion.h2 
                          className="text-2xl font-bold text-gray-900 mb-1"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          {currentMember.firstName} {currentMember.lastName}
                        </motion.h2>
                        
                        {currentMember.profile.location && (
                          <motion.p 
                            className="text-gray-600 text-sm mb-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                          >
                            📍 {currentMember.profile.location}
                          </motion.p>
                        )}
                        
                        <motion.p 
                          className="text-gray-500 text-xs"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                        >
                          Joined {new Date(currentMember.profile.joinedDate).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </motion.p>
                      </div>

                      {/* Bio */}
                      {currentMember.profile.bio && (
                        <motion.div 
                          className="mb-6"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 }}
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                          <p className="text-gray-700 leading-relaxed">{currentMember.profile.bio}</p>
                        </motion.div>
                      )}

                      {/* Interests */}
                      {currentMember.profile.interests && currentMember.profile.interests.length > 0 && (
                        <motion.div 
                          className="mb-6"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">Interests</h3>
                          <div className="flex flex-wrap gap-2">
                            {currentMember.profile.interests.map((interest, index) => (
                              <motion.span
                                key={index}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ 
                                  delay: 0.9 + index * 0.1,
                                  type: "spring",
                                  stiffness: 500
                                }}
                                whileHover={{ scale: 1.05 }}
                              >
                                {interest}
                              </motion.span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <motion.div 
                className="flex items-center justify-between mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <motion.button
                  onClick={handlePrev}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  disabled={members.length <= 1}
                  whileHover={{ scale: 1.05, backgroundColor: "#f3f4f6" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>

                {/* Dots indicator */}
                <div className="flex space-x-2">
                  {members.map((_, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleDotClick(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentIndex ? 'bg-gray-800' : 'bg-gray-300'
                      }`}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      animate={{ 
                        scale: index === currentIndex ? 1.2 : 1,
                        backgroundColor: index === currentIndex ? "#1f2937" : "#d1d5db"
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>

                <motion.button
                  onClick={handleNext}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  disabled={members.length <= 1}
                  whileHover={{ scale: 1.05, backgroundColor: "#f3f4f6" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* Member Count */}
        <motion.div 
          className="bg-white rounded-3xl border-2 border-gray-800 p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          whileHover={{ 
            scale: 1.02,
            boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.1)",
            transition: { duration: 0.3 }
          }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Our Community</h3>
          <motion.p 
            className="text-4xl font-bold text-purple-600 mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              delay: 0.8,
              type: "spring",
              stiffness: 300,
              damping: 20
            }}
          >
            {members.length}
          </motion.p>
          <p className="text-gray-600 text-sm">Amazing women in our circle</p>
        </motion.div>
      </motion.div>
      </div>
    </motion.div>
  )
}

export default MeetTheCircle
