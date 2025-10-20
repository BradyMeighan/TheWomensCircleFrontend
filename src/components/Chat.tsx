import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { apiCall } from '../config/api'
import VoiceRecorder from './VoiceRecorder'
import AudioPlayer from './AudioPlayer'

interface ChatProps {
  onBack: () => void
  user: { _id: string; username: string; email?: string; firstName?: string; lastName?: string; isAdmin?: boolean } | null
}

interface Channel {
  _id: string
  name: string
  description?: string
  type: 'general' | 'private' | 'direct' | 'group'
  slug: string
  lastActivity: string
  members?: string[]
  allowedUsers?: string[]
  createdBy?: string
  sortOrder?: number
}

interface Message {
  _id: string
  content: string
  author: {
    _id: string
    firstName: string
    lastName: string
    profile?: {
      profilePicture?: string
    }
  }
  createdAt: string
  type: 'text' | 'image' | 'file' | 'system' | 'voice'
  reactions?: {
    emoji: string
    users: string[]
  }[]
  parentMessage?: {
    _id: string
    content: string
    author: {
      firstName: string
      lastName: string
    }
  } | null
  attachments?: {
    type: 'image' | 'file' | 'voice'
    url: string
    filename?: string
    size?: number
    duration?: number
  }[]
}

function Chat({ onBack, user }: ChatProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showImageHint, setShowImageHint] = useState<string | null>(null) // Track which image is showing hint
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({}) // Track carousel index for each message
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showDirectMessageModal, setShowDirectMessageModal] = useState(false)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false)
  const [showManageAccessModal, setShowManageAccessModal] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Channel | null>(null)
  const [managingChannel, setManagingChannel] = useState<Channel | null>(null)
  const [showChannelEditModal, setShowChannelEditModal] = useState<Channel | null>(null)
  const [editChannelData, setEditChannelData] = useState({
    sortOrder: 0
  })
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    selectedUsers: [] as string[]
  })
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    selectedUsers: [] as string[]
  })
  const [newChannelData, setNewChannelData] = useState({
    name: '',
    description: '',
    type: 'general' as 'general' | 'private'
  })
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [scrollY, setScrollY] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  // const [activeReactionsForMessageId, setActiveReactionsForMessageId] = useState<string | null>(null)

  // Group channels by type (hide gala-chat as it has its own dedicated component)
  const communityChannels = channels.filter(ch => ch.type === 'general' && ch.slug !== 'gala-chat')
  const groupChannels = channels.filter(ch => ch.type === 'group')
  const directMessages = channels.filter(ch => ch.type === 'direct')
  const privateChannels = channels.filter(ch => ch.type === 'private')

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle input focus for mobile keyboards
  const handleInputFocus = () => {
    // Scroll the input into view after a brief delay for mobile keyboards
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 300)
  }

  useEffect(() => {
    // Initialize socket connection - only once on mount
    const newSocket = io('https://thewomenscirclebackend-production.up.railway.app', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to chat server')
      setIsConnecting(false)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason)
      setIsConnecting(true)
    })

    newSocket.on('new-message', (message: Message) => {
      // Only add if message doesn't already exist (prevent duplicates)
      shouldAutoScroll.current = true
      setMessages(prev => {
        const exists = prev.some(m => m._id === message._id)
        if (exists) return prev
        return [...prev, message]
      })
      setTimeout(() => {
        requestAnimationFrame(() => scrollToBottom())
      }, 50)
    })

    newSocket.on('message-reaction', (data: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
      ))
    })

      newSocket.on('message-deleted', (data: { messageId: string; channelId: string }) => {
        console.log('🗑️ Message deletion received:', data)
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId))
      })

    setSocket(newSocket)
    fetchChannels()
    fetchAllUsers()

    return () => {
      console.log('🔌 Cleaning up socket connection')
      newSocket.off('connect')
      newSocket.off('disconnect')
      newSocket.off('new-message')
      newSocket.off('message-reaction')
      newSocket.off('message-deleted')
      newSocket.disconnect()
    }
  }, [])

  // Track if we should auto-scroll
  const shouldAutoScroll = useRef(true)
  
  // New approach: scroll to a hidden spacer element below the last message
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
  }
  
  // Auto-scroll to bottom when new messages arrive or channel changes
  useEffect(() => {
    if (shouldAutoScroll.current && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [messages.length])

  const fetchChannels = async () => {
    try {
      const response = await apiCall('/api/chat/channels', 'GET')
      if (response.success) {
        console.log('📋 All channels loaded:', response.data)
        console.log('📋 Direct messages:', response.data.filter((ch: Channel) => ch.type === 'direct'))
        setChannels(response.data)
        
        // Auto-select first general channel
        const generalChannel = response.data.find((ch: Channel) => ch.type === 'general')
        if (generalChannel) {
          setSelectedChannel(generalChannel)
          fetchMessages(generalChannel._id)
          
          if (socket) {
            socket.emit('join-channels', [generalChannel._id])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const response = await apiCall('/api/user/all', 'GET')
      if (response.success) {
        setAllUsers(response.data.filter((u: any) => u._id !== user?._id)) // Exclude current user
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchMessages = async (channelId: string, page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setIsLoadingMessages(true)
      }
      const response = await apiCall(`/api/chat/channels/${channelId}/messages?page=${page}&limit=20`, 'GET')
      if (response.success) {
        const newMessages = response.data.messages
        if (append) {
          // Prepend older messages when loading more
          shouldAutoScroll.current = false // Don't auto-scroll when loading history
          setMessages(prev => [...newMessages, ...prev])
        } else {
          // Replace messages on initial load
          shouldAutoScroll.current = true // Auto-scroll on initial load
          setMessages(newMessages)
          // Ensure scroll to bottom on initial load
          setTimeout(() => {
            requestAnimationFrame(() => scrollToBottom())
          }, 100)
        }
        setHasMoreMessages(response.data.pagination?.hasMore || false)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      if (!append) {
        setIsLoadingMessages(false)
      }
    }
  }

  // Load more messages via button click
  const loadMoreMessages = () => {
    if (!selectedChannel || !hasMoreMessages || loadingMore) return
    
    setLoadingMore(true)
    fetchMessages(selectedChannel._id, currentPage + 1, true).finally(() => {
      setLoadingMore(false)
    })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !socket || !user) return

    // Validate message length (4000 char limit from backend)
    if (newMessage.trim().length > 4000) {
      alert('Message is too long. Please keep it under 4000 characters.')
      return
    }

    try {
      const messageData: any = {
        content: newMessage.trim(),
        type: 'text'
      }

      // Add parent message if replying
      if (replyingTo) {
        messageData.parentMessage = replyingTo._id
      }

      const response = await apiCall(`/api/chat/channels/${selectedChannel._id}/messages`, 'POST', messageData)

      if (response.success) {
        // Optimistically add the message to local state immediately
        setMessages(prev => {
          const exists = prev.some(m => m._id === response.data._id)
          if (exists) {
            return prev
          }
          return [...prev, response.data]
        })
        
        // Enable auto-scroll for new message
        shouldAutoScroll.current = true
        
        // Scroll to bottom after DOM updates
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
        
        // Broadcast to other users via socket
        socket.emit('send-message', {
          ...response.data,
          channel: selectedChannel._id
        })
        
        setNewMessage('')
        setReplyingTo(null) // Clear reply state
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = '52px'
        }
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to send message. Please try again.'
      
      if (error?.message?.includes('Network error')) {
        errorMessage = 'Network error. Please check your internet connection.'
      } else if (error?.message?.includes('timed out')) {
        errorMessage = 'Request timed out. Please check your connection and try again.'
      } else if (error?.message?.includes('too long') || error?.message?.includes('4000')) {
        errorMessage = 'Message is too long (maximum 4000 characters).'
      } else if (error?.message?.includes('not found')) {
        errorMessage = 'Channel not found. Please refresh and try again.'
      } else if (error?.message?.includes('access denied') || error?.message?.includes('permission')) {
        errorMessage = 'You do not have permission to send messages in this channel.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      alert(errorMessage)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedChannel || !socket || !user) return

    // Validate each file
    const validFiles: File[] = []
    const errors: string[] = []
    
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i]
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`"${file.name}" is not an image file. Please select an image (JPG, PNG, GIF, etc.)`)
        continue
      }

                // Check file size with specific message (20MB limit - server will compress to WebP)
                if (file.size > 20 * 1024 * 1024) {
                  const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
                  errors.push(`"${file.name}" is too large (${sizeMB}MB). Maximum file size is 20MB.`)
                  continue
                }
      
      validFiles.push(file)
    }

    // Show all errors at once
    if (errors.length > 0) {
      alert('Some files could not be uploaded:\n\n' + errors.join('\n'))
    }

    if (validFiles.length === 0) {
      e.target.value = ''
      return
    }

    if (validFiles.length > 5) {
      alert('You can only upload up to 5 images at once. Please select fewer images.')
      e.target.value = ''
      return
    }

    try {
      // Create FormData for multipart upload
      const formData = new FormData()
      validFiles.forEach(file => {
        formData.append('images', file)
      })
      formData.append('caption', newMessage.trim() || (validFiles.length > 1 ? `${validFiles.length} images` : 'Image'))

      // Upload images
      const token = localStorage.getItem('authToken')
      
      if (!token) {
        alert('You must be logged in to upload images')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/channels/${selectedChannel._id}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (response.status === 401) {
        alert('Your session has expired. Please log in again.')
        return
      }

      if (data.success) {
        // Add image message to local state
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.data._id)
          if (exists) {
            return prev
          }
          return [...prev, data.data]
        })
        
        // Enable auto-scroll
        shouldAutoScroll.current = true
        
        // Scroll to bottom
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
        
        // Broadcast via socket
        socket.emit('send-message', {
          ...data.data,
          channel: selectedChannel._id
        })
        
        setNewMessage('')
      } else {
        // Provide specific error messages
        let errorMsg = 'Failed to upload images.'
        
        if (data.error?.includes('too large') || data.error?.includes('5MB')) {
          errorMsg = 'One or more images are too large. Maximum file size is 5MB per image.'
        } else if (data.error?.includes('format') || data.error?.includes('type')) {
          errorMsg = 'Invalid image format. Please use JPG, PNG, or GIF images.'
        } else if (data.error?.includes('Network')) {
          errorMsg = 'Network error. Please check your internet connection and try again.'
        } else if (data.error) {
          errorMsg = data.error
        }
        
        alert(errorMsg)
      }
    } catch (error: any) {
      console.error('Failed to upload images:', error)
      
      let errorMsg = 'Failed to upload images. Please try again.'
      
      if (error?.message?.includes('Network error')) {
        errorMsg = 'Network error. Please check your internet connection.'
      } else if (error?.message?.includes('timed out')) {
        errorMsg = 'Upload timed out. Please try again with a better connection.'
      } else if (error?.message) {
        errorMsg = error.message
      }
      
      alert(errorMsg)
    }

    // Reset file input
    e.target.value = ''
  }

  const handleVoiceUpload = async (audioBlob: Blob, duration: number) => {
    if (!selectedChannel || !socket || !user) return

    try {
      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('voice', audioBlob, 'voice-message.webm')
      formData.append('duration', duration.toString())

      // Upload voice message
      const token = localStorage.getItem('authToken')
      
      if (!token) {
        alert('You must be logged in to send voice messages')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/channels/${selectedChannel._id}/upload-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (response.status === 401) {
        alert('Session expired. Please log in again.')
        return
      }

      if (data.success) {
        // Add voice message to local state
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.data._id)
          if (exists) {
            return prev
          }
          return [...prev, data.data]
        })
        
        // Enable auto-scroll
        shouldAutoScroll.current = true
        
        // Scroll to bottom
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
        
        // Broadcast via socket
        socket.emit('send-message', {
          ...data.data,
          channel: selectedChannel._id
        })
        
        // Close voice recorder
        setShowVoiceRecorder(false)
      } else {
        alert(`Failed to send voice message: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to send voice message:', error)
      alert('Failed to send voice message. Please try again.')
    }
  }

  const selectChannel = (channel: Channel) => {
    setSelectedChannel(channel)
    setCurrentPage(1) // Reset pagination when switching channels
    setHasMoreMessages(false)
    shouldAutoScroll.current = true // Enable auto-scroll for channel switch
    fetchMessages(channel._id)
    setShowSidebar(false) // Close sidebar on mobile
    
    if (socket) {
      socket.emit('join-channels', [channel._id])
    }
    // Ensure scroll to bottom after switching
    setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom())
    }, 150)
  }

  const createGroup = async () => {
    if (!newGroupData.name.trim() || newGroupData.selectedUsers.length === 0) return

    try {
      const response = await apiCall('/api/chat/channels', 'POST', {
        name: newGroupData.name.trim(),
        description: newGroupData.description.trim(),
        type: 'group',
        members: newGroupData.selectedUsers
      })

      if (response.success) {
        setChannels([...channels, response.data])
        setNewGroupData({ name: '', description: '', selectedUsers: [] })
        setShowCreateGroup(false)
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      alert('Failed to create group. Please try again.')
    }
  }

  const startDirectMessage = async (targetUserId: string) => {
    try {
      // Check if DM already exists
      const existingDM = directMessages.find(dm => 
        dm.members?.includes(targetUserId) && dm.members?.includes(user?._id || '')
      )

      if (existingDM) {
        selectChannel(existingDM)
        setShowDirectMessageModal(false)
        return
      }

      // Create new DM
      const targetUser = allUsers.find(u => u._id === targetUserId)
      const response = await apiCall('/api/chat/channels', 'POST', {
        name: `${user?.username} & ${targetUser?.firstName} ${targetUser?.lastName}`,
        type: 'direct',
        members: [user?._id, targetUserId]
      })

      if (response.success) {
        setChannels([...channels, response.data])
        selectChannel(response.data)
        setShowDirectMessageModal(false)
      }
    } catch (error) {
      console.error('Failed to start direct message:', error)
      alert('Failed to start direct message. Please try again.')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setNewGroupData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
  }

  const toggleEditUserSelection = (userId: string) => {
    setEditGroupData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
  }

  const startEditGroup = (channel: Channel) => {
    setEditingGroup(channel)
    setEditGroupData({
      name: channel.name,
      description: channel.description || '',
      selectedUsers: channel.members || []
    })
    setShowEditGroupModal(true)
  }

  const updateGroup = async () => {
    if (!editingGroup || !editGroupData.name.trim()) return

    try {
      const response = await apiCall(`/api/chat/channels/${editingGroup._id}`, 'PUT', {
        name: editGroupData.name.trim(),
        description: editGroupData.description.trim(),
        members: editGroupData.selectedUsers
      })

      if (response.success) {
        // Update the channels list
        setChannels(channels.map(ch => 
          ch._id === editingGroup._id ? response.data : ch
        ))
        
        // Update selected channel if it's the one being edited
        if (selectedChannel?._id === editingGroup._id) {
          setSelectedChannel(response.data)
        }
        
        setEditGroupData({ name: '', description: '', selectedUsers: [] })
        setEditingGroup(null)
        setShowEditGroupModal(false)
      }
    } catch (error) {
      console.error('Failed to update group:', error)
      alert('Failed to update group. Please try again.')
    }
  }

  const deleteGroup = async (channel: Channel) => {
    if (!confirm(`Are you sure you want to delete "${channel.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await apiCall(`/api/chat/channels/${channel._id}`, 'DELETE')

      if (response.success) {
        // Remove from channels list
        setChannels(channels.filter(ch => ch._id !== channel._id))
        
        // If this was the selected channel, clear selection
        if (selectedChannel?._id === channel._id) {
          setSelectedChannel(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete group:', error)
      alert('Failed to delete group. Please try again.')
    }
  }

  const startEditChannel = (channel: Channel) => {
    setShowChannelEditModal(channel)
    setEditChannelData({
      sortOrder: channel.sortOrder || 0
    })
  }

  const updateChannelSettings = async () => {
    if (!showChannelEditModal) return

    try {
      const response = await apiCall(`/api/chat/channels/${showChannelEditModal._id}`, 'PUT', {
        sortOrder: editChannelData.sortOrder
      })

      if (response.success) {
        // Refetch all channels to get updated sort order
        await fetchChannels()
        setShowChannelEditModal(null)
        setEditChannelData({ sortOrder: 0 })
      }
    } catch (error) {
      console.error('Failed to update channel settings:', error)
      alert('Failed to update channel settings. Please try again.')
    }
  }

  const deleteChannel = async (channel: Channel) => {
    const channelType = channel.type === 'general' ? 'general channel' : channel.type
    if (!confirm(`⚠️ WARNING: You are about to delete the ${channelType} "${channel.name}". All messages will be permanently lost. This action cannot be undone.\n\nAre you absolutely sure?`)) {
      return
    }
    
    const confirmation = prompt(`To confirm deletion, please type the exact channel name: ${channel.name}`)
    if (confirmation !== channel.name) {
      alert('Channel name did not match. Deletion cancelled.')
      return
    }

    try {
      const response = await apiCall(`/api/chat/channels/${channel._id}`, 'DELETE')
      if (response.success) {
        // Close the modal and refresh channels
        setShowChannelEditModal(null)
        setChannels(channels.filter(ch => ch._id !== channel._id))
        if (selectedChannel?._id === channel._id) {
          setSelectedChannel(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete channel:', error)
      alert('Failed to delete channel. Please try again.')
    }
  }

  const createChannel = async () => {
    if (!newChannelData.name.trim()) return

    try {
      const response = await apiCall('/api/chat/channels', 'POST', {
        name: newChannelData.name.trim(),
        description: newChannelData.description.trim(),
        type: newChannelData.type
      })

      if (response.success) {
        setChannels([...channels, response.data])
        setNewChannelData({ name: '', description: '', type: 'general' })
        setShowCreateChannelModal(false)
      }
    } catch (error) {
      console.error('Failed to create channel:', error)
      alert('Failed to create channel. Please try again.')
    }
  }

  const startManageAccess = (channel: Channel) => {
    setManagingChannel(channel)
    setShowManageAccessModal(true)
  }

  const updateChannelAccess = async (channelId: string, allowedUsers: string[]) => {
    try {
      const response = await apiCall(`/api/chat/channels/${channelId}`, 'PUT', {
        allowedUsers
      })

      if (response.success) {
        // Update the channels list
        setChannels(channels.map(ch => 
          ch._id === channelId ? response.data : ch
        ))
        
        setShowManageAccessModal(false)
        setManagingChannel(null)
      }
    } catch (error) {
      console.error('Failed to update channel access:', error)
      alert('Failed to update channel access. Please try again.')
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!selectedChannel || !user) return

    try {
      // Find the message and current reaction state
      const message = messages.find(m => m._id === messageId)
      if (!message) return

      // Optimistically update UI immediately
      const existingReaction = message.reactions?.find(r => r.emoji === emoji)
      let newReactions = [...(message.reactions || [])]
      
      if (existingReaction) {
        const userIndex = existingReaction.users.indexOf(user._id)
        if (userIndex > -1) {
          // Remove user's reaction
          existingReaction.users = existingReaction.users.filter(id => id !== user._id)
          if (existingReaction.users.length === 0) {
            newReactions = newReactions.filter(r => r.emoji !== emoji)
          } else {
            newReactions = newReactions.map(r => r.emoji === emoji ? existingReaction : r)
          }
        } else {
          // Add user's reaction
          newReactions = newReactions.map(r => 
            r.emoji === emoji ? { ...r, users: [...r.users, user._id] } : r
          )
        }
      } else {
        // Add new reaction
        newReactions.push({ emoji, users: [user._id] })
      }

      // Optimistically update local state
      setMessages(messages.map(msg => 
        msg._id === messageId ? { ...msg, reactions: newReactions } : msg
      ))

      // Send to backend
      const response = await apiCall(`/api/chat/channels/${selectedChannel._id}/messages/${messageId}/react`, 'POST', {
        emoji
      })

      if (response.success) {
        // Update with server response (in case of sync issues)
        setMessages(prev => prev.map(msg => 
          msg._id === messageId ? { ...msg, reactions: response.data.reactions } : msg
        ))

        // Emit reaction via socket for real-time updates to other users
        if (socket) {
          socket.emit('message-reaction', {
            messageId,
            channelId: selectedChannel._id,
            emoji,
            userId: user._id,
            reactions: response.data.reactions
          })
        }
      } else {
        // Revert optimistic update on error
        setMessages(messages.map(msg => 
          msg._id === messageId ? message : msg
        ))
      }
    } catch (error) {
      console.error('Failed to add reaction:', error)
      // Revert optimistic update on error
      const originalMessage = messages.find(m => m._id === messageId)
      if (originalMessage) {
        setMessages(messages.map(msg => 
          msg._id === messageId ? originalMessage : msg
        ))
      }
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!selectedChannel || !user) return

    const confirmed = confirm('Are you sure you want to delete this message? This action cannot be undone.')
    if (!confirmed) return

    try {
      const response = await apiCall(`/api/chat/channels/${selectedChannel._id}/messages/${messageId}`, 'DELETE')

      if (response.success) {
        // Remove the message from local state
        setMessages(messages.filter(msg => msg._id !== messageId))
        
        // Emit deletion via socket for real-time updates
        if (socket) {
          socket.emit('message-deleted', {
            messageId,
            channelId: selectedChannel._id
          })
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error)
      alert('Failed to delete message. Please try again.')
    }
  }

  const saveImage = async (imageUrl: string, filename?: string) => {
    try {
      // Convert to blob first
      let blob: Blob
      if (imageUrl.startsWith('data:')) {
        // Convert base64 to blob
        const response = await fetch(imageUrl)
        blob = await response.blob()
      } else {
        const response = await fetch(imageUrl)
        blob = await response.blob()
      }

      const fileName = filename || `image-${Date.now()}.png`

      // Try Web Share API first (best for mobile PWAs)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: blob.type })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Save Image',
            text: 'Image from The Women\'s Circle'
          })
          return
        }
      }

      // Try File System Access API (Chrome/Edge desktop)
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'Images',
              accept: {
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/webp': ['.webp']
              }
            }]
          })
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
          return
        } catch (err) {
          // User cancelled or error occurred
          if ((err as Error).name !== 'AbortError') {
            console.log('File System Access API failed:', err)
          }
        }
      }

      // Fallback: Traditional download (but make it smoother)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.style.display = 'none'
      
      // Add to DOM briefly, click, then remove
      document.body.appendChild(link)
      link.click()
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)

    } catch (error) {
      console.error('Failed to save image:', error)
      
      // Final fallback: copy to clipboard (mobile friendly)
      try {
        if (navigator.clipboard && 'write' in navigator.clipboard) {
          let blob: Blob
          if (imageUrl.startsWith('data:')) {
            const response = await fetch(imageUrl)
            blob = await response.blob()
          } else {
            const response = await fetch(imageUrl)
            blob = await response.blob()
          }
          
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ])
          
          alert('Image copied to clipboard! You can paste it in your photos app.')
        } else {
          // Ultimate fallback: open in new tab
          window.open(imageUrl, '_blank')
        }
      } catch (clipboardError) {
        console.error('Clipboard failed too:', clipboardError)
        window.open(imageUrl, '_blank')
      }
    }
  }

  const handleImageLongPress = (imageUrl: string, filename?: string) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
    }
    
    const timer = setTimeout(() => {
      // Directly save without confirmation for smoother UX
      saveImage(imageUrl, filename)
    }, 500) // 500ms long press
    
    setLongPressTimer(timer)
  }

  const handleImagePressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }
  
  const shouldShowDateSeparator = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return false
    const currentDate = new Date(currentMsg.createdAt).toDateString()
    const prevDate = new Date(prevMsg.createdAt).toDateString()
    return currentDate !== prevDate
  }
  
  const formatDateSeparator = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'general':
        return '#'
      case 'private':
        return '🔒'
      case 'group':
        return '👥'
      case 'direct':
        return '💬'
      default:
        return '#'
    }
  }
  
  // Helper function to get display name for direct messages
  const getChannelDisplayName = (channel: Channel | null) => {
    if (!channel || channel.type !== 'direct') return channel?.name || ''
    
    // For DMs, show only the other person's name
    // DM names are typically formatted as "User1 & User2"
    const names = channel.name.split(' & ')
    if (names.length === 2 && user) {
      // Try multiple ways to identify current user
      const currentUserFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
      const currentUserUsername = user.username || ''
      
      // Find the name that IS NOT the current user (the other person)
      const otherName = names.find(name => {
        const trimmedName = name.trim()
        
        // Try different matching strategies
        const matchesFullName = currentUserFullName && trimmedName === currentUserFullName
        const matchesUsername = currentUserUsername && trimmedName.toLowerCase().includes(currentUserUsername.toLowerCase())
        
        // Return the name that does NOT match the current user
        return !matchesFullName && !matchesUsername
      })
      
      // If we couldn't find the other name using our logic, default to the second name
      // (assuming the first name is usually the current user)
      return otherName?.trim() || names[1]?.trim() || channel.name
    }
    return channel.name
  }

  const renderChannelControls = (channel: Channel) => {
    const isCreator = user && channel.createdBy === user._id
    const isAdmin = user?.isAdmin
    const canEditGroup = (isCreator || isAdmin) && channel.type === 'group'
    const canManagePrivate = isAdmin && channel.type === 'private'
    const canManageGeneral = isAdmin && channel.type === 'general'

    return (
      <>
        {/* Group Controls */}
        {canEditGroup && (
          <button
            onClick={() => startEditGroup(channel)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Edit group"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Private Channel Controls */}
        {canManagePrivate && (
          <>
            <button
              onClick={() => startManageAccess(channel)}
              className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
              title="Manage access"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </button>
            <button
              onClick={() => startEditChannel(channel)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Channel settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </>
        )}

        {/* Admin Controls for General Channels */}
        {canManageGeneral && (
          <button
            onClick={() => startEditChannel(channel)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Channel settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 relative z-10"></div>
      </div>
    )
  }

  return (
    <motion.div 
      className="min-h-screen relative overflow-hidden flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
      
      {/* Overlay to add pink tint */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      
      {/* Content wrapper */}
      <div className="relative z-10 w-full flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-300 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {selectedChannel && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 font-mono text-lg">
                  {getChannelIcon(selectedChannel.type)}
                </span>
                <h1 className="font-semibold text-gray-900 truncate">
                  {getChannelDisplayName(selectedChannel)}
                </h1>
              </div>
            )}
          </div>
          
          {/* Channel Controls */}
          <div className="flex items-center space-x-2">
            {selectedChannel && renderChannelControls(selectedChannel)}
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Always visible on larger screens */}
      <div className="hidden lg:flex lg:w-80 bg-white border-r border-gray-300 flex-col">
        <SidebarContent 
          communityChannels={communityChannels}
          groupChannels={groupChannels}
          directMessages={directMessages}
          privateChannels={privateChannels}
          selectedChannel={selectedChannel}
          selectChannel={selectChannel}
          getChannelIcon={getChannelIcon}
          onBack={onBack}
          user={user}
          setShowCreateGroup={setShowCreateGroup}
          setShowDirectMessageModal={setShowDirectMessageModal}
          setShowCreateChannelModal={setShowCreateChannelModal}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 bg-white z-50"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <SidebarContent 
                communityChannels={communityChannels}
                groupChannels={groupChannels}
                directMessages={directMessages}
                privateChannels={privateChannels}
                selectedChannel={selectedChannel}
                selectChannel={selectChannel}
                getChannelIcon={getChannelIcon}
                onBack={onBack}
                setShowCreateGroup={setShowCreateGroup}
                setShowDirectMessageModal={setShowDirectMessageModal}
                user={user}
                onEditGroup={startEditGroup}
                onDeleteGroup={deleteGroup}
                onManageAccess={startManageAccess}
                setShowCreateChannelModal={setShowCreateChannelModal}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Desktop Header */}
        <div className="hidden lg:flex bg-white border-b border-gray-300 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            {selectedChannel ? (
              <div className="flex items-center space-x-3">
                <span className="text-gray-600 font-mono text-xl">
                  {getChannelIcon(selectedChannel.type)}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{getChannelDisplayName(selectedChannel)}</h2>
                  {selectedChannel.description && (
                    <p className="text-sm text-gray-600">{selectedChannel.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-gray-900">Select a channel</h2>
            )}
            
            {/* Channel Controls */}
            <div className="flex items-center space-x-2">
              {selectedChannel && renderChannelControls(selectedChannel)}
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-2 pt-16 lg:pt-2 pb-28">
          {selectedChannel ? (
            isLoadingMessages || isConnecting ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                  <p className="text-sm">{isConnecting ? 'Connecting to chat...' : 'Loading messages...'}</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-mono">
                      {getChannelIcon(selectedChannel.type)}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Welcome to {selectedChannel.name}!</h3>
                  <p className="text-sm">This is the beginning of your conversation.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Load more button at top */}
                {hasMoreMessages && !loadingMore && messages.length > 0 && (
                  <div className="flex justify-center py-3">
                    <button
                      onClick={loadMoreMessages}
                      className="text-sm text-white bg-pink-600 hover:bg-pink-700 px-6 py-3 rounded-full flex items-center space-x-2 active:scale-95 transition-all shadow-md"
                      style={{ 
                        minHeight: '48px',
                        touchAction: 'manipulation'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span>Tap to load older messages</span>
                    </button>
                  </div>
                )}
                {loadingMore && (
                  <div className="flex justify-center py-3">
                    <div className="flex items-center space-x-2 text-sm text-white bg-pink-600 px-6 py-3 rounded-full shadow-md">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Loading older messages...</span>
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={message._id}>
                    {/* Date Separator */}
                    {shouldShowDateSeparator(message, index > 0 ? messages[index - 1] : null) && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                          {formatDateSeparator(message.createdAt)}
                        </div>
                      </div>
                    )}
                    
                    <div className="group flex space-x-3 hover:bg-white/40 -mx-2 px-2 py-1 rounded transition-colors">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {message.author.profile?.profilePicture ? (
                          <img 
                            src={message.author.profile.profilePicture} 
                            alt={`${message.author.firstName} ${message.author.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          `${message.author.firstName?.[0] || ''}${message.author.lastName?.[0] || ''}`
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">
                            {message.author?.firstName || 'Unknown'} {message.author?.lastName || 'User'}
                          </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.createdAt)}
                    </span>
                        </div>
                        <div className={`shadow-sm rounded-2xl ${message.type === 'image' || message.type === 'voice' ? 'p-1' : 'px-3 py-2'} inline-block max-w-[85%] ${
                          user && message.author._id === user._id 
                            ? 'bg-pink-100' 
                            : 'bg-white'
                        }`}>
                          {/* Image message - with carousel for multiple images */}
                          {message.type === 'image' && message.attachments && message.attachments.length > 0 && (
                            <div className="relative select-none">
                              {message.attachments.length === 1 ? (
                                // Single image display
                                <>
                                  <img 
                                    src={message.attachments[0].url} 
                                    alt={message.content}
                                    loading="lazy"
                                    className="rounded-xl max-w-full max-h-96 object-contain cursor-pointer select-none"
                                    onClick={() => {
                                      setShowImageHint(message._id)
                                      setTimeout(() => setShowImageHint(null), 3000)
                                    }}
                                    onMouseDown={() => handleImageLongPress(message.attachments?.[0]?.url || '', message.attachments?.[0]?.filename)}
                                    onMouseUp={handleImagePressEnd}
                                    onMouseLeave={handleImagePressEnd}
                                    onTouchStart={() => handleImageLongPress(message.attachments?.[0]?.url || '', message.attachments?.[0]?.filename)}
                                    onTouchEnd={handleImagePressEnd}
                                    onContextMenu={(e) => {
                                      e.preventDefault()
                                      saveImage(message.attachments?.[0]?.url || '', message.attachments?.[0]?.filename)
                                    }}
                                    draggable={false}
                                  />
                                  
                                  {/* Hold to save hint overlay */}
                                  <AnimatePresence>
                                    {showImageHint === message._id && (
                                      <motion.div
                                        className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none rounded-xl"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <motion.div
                                          className="text-center px-6"
                                          initial={{ y: 20, opacity: 0, scale: 0.8 }}
                                          animate={{ y: 0, opacity: 1, scale: 1 }}
                                          exit={{ y: -20, opacity: 0, scale: 0.8 }}
                                          transition={{ duration: 0.4 }}
                                        >
                                          <svg className="w-10 h-10 text-white mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <p className="text-white text-sm font-medium drop-shadow-lg">
                                            Hold down to save image
                                          </p>
                                        </motion.div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </>
                              ) : (
                                // Multiple images carousel
                                <div className="relative">
                                  {/* Fixed-size container to prevent layout shift */}
                                  <div className="overflow-hidden rounded-xl relative bg-gray-100" style={{ minHeight: '300px', maxHeight: '384px' }}>
                                    <AnimatePresence mode="wait" initial={false}>
                                      <motion.img
                                        key={`${message._id}-${carouselIndexes[message._id] || 0}`}
                                        src={message.attachments[carouselIndexes[message._id] || 0].url} 
                                        alt={`Image ${(carouselIndexes[message._id] || 0) + 1}`}
                                        loading="lazy"
                                        className="max-w-full max-h-96 w-full h-full object-contain cursor-pointer select-none"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        onClick={() => {
                                          setShowImageHint(message._id)
                                          setTimeout(() => setShowImageHint(null), 3000)
                                        }}
                                        onMouseDown={() => {
                                          const currentIndex = carouselIndexes[message._id] || 0
                                          const currentAttachment = message.attachments?.[currentIndex]
                                          if (currentAttachment) {
                                            handleImageLongPress(currentAttachment.url, currentAttachment.filename)
                                          }
                                        }}
                                        onMouseUp={handleImagePressEnd}
                                        onMouseLeave={handleImagePressEnd}
                                        onTouchStart={() => {
                                          const currentIndex = carouselIndexes[message._id] || 0
                                          const currentAttachment = message.attachments?.[currentIndex]
                                          if (currentAttachment) {
                                            handleImageLongPress(currentAttachment.url, currentAttachment.filename)
                                          }
                                        }}
                                        onTouchEnd={handleImagePressEnd}
                                        onContextMenu={(e) => {
                                          e.preventDefault()
                                          const currentIndex = carouselIndexes[message._id] || 0
                                          const currentAttachment = message.attachments?.[currentIndex]
                                          if (currentAttachment) {
                                            saveImage(currentAttachment.url, currentAttachment.filename)
                                          }
                                        }}
                                        draggable={false}
                                      />
                                    </AnimatePresence>
                                  </div>
                                  
                                  {/* Carousel navigation */}
                                  {message.attachments.length > 1 && (
                                    <>
                                      <motion.button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const currentIndex = carouselIndexes[message._id] || 0
                                          const newIndex = currentIndex === 0 ? message.attachments!.length - 1 : currentIndex - 1
                                          setCarouselIndexes(prev => ({ ...prev, [message._id]: newIndex }))
                                        }}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full shadow-lg z-10 active:scale-95"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        transition={{ duration: 0.15 }}
                                      >
                                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                      </motion.button>
                                      <motion.button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const currentIndex = carouselIndexes[message._id] || 0
                                          const newIndex = currentIndex === message.attachments!.length - 1 ? 0 : currentIndex + 1
                                          setCarouselIndexes(prev => ({ ...prev, [message._id]: newIndex }))
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full shadow-lg z-10 active:scale-95"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        transition={{ duration: 0.15 }}
                                      >
                                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </motion.button>
                                      
                                      {/* Image counter */}
                                      <motion.div 
                                        className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-medium rounded-full"
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                      >
                                        {(carouselIndexes[message._id] || 0) + 1} / {message.attachments.length}
                                      </motion.div>
                                      
                                      {/* Dot indicators */}
                                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                                        {message.attachments.map((_, idx) => (
                                          <motion.button
                                            key={idx}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setCarouselIndexes(prev => ({ ...prev, [message._id]: idx }))
                                            }}
                                            className={`rounded-full transition-all ${
                                              idx === (carouselIndexes[message._id] || 0)
                                                ? 'bg-white w-4 h-2'
                                                : 'bg-white/50 w-2 h-2'
                                            }`}
                                            whileHover={{ scale: 1.2 }}
                                            whileTap={{ scale: 0.9 }}
                                          />
                                        ))}
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* Hold to save hint overlay */}
                                  <AnimatePresence>
                                    {showImageHint === message._id && (
                                      <motion.div
                                        className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none rounded-xl"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <motion.div
                                          className="text-center px-6"
                                          initial={{ y: 20, opacity: 0, scale: 0.8 }}
                                          animate={{ y: 0, opacity: 1, scale: 1 }}
                                          exit={{ y: -20, opacity: 0, scale: 0.8 }}
                                          transition={{ duration: 0.4 }}
                                        >
                                          <svg className="w-10 h-10 text-white mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <p className="text-white text-sm font-medium drop-shadow-lg">
                                            Hold down to save image
                                          </p>
                                        </motion.div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                              
                              {message.content !== 'Image' && !message.content.includes('images') && (
                                <p className="text-sm text-gray-800 mt-2 px-2 pb-1 whitespace-pre-wrap">{message.content}</p>
                              )}
                            </div>
                          )}
                          {/* Voice message */}
                          {message.type === 'voice' && message.attachments && message.attachments.length > 0 && (
                            <div className="p-2">
                              <AudioPlayer 
                                audioUrl={message.attachments[0].url} 
                                duration={message.attachments[0].duration}
                              />
                            </div>
                          )}
                          {/* Regular text message */}
                          {message.type !== 'image' && message.type !== 'voice' && (
                            <p className="text-sm break-words leading-relaxed text-gray-800 whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                        
                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                          {message.reactions.map((reaction, index) => (
                            <button
                              key={index}
                              onClick={() => addReaction(message._id, reaction.emoji)}
                              className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                                user && reaction.users.includes(user._id)
                                  ? 'bg-pink-100 border-pink-300 text-pink-700'
                                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="font-medium">{reaction.users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Reply Indicator */}
                      {message.parentMessage && (
                        <div className="mb-2 pl-3 border-l-2 border-gray-300 text-xs text-gray-600 bg-gray-50 rounded p-2">
                          <span className="font-medium">
                            Replying to {message.parentMessage.author?.firstName || 'Unknown'} {message.parentMessage.author?.lastName || 'User'}:
                          </span>
                          <p className="truncate mt-1">{message.parentMessage.content}</p>
                        </div>
                      )}

                  {/* Action Buttons (show on hover) */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex space-x-2">
                            {/* Reaction Buttons */}
                            <div className="flex space-x-1">
                              {['❤️', '🌸', '✨', '😊', '🎉'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(message._id, emoji)}
                                  className="p-1 hover:bg-gray-200 rounded text-sm transition-colors"
                                  title={`React with ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            
                            {/* Reply Button */}
                            <button
                              onClick={() => setReplyingTo(message)}
                              className="p-1 hover:bg-gray-200 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                              title="Reply to this message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                            
                            {/* Delete Button (only for own messages or if admin) */}
                            {(user && (message.author._id === user._id || user.isAdmin)) && (
                              <button
                                onClick={() => deleteMessage(message._id)}
                                className="p-1 hover:bg-red-100 rounded text-xs text-red-600 hover:text-red-800 transition-colors"
                                title="Delete message"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
                ))}
                {/* Hidden spacer element for proper scrolling */}
                <div ref={messagesEndRef} className="h-20" />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Chat!</h3>
                <p>Select a channel to start chatting with the community.</p>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        {selectedChannel && (
          <div className="bg-white border-t border-gray-300 p-4 fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto safe-bottom">
            <div className="max-w-4xl mx-auto">
              {/* Reply Indicator */}
              {replyingTo && (
                <div className="mb-3 flex items-center justify-between bg-pink-50/90 backdrop-blur-sm border border-pink-200 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 text-sm">
                      <svg className="w-4 h-4 text-pink-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span className="text-pink-700 font-medium truncate">
                        Replying to {replyingTo.author?.firstName || 'Unknown'} {replyingTo.author?.lastName || 'User'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate pl-6">{replyingTo.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1.5 hover:bg-pink-100 rounded-full text-pink-600 ml-2 flex-shrink-0"
                    title="Cancel reply"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef as any}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    onFocus={handleInputFocus}
                    onInput={(e) => {
                      // Auto-resize textarea
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = Math.min(target.scrollHeight, 150) + 'px'
                    }}
                    placeholder={replyingTo ? `Reply to ${replyingTo.author?.firstName || 'Unknown'}...` : `Message ${selectedChannel.name}...`}
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 pr-32 text-base min-h-[52px] max-h-[150px] resize-none overflow-y-auto"
                    rows={1}
                    style={{ height: '52px' }}
                  />
                  {/* Voice message button */}
                  <button 
                    onClick={() => setShowVoiceRecorder(true)}
                    className="absolute right-[104px] top-1/2 transform -translate-y-1/2 p-2.5 text-gray-500 hover:text-purple-600 cursor-pointer transition-colors"
                    title="Send voice message"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  {/* Image upload button */}
                  <label className="absolute right-14 top-1/2 transform -translate-y-1/2 p-2.5 text-gray-500 hover:text-pink-600 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </label>
                  {/* Send button */}
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2.5 text-pink-600 hover:text-pink-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateGroup(false)}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create Group</h3>
                  <button
                    onClick={() => setShowCreateGroup(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                    <input
                      type="text"
                      placeholder="Enter group name..."
                      value={newGroupData.name}
                      onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                      placeholder="What's this group about?"
                      value={newGroupData.description}
                      onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Members ({newGroupData.selectedUsers.length} selected)
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                      {allUsers.map((user) => (
                        <div
                          key={user._id}
                          className={`p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                            newGroupData.selectedUsers.includes(user._id) ? 'bg-pink-50' : ''
                          }`}
                          onClick={() => toggleUserSelection(user._id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {user.profile?.profilePicture ? (
                                <img 
                                  src={user.profile.profilePicture} 
                                  alt={`${user.firstName} ${user.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                `${user.firstName[0]}${user.lastName[0]}`
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                            {newGroupData.selectedUsers.includes(user._id) && (
                              <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateGroup(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createGroup}
                    disabled={!newGroupData.name.trim() || newGroupData.selectedUsers.length === 0}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Create Group
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Direct Message Modal */}
      <AnimatePresence>
        {showDirectMessageModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDirectMessageModal(false)}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Start Direct Message</h3>
                  <button
                    onClick={() => setShowDirectMessageModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-2">
                  {allUsers.map((user) => (
                    <div
                      key={user._id}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300"
                      onClick={() => startDirectMessage(user._id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                          {user.profile?.profilePicture ? (
                            <img 
                              src={user.profile.profilePicture} 
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            `${user.firstName[0]}${user.lastName[0]}`
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Group Modal */}
      <AnimatePresence>
        {showEditGroupModal && editingGroup && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditGroupModal(false)}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Group</h3>
                  <button
                    onClick={() => setShowEditGroupModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                    <input
                      type="text"
                      placeholder="Enter group name..."
                      value={editGroupData.name}
                      onChange={(e) => setEditGroupData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                      placeholder="What's this group about?"
                      value={editGroupData.description}
                      onChange={(e) => setEditGroupData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Members ({editGroupData.selectedUsers.length} selected)
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                      {allUsers.map((user) => (
                        <div
                          key={user._id}
                          className={`p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                            editGroupData.selectedUsers.includes(user._id) ? 'bg-pink-50' : ''
                          }`}
                          onClick={() => toggleEditUserSelection(user._id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {user.profile?.profilePicture ? (
                                <img 
                                  src={user.profile.profilePicture} 
                                  alt={`${user.firstName} ${user.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                `${user.firstName[0]}${user.lastName[0]}`
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                            {editGroupData.selectedUsers.includes(user._id) && (
                              <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => {
                      if (editingGroup) {
                        deleteGroup(editingGroup)
                        setShowEditGroupModal(false)
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete Group
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowEditGroupModal(false)}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateGroup}
                      disabled={!editGroupData.name.trim()}
                      className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Update Group
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Channel Modal (Admin Only) */}
      <AnimatePresence>
        {showCreateChannelModal && user?.isAdmin && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateChannelModal(false)}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create Channel</h3>
                  <button
                    onClick={() => setShowCreateChannelModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                    <input
                      type="text"
                      placeholder="Enter channel name..."
                      value={newChannelData.name}
                      onChange={(e) => setNewChannelData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      placeholder="What's this channel about?"
                      value={newChannelData.description}
                      onChange={(e) => setNewChannelData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Channel Type</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="channelType"
                          value="general"
                          checked={newChannelData.type === 'general'}
                          onChange={(e) => setNewChannelData(prev => ({ ...prev, type: e.target.value as 'general' | 'private' }))}
                          className="mr-2"
                        />
                        <span className="text-sm">General - Everyone can see and join</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="channelType"
                          value="private"
                          checked={newChannelData.type === 'private'}
                          onChange={(e) => setNewChannelData(prev => ({ ...prev, type: e.target.value as 'general' | 'private' }))}
                          className="mr-2"
                        />
                        <span className="text-sm">Private - Admin controls access</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateChannelModal(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createChannel}
                    disabled={!newChannelData.name.trim()}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Create Channel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Manage Access Modal (Admin Only) */}
      <AnimatePresence>
        {showManageAccessModal && managingChannel && user?.isAdmin && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManageAccessModal(false)}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Manage Access - {managingChannel.name}
                  </h3>
                  <button
                    onClick={() => setShowManageAccessModal(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Select users who can access this private channel:
                  </p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allUsers.map((user) => {
                    const isAllowed = managingChannel.allowedUsers?.includes(user._id) || false
                    return (
                      <div
                        key={user._id}
                        className={`p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 ${
                          isAllowed ? 'bg-blue-50 border-blue-300' : ''
                        }`}
                        onClick={() => {
                          const currentAllowed = managingChannel.allowedUsers || []
                          const newAllowed = isAllowed
                            ? currentAllowed.filter(id => id !== user._id)
                            : [...currentAllowed, user._id]
                          
                          setManagingChannel({
                            ...managingChannel,
                            allowedUsers: newAllowed
                          })
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {user.profile?.profilePicture ? (
                              <img 
                                src={user.profile.profilePicture} 
                                alt={`${user.firstName} ${user.lastName}`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              `${user.firstName[0]}${user.lastName[0]}`
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          {isAllowed && (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowManageAccessModal(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateChannelAccess(managingChannel._id, managingChannel.allowedUsers || [])}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update Access
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Channel Edit Modal */}
      <AnimatePresence>
        {showChannelEditModal && user?.isAdmin && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChannelEditModal(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Channel Settings</h3>
                    <button
                      onClick={() => setShowChannelEditModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                      <p className="text-lg font-semibold text-gray-900">{showChannelEditModal.name}</p>
                    </div>
                    
                    {showChannelEditModal.description && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <p className="text-gray-600">{showChannelEditModal.description}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <p className="text-gray-600 capitalize">{showChannelEditModal.type} Channel</p>
                    </div>
                    
                    {showChannelEditModal.type === 'general' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sort Order (lower number = higher in list)
                        </label>
                        <input
                          type="number"
                          value={editChannelData.sortOrder}
                          onChange={(e) => {
                            setEditChannelData({
                              sortOrder: parseInt(e.target.value) || 0
                            })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tip: Use 1, 2, 3... or 10, 20, 30... to leave room for reordering
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowChannelEditModal(null)
                        setEditChannelData({ sortOrder: 0 })
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    {showChannelEditModal.type === 'general' && (
                      <button
                        onClick={updateChannelSettings}
                        className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                      >
                        Save Changes
                      </button>
                    )}
                    <button
                      onClick={() => deleteChannel(showChannelEditModal)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Delete Channel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Voice Recorder Modal */}
      <AnimatePresence>
        {showVoiceRecorder && (
          <VoiceRecorder
            onSend={handleVoiceUpload}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Sidebar Content Component (shared between mobile and desktop)
function SidebarContent({ 
  communityChannels, 
  groupChannels, 
  directMessages, 
  privateChannels,
  selectedChannel,
  selectChannel,
  getChannelIcon,
  onBack,
  user,
  setShowCreateGroup,
  setShowDirectMessageModal,
  setShowCreateChannelModal
}: any) {
  // Helper function to get display name for direct messages
  const getDMDisplayName = (channel: Channel) => {
    if (channel.type !== 'direct') return channel.name
    
    // For DMs, show only the other person's name
    // DM names are typically formatted as "User1 & User2"
    const names = channel.name.split(' & ')
    if (names.length === 2 && user) {
      // Try multiple ways to identify current user
      const currentUserFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
      const currentUserUsername = user.username || ''
      
      // Find the name that IS NOT the current user (the other person)
      const otherName = names.find(name => {
        const trimmedName = name.trim()
        
        // Try different matching strategies
        const matchesFullName = currentUserFullName && trimmedName === currentUserFullName
        const matchesUsername = currentUserUsername && trimmedName.toLowerCase().includes(currentUserUsername.toLowerCase())
        
        // Return the name that does NOT match the current user
        return !matchesFullName && !matchesUsername
      })
      
      // If we couldn't find the other name using our logic, default to the second name
      // (assuming the first name is usually the current user)
      return otherName?.trim() || names[1]?.trim() || channel.name
    }
    return channel.name
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Chat</h1>
          <button
            onClick={onBack}
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto">
        {/* Community Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Community</h3>
            {user?.isAdmin && (
              <button
                onClick={() => setShowCreateChannelModal(true)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                title="Create Channel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
          <div className="space-y-1">
            {communityChannels.map((channel: Channel) => (
              <ChannelItem
                key={channel._id}
                channel={channel}
                isSelected={selectedChannel?._id === channel._id}
                onClick={() => selectChannel(channel)}
                icon={getChannelIcon(channel.type, channel.name)}
              />
            ))}
          </div>
        </div>

        {/* Private Channels (if any) */}
        {privateChannels.length > 0 && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Private</h3>
            </div>
            <div className="space-y-1">
              {privateChannels.map((channel: Channel) => (
                <ChannelItem
                  key={channel._id}
                  channel={channel}
                  isSelected={selectedChannel?._id === channel._id}
                  onClick={() => selectChannel(channel)}
                  icon={getChannelIcon(channel.type, channel.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Groups Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Groups</h3>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {groupChannels.map((channel: Channel) => (
              <ChannelItem
                key={channel._id}
                channel={channel}
                isSelected={selectedChannel?._id === channel._id}
                onClick={() => selectChannel(channel)}
                icon={getChannelIcon(channel.type, channel.name)}
              />
            ))}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Direct Messages</h3>
            <button 
              onClick={() => setShowDirectMessageModal(true)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {directMessages.map((channel: Channel) => (
              <ChannelItem
                key={channel._id}
                channel={{...channel, name: getDMDisplayName(channel)}}
                isSelected={selectedChannel?._id === channel._id}
                onClick={() => selectChannel(channel)}
                icon={getChannelIcon(channel.type, channel.name)}
              />
            ))}
            {directMessages.length === 0 && (
              <p className="text-xs text-gray-500 italic">No direct messages yet</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Channel Item Component
function ChannelItem({ channel, isSelected, onClick, icon }: any) {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center space-x-2 ${
        isSelected
          ? 'bg-pink-100 text-pink-800 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
    >
      <span className="text-gray-500 font-mono text-sm">{icon}</span>
      <span className="truncate">{channel.name}</span>
    </motion.button>
  )
}

export default Chat