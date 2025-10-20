import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AddToCalendarButton } from 'add-to-calendar-button-react'
import PaymentModal from './PaymentModal'

interface EventsProps {
  onBack: () => void
  user: { _id: string; username: string; email: string; isAdmin: boolean } | null
}

interface Event {
  _id: string
  title: string
  content: string
  author: {
    firstName: string
    lastName: string
  }
  eventDate: string
  eventTime: string
  price: number
  previewImage?: string
  attendees: Array<{
    _id: string
    firstName: string
    lastName: string
  }>
  maxAttendees?: number
  location?: string
  isActive: boolean
  createdAt: string
}

function Events({ onBack, user }: EventsProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [touchIndicators, setTouchIndicators] = useState<Array<{id: number, x: number, y: number}>>([])
  
  // Show debug mode only when event modals are open (admin only)
  const showDebugMode = (showCreateModal || showEditModal) && user?.isAdmin
  const [newEvent, setNewEvent] = useState({
    title: '',
    content: '',
    eventDate: '',
    eventTime: '',
    price: 0,
    maxAttendees: '',
    location: ''
  })
  const [editEvent, setEditEvent] = useState({
    title: '',
    content: '',
    eventDate: '',
    eventTime: '',
    price: 0,
    maxAttendees: '',
    location: ''
  })
  const [previewImage, setPreviewImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [editPreviewImage, setEditPreviewImage] = useState<File | null>(null)
  const [editPreviewUrl, setEditPreviewUrl] = useState<string>('')
  const [scrollY, setScrollY] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    fetchEvents()
    
    // Restore form state from sessionStorage with better error recovery
    try {
      const savedFormState = sessionStorage.getItem('eventsFormState')
      if (savedFormState) {
        const parsed = JSON.parse(savedFormState)
        setShowCreateModal(parsed.showCreateModal || false)
        setNewEvent(parsed.newEvent || { title: '', content: '', eventDate: '', eventTime: '', price: 0, maxAttendees: '', location: '' })
        setPreviewUrl(parsed.previewUrl || '')
      }
    } catch (error) {
      console.error('Failed to restore events form state, clearing corrupted data:', error)
      // Clear corrupted sessionStorage
      try {
        sessionStorage.removeItem('eventsFormState')
      } catch (e) {
        console.error('Failed to clear sessionStorage:', e)
      }
    }
  }, [])

  // Save form state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      const formState = {
        showCreateModal,
        newEvent,
        previewUrl
      }
      sessionStorage.setItem('eventsFormState', JSON.stringify(formState))
    } catch (error) {
      console.error('Failed to save events form state to sessionStorage:', error)
      // SessionStorage might be full or disabled
    }
  }, [showCreateModal, newEvent, previewUrl])

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
        
        // Play sound for audio feedback
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        oscillator.frequency.value = 800
        gainNode.gain.value = 0.1
        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.05)
        
        // Remove indicator after animation
        setTimeout(() => {
          setTouchIndicators(prev => prev.filter(i => i.id !== id))
        }, 1000)
        
        console.log('👆 TOUCH DETECTED:', {
          x: touch.clientX,
          y: touch.clientY,
          target: (e.target as HTMLElement)?.tagName,
          targetClass: (e.target as HTMLElement)?.className
        })
      })
    }
    
    document.addEventListener('touchstart', handleTouch, { passive: true })
    return () => document.removeEventListener('touchstart', handleTouch)
  }, [showDebugMode])

  const fetchEvents = async () => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/events?upcoming=true')
      
      if (response.success) {
        setEvents(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  const createEvent = async () => {
    console.log('🎯 createEvent function called')
    
    // Clear any previous error
    setErrorMessage('')
    
    // Validate file size (5MB limit - match backend)
    if (previewImage && previewImage.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please use an image smaller than 5MB.')
      alert('Image file is too large. Please use an image smaller than 5MB.')
      return
    }
    
    // Prevent double-clicks
    if (isCreating) {
      console.log('⚠️ Already creating, ignoring duplicate click')
      return
    }
    
    setIsCreating(true)
    
    // Failsafe: Force clear loading state after 90 seconds no matter what
    const failsafeTimeout = setTimeout(() => {
      console.error('⏰ Failsafe timeout triggered - forcing loading state clear')
      setIsCreating(false)
      alert('The request is taking too long. Please check your internet connection and try again.')
    }, 90000)
    
    try {
      const { apiCall } = await import('../config/api')
      
      const formData = new FormData()
      formData.append('title', newEvent.title)
      formData.append('content', newEvent.content)
      formData.append('eventDate', newEvent.eventDate)
      formData.append('eventTime', newEvent.eventTime)
      formData.append('price', newEvent.price.toString())
      if (newEvent.maxAttendees) formData.append('maxAttendees', newEvent.maxAttendees)
      if (newEvent.location) formData.append('location', newEvent.location)
      if (previewImage) formData.append('previewImage', previewImage)
      
      console.log('📤 Creating event with data:', {
        title: newEvent.title,
        hasImage: !!previewImage,
        imageSize: previewImage ? `${(previewImage.size / 1024).toFixed(2)} KB` : 'N/A'
      })
      
      const response = await apiCall('/api/events', 'POST', formData, 60000) // 60 second timeout for image upload
      
      clearTimeout(failsafeTimeout) // Clear failsafe if we got a response
      
      if (response.success) {
        console.log('✅ Event created successfully')
        
        // Auto-RSVP the creator to the event (if free event)
        if (response.data.price === 0) {
          await apiCall(`/api/events/${response.data._id}/rsvp`, 'POST').catch(err => {
            console.error('Failed to auto-RSVP creator:', err)
          })
          // Fetch the updated event with creator in attendees list
          const updatedEventResponse = await apiCall(`/api/events/${response.data._id}`, 'GET')
          if (updatedEventResponse.success) {
            setEvents([updatedEventResponse.data, ...events])
          } else {
            setEvents([response.data, ...events])
          }
        } else {
          setEvents([response.data, ...events])
        }
        
        setShowCreateModal(false)
        setNewEvent({ title: '', content: '', eventDate: '', eventTime: '', price: 0, maxAttendees: '', location: '' })
        setPreviewImage(null)
        setPreviewUrl('')
        // Clear saved form state after successful submission
        sessionStorage.removeItem('eventsFormState')
        
        // Show success message
        alert('✅ Event created successfully!')
      }
    } catch (error: any) {
      clearTimeout(failsafeTimeout) // Clear failsafe on error too
      console.error('❌ Failed to create event:', error)
      const errorMsg = error?.message || 'Failed to create event. Please try again.'
      setErrorMessage(errorMsg)
      alert(`Failed to create event: ${errorMsg}`)
    } finally {
      clearTimeout(failsafeTimeout) // Extra safety
      setIsCreating(false)
      console.log('✅ Create event process completed, loading state cleared')
    }
  }

  const startEditEvent = (event: Event) => {
    // Clear any previous errors when opening edit modal
    setErrorMessage('')
    
    setEditingEvent(event)
    setEditEvent({
      title: event.title,
      content: event.content,
      eventDate: event.eventDate.split('T')[0], // Extract date from ISO string
      eventTime: event.eventTime,
      price: event.price,
      maxAttendees: event.maxAttendees?.toString() || '',
      location: event.location || ''
    })
    setEditPreviewUrl(event.previewImage || '')
    setShowEditModal(true)
  }

  const updateEvent = async () => {
    console.log('🎯 updateEvent function called')
    
    if (!editingEvent) {
      console.error('⚠️ No event being edited')
      return
    }
    
    // Clear any previous error
    setErrorMessage('')
    
    // Validate file size (5MB limit - match backend)
    if (editPreviewImage && editPreviewImage.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please use an image smaller than 5MB.')
      alert('Image file is too large. Please use an image smaller than 5MB.')
      return
    }
    
    // Prevent double-clicks
    if (isUpdating) {
      console.log('⚠️ Already updating, ignoring duplicate click')
      return
    }
    
    setIsUpdating(true)
    
    // Failsafe: Force clear loading state after 90 seconds no matter what
    const failsafeTimeout = setTimeout(() => {
      console.error('⏰ Failsafe timeout triggered - forcing loading state clear')
      setIsUpdating(false)
      alert('The request is taking too long. Please check your internet connection and try again.')
    }, 90000)
    
    try {
      const { apiCall } = await import('../config/api')
      
      const formData = new FormData()
      formData.append('title', editEvent.title)
      formData.append('content', editEvent.content)
      formData.append('eventDate', editEvent.eventDate)
      formData.append('eventTime', editEvent.eventTime)
      formData.append('price', editEvent.price.toString())
      if (editEvent.maxAttendees) formData.append('maxAttendees', editEvent.maxAttendees)
      if (editEvent.location) formData.append('location', editEvent.location)
      if (editPreviewImage) formData.append('previewImage', editPreviewImage)
      
      console.log('📤 Updating event with data:', {
        id: editingEvent._id,
        title: editEvent.title,
        hasNewImage: !!editPreviewImage,
        imageSize: editPreviewImage ? `${(editPreviewImage.size / 1024).toFixed(2)} KB` : 'N/A'
      })
      
      const response = await apiCall(`/api/events/${editingEvent._id}`, 'PUT', formData, 60000) // 60 second timeout for image upload
      
      clearTimeout(failsafeTimeout) // Clear failsafe if we got a response
      
      if (response.success) {
        console.log('✅ Event updated successfully')
        
        setEvents(events.map(e => e._id === editingEvent._id ? response.data : e))
        if (selectedEvent?._id === editingEvent._id) {
          setSelectedEvent(response.data)
        }
        setShowEditModal(false)
        setEditingEvent(null)
        setEditPreviewImage(null)
        setEditPreviewUrl('')
        
        // Show success message
        alert('✅ Event updated successfully!')
      }
    } catch (error: any) {
      clearTimeout(failsafeTimeout) // Clear failsafe on error too
      console.error('❌ Failed to update event:', error)
      const errorMsg = error?.message || 'Failed to update event. Please try again.'
      setErrorMessage(errorMsg)
      alert(`Failed to update event: ${errorMsg}`)
    } finally {
      clearTimeout(failsafeTimeout) // Extra safety
      setIsUpdating(false)
      console.log('✅ Update event process completed, loading state cleared')
    }
  }

  const removeAttendee = async (eventId: string, attendeeId: string) => {
    if (!confirm('Are you sure you want to remove this attendee from the event?')) {
      return
    }
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/events/${eventId}/attendees/${attendeeId}`, 'DELETE')
      
      if (response.success) {
        const updatedEvent = response.data
        setEvents(events.map(e => e._id === eventId ? updatedEvent : e))
        if (selectedEvent && selectedEvent._id === eventId) {
          setSelectedEvent(updatedEvent)
        }
      }
    } catch (error) {
      console.error('Failed to remove attendee:', error)
      alert('Failed to remove attendee. Please try again.')
    }
  }

  const handleEditImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.log('⚠️ No file selected for edit')
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please use an image smaller than 5MB.')
      alert('Image file is too large. Please use an image smaller than 5MB.')
      event.target.value = '' // Clear the input
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.')
      alert('Please select a valid image file.')
      event.target.value = '' // Clear the input
      return
    }

    console.log('📎 Edit image selected:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type
    })

    setEditPreviewImage(file)
    const url = URL.createObjectURL(file)
    setEditPreviewUrl(url)
    setErrorMessage('') // Clear any previous errors
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/events/${eventId}`, 'DELETE')
      
      if (response.success) {
        setEvents(events.filter(e => e._id !== eventId))
        setSelectedEvent(null)
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  const toggleRSVP = async (eventId: string) => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/events/${eventId}/rsvp`, 'POST')
      
      if (response.success) {
        const updatedEvent = response.data.event
        setEvents(events.map(e => e._id === eventId ? updatedEvent : e))
        if (selectedEvent && selectedEvent._id === eventId) {
          setSelectedEvent(updatedEvent)
        }
      }
    } catch (error) {
      console.error('Failed to toggle RSVP:', error)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.log('⚠️ No file selected')
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please use an image smaller than 5MB.')
      alert('Image file is too large. Please use an image smaller than 5MB.')
      event.target.value = '' // Clear the input
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.')
      alert('Please select a valid image file.')
      event.target.value = '' // Clear the input
      return
    }

    console.log('📎 Image selected:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type
    })

    setPreviewImage(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setErrorMessage('') // Clear any previous errors
  }

  const isUserAttending = (event: Event) => {
    return user && event.attendees.some(attendee => attendee._id === user._id)
  }

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatEventTime = (timeStr: string) => {
    // Convert 24-hour format to 12-hour format with AM/PM
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  // Helper function to format date for the calendar component
  const formatDateForCalendar = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0] // Returns YYYY-MM-DD format
  }

  // Helper function to format time for the calendar component
  const formatTimeForCalendar = (timeStr: string) => {
    return timeStr // Already in HH:MM format
  }

  // Handle successful payment
  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false)
    
    // Show success message immediately
    alert('Payment successful! You are now registered for this event.')
    
    try {
      // Small delay to allow webhook to process
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refresh events to show user as attending
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/events?upcoming=true')
      
      if (response.success) {
        setEvents(response.data)
        
        // Update the selected event to reflect the new attendee status
        if (selectedEvent) {
          const updatedEvent = response.data.find((event: Event) => event._id === selectedEvent._id)
          if (updatedEvent) {
            setSelectedEvent(updatedEvent)
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing event data:', error)
      // User already got success message, so just log the error
    }
  }

  if (loading) {
    return (
      <motion.div 
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Parallax Floral Background */}
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: 'url(/floral-background.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.4,
          }}
        />
        {/* Overlay */}
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
      
      {/* Overlay to add pink tint */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      
      {/* Content wrapper */}
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
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          </div>
          
          {user?.isAdmin && (
            <button
              onClick={() => {
                // Clear any previous errors when opening create modal
                setErrorMessage('')
                setShowCreateModal(true)
              }}
              className="px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center space-x-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Event</span>
              <span className="sm:hidden">+</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {events.length === 0 ? (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h3>
            <p className="text-gray-600 text-sm">Check back later for upcoming events!</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => (
              <motion.div
                key={event._id}
                className="bg-white rounded-3xl border-2 border-gray-800 overflow-hidden cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onClick={() => setSelectedEvent(event)}
                whileHover={{ y: -2 }}
              >
                {event.previewImage && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={event.previewImage}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
                      <p className="text-gray-700 mb-3 leading-relaxed whitespace-pre-wrap">{event.content}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {event.price > 0 && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          ${event.price}
                        </span>
                      )}
                      {event.price > 0 && isUserAttending(event) && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full flex items-center space-x-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Paid</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center space-x-3 text-lg font-medium text-gray-800">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatEventDate(event.eventDate)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-lg font-medium text-gray-800">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatEventTime(event.eventTime)}</span>
                    </div>
                    
                    {event.location && (
                      <div className="flex items-center space-x-3 text-base text-gray-600 sm:col-span-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{event.location}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-3 text-base text-gray-600 sm:col-span-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>
                        {event.attendees.length}
                        {event.maxAttendees && ` / ${event.maxAttendees}`} attending
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>By {event.author.firstName} {event.author.lastName}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEvent(event)
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                      >
                        More Details
                      </button>
                      
                      {user?.isAdmin && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditEvent(event)
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit event"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteEvent(event._id)
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete event"
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

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              {selectedEvent.previewImage && (
                <div className="h-64 bg-gray-200 overflow-hidden">
                  <img
                    src={selectedEvent.previewImage}
                    alt={selectedEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedEvent.title}</h2>
                  {selectedEvent.price > 0 && (
                    <span className="px-4 py-2 bg-green-100 text-green-800 font-bold rounded-full">
                      ${selectedEvent.price}
                    </span>
                  )}
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed whitespace-pre-wrap">{selectedEvent.content}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center space-x-3 text-lg font-medium text-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatEventDate(selectedEvent.eventDate)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-lg font-medium text-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatEventTime(selectedEvent.eventTime)}</span>
                  </div>
                  
                  {selectedEvent.location && (
                    <div className="flex items-center space-x-3 text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                </div>
                
                {/* Attendees Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Who's Going ({selectedEvent.attendees.length}
                    {selectedEvent.maxAttendees && ` / ${selectedEvent.maxAttendees}`})
                  </h3>
                  
                  {selectedEvent.attendees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.attendees.map((attendee) => (
                        <span
                          key={attendee._id}
                          className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full flex items-center space-x-2"
                        >
                          <span>{attendee.firstName} {attendee.lastName}</span>
                          {user?.isAdmin && (
                            <button
                              onClick={() => removeAttendee(selectedEvent._id, attendee._id)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove attendee"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No one has RSVPed yet. Be the first!</p>
                  )}
                </div>
                
                <div className="flex flex-col space-y-3">
                  {/* Add to Calendar Button */}
                  <div className="flex justify-center">
                    <AddToCalendarButton
                      name={selectedEvent.title}
                      options={['Apple', 'Google', 'iCal', 'Microsoft365', 'Outlook.com', 'Yahoo']}
                      location={selectedEvent.location || 'The Women\'s Circle'}
                      startDate={formatDateForCalendar(selectedEvent.eventDate)}
                      endDate={formatDateForCalendar(selectedEvent.eventDate)}
                      startTime={formatTimeForCalendar(selectedEvent.eventTime)}
                      endTime={formatTimeForCalendar(
                        (() => {
                          const [hours, minutes] = selectedEvent.eventTime.split(':')
                          const endTime = new Date()
                          endTime.setHours(parseInt(hours) + 2, parseInt(minutes)) // Add 2 hours
                          return `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
                        })()
                      )}
                      timeZone="America/New_York"
                      description={selectedEvent.content}
                      buttonStyle="round"
                      size="3"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                    
                    {selectedEvent.price > 0 ? (
                      isUserAttending(selectedEvent) ? (
                        <div className="flex-1 px-6 py-3 bg-green-100 text-green-800 rounded-xl font-medium flex items-center justify-center space-x-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Paid & Registered</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                        >
                          Pay ${selectedEvent.price}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => toggleRSVP(selectedEvent._id)}
                        className={`flex-1 px-6 py-3 rounded-xl font-medium transition-colors ${
                          isUserAttending(selectedEvent)
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {isUserAttending(selectedEvent) ? 'Cancel RSVP' : 'RSVP (Free)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedEvent && selectedEvent.price > 0 && (
          <PaymentModal
            event={{
              _id: selectedEvent._id,
              title: selectedEvent.title,
              price: selectedEvent.price,
              eventDate: selectedEvent.eventDate,
              eventTime: selectedEvent.eventTime
            }}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </AnimatePresence>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowCreateModal(false)
              setErrorMessage('') // Clear errors when closing
            }}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-2xl w-full my-auto"
              style={{
                maxHeight: 'calc(100dvh - 100px)', // Dynamic viewport height for iOS
                pointerEvents: 'auto'
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Create New Event</h3>
                
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
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Enter event title..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newEvent.content}
                      onChange={(e) => setNewEvent({...newEvent, content: e.target.value})}
                      placeholder="Describe your event..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Date
                      </label>
                      <input
                        type="date"
                        value={newEvent.eventDate}
                        onChange={(e) => setNewEvent({...newEvent, eventDate: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Time
                      </label>
                      <input
                        type="time"
                        value={newEvent.eventTime}
                        onChange={(e) => setNewEvent({...newEvent, eventTime: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newEvent.price === 0 ? '' : newEvent.price}
                        onChange={(e) => setNewEvent({...newEvent, price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        placeholder="0 (Free)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Attendees (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newEvent.maxAttendees}
                        onChange={(e) => setNewEvent({...newEvent, maxAttendees: e.target.value})}
                        placeholder="No limit"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      placeholder="Event location..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preview Image (Optional)
                    </label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        id="create-image-input"
                      />
                      {previewImage && (
                        <p className="text-sm text-green-600 flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Image selected: {previewImage.name} ({(previewImage.size / 1024).toFixed(2)} KB)</span>
                        </p>
                      )}
                    </div>
                    {previewUrl && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Preview:</p>
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-xl border border-gray-300"
                        />
                      </div>
                    )}
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
                      console.log('🔘 Cancel button clicked')
                      // Haptic feedback
                      if ('vibrate' in navigator) navigator.vibrate(10)
                      setShowCreateModal(false)
                      setNewEvent({ title: '', content: '', eventDate: '', eventTime: '', price: 0, maxAttendees: '', location: '' })
                      setPreviewImage(null)
                      setPreviewUrl('')
                      setErrorMessage('')
                    }}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px', // Bigger touch target
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
                      console.log('🔘 Create Event button clicked')
                      // Haptic feedback
                      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10])
                      // Dismiss keyboard on iOS ONLY when button is clicked
                      if (document.activeElement && 
                          (document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA')) {
                        (document.activeElement as HTMLElement).blur()
                      }
                      createEvent()
                    }}
                    disabled={!newEvent.title || !newEvent.content || !newEvent.eventDate || !newEvent.eventTime || isCreating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px', // Bigger touch target
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
                      <span>Create Event</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Event Modal */}
      <AnimatePresence>
        {showEditModal && editingEvent && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowEditModal(false)
              setErrorMessage('') // Clear errors when closing
            }}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-2xl w-full my-auto"
              style={{
                maxHeight: 'calc(100dvh - 100px)', // Dynamic viewport height for iOS
                pointerEvents: 'auto'
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Edit Event</h3>
                
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
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={editEvent.title}
                      onChange={(e) => setEditEvent({...editEvent, title: e.target.value})}
                      placeholder="Enter event title..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editEvent.content}
                      onChange={(e) => setEditEvent({...editEvent, content: e.target.value})}
                      placeholder="Describe your event..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Date
                      </label>
                      <input
                        type="date"
                        value={editEvent.eventDate}
                        onChange={(e) => setEditEvent({...editEvent, eventDate: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Time
                      </label>
                      <input
                        type="time"
                        value={editEvent.eventTime}
                        onChange={(e) => setEditEvent({...editEvent, eventTime: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editEvent.price === 0 ? '' : editEvent.price}
                        onChange={(e) => setEditEvent({...editEvent, price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        placeholder="0 (Free)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Attendees (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editEvent.maxAttendees}
                        onChange={(e) => setEditEvent({...editEvent, maxAttendees: e.target.value})}
                        placeholder="No limit"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={editEvent.location}
                      onChange={(e) => setEditEvent({...editEvent, location: e.target.value})}
                      placeholder="Event location..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preview Image (Optional)
                    </label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        id="edit-image-input"
                      />
                      {editPreviewImage && (
                        <p className="text-sm text-green-600 flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>New image selected: {editPreviewImage.name} ({(editPreviewImage.size / 1024).toFixed(2)} KB)</span>
                        </p>
                      )}
                    </div>
                    {editPreviewUrl && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">{editPreviewImage ? 'New preview:' : 'Current image:'}</p>
                        <img
                          src={editPreviewUrl}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-xl border border-gray-300"
                        />
                      </div>
                    )}
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
                      console.log('🔘 Cancel edit button clicked')
                      // Haptic feedback
                      if ('vibrate' in navigator) navigator.vibrate(10)
                      setShowEditModal(false)
                      setEditingEvent(null)
                      setEditPreviewImage(null)
                      setEditPreviewUrl('')
                      setErrorMessage('')
                    }}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px', // Bigger touch target
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
                      console.log('🔘 Update Event button clicked')
                      // Haptic feedback
                      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10])
                      // Dismiss keyboard on iOS ONLY when button is clicked
                      if (document.activeElement && 
                          (document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA')) {
                        (document.activeElement as HTMLElement).blur()
                      }
                      updateEvent()
                    }}
                    disabled={!editEvent.title || !editEvent.content || !editEvent.eventDate || !editEvent.eventTime || isUpdating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-95"
                    style={{ 
                      pointerEvents: 'auto', 
                      touchAction: 'manipulation',
                      minHeight: '56px', // Bigger touch target
                      transition: 'all 0.2s'
                    }}
                  >
                    {isUpdating ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Event</span>
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

export default Events
