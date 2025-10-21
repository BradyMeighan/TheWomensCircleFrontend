import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import VoiceRecorder from './VoiceRecorder'
import AudioPlayer from './AudioPlayer'

// Utility function to convert URLs to clickable links
const linkifyText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

const highlightMentions = (text: string) => {
  const mentionRegex = /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  const parts = text.split(mentionRegex)
  
  return parts.map((part, index) => {
    // If this part was captured by the regex (odd indices), it's a mention
    if (index % 2 === 1) {
      return (
        <span key={index} className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded font-medium">
          @{part}
        </span>
      )
    }
    // Apply linkify to non-mention parts
    return <span key={index}>{linkifyText(part)}</span>
  })
}

interface GalaProps {
  onBack: () => void
  user: { _id: string; username: string; email: string; firstName: string; lastName: string; isAdmin: boolean; profile?: { profilePicture?: string } } | null
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
  reactions?: Array<{
    emoji: string
    users: string[]
  }>
  parentMessage?: {
    _id: string
    content: string
    author: {
      firstName: string
      lastName: string
    }
  } | null
  createdAt: string
  type?: 'text' | 'image' | 'file' | 'voice'
  edited?: boolean
  editedAt?: string
  attachments?: {
    type: 'image' | 'file' | 'voice'
    url: string
    filename?: string
    size?: number
    duration?: number
  }[]
}

const EMOJI_OPTIONS = ['❤️', '🌸', '✨', '😊', '🎉']

function Gala({ onBack, user }: GalaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [showImageHint, setShowImageHint] = useState<string | null>(null) // Track which image is showing hint
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({}) // Track carousel index for each message
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editedContent, setEditedContent] = useState('')
  
  // Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState(0)
  const [channelMembers, setChannelMembers] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    initializeGalaChat()
    
    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  // New approach: scroll to a hidden spacer element below the last message
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loadingMore) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [messages.length, loadingMore])

  // Fetch channel members when channel ID is available
  useEffect(() => {
    if (channelId) {
      fetchChannelMembers(channelId)
    }
  }, [channelId])

  // Add keyboard event listener for mention navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleMentionKeyDown(e)
    }

    if (showMentionDropdown) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showMentionDropdown, mentionSuggestions, selectedMentionIndex])

  // Load more messages via button click (removed auto-scroll)
  const handleLoadMore = () => {
    if (!loadingMore && hasMoreMessages) {
      loadMoreMessages()
    }
  }

  // Fetch channel members for mention autocomplete
  const fetchChannelMembers = async (channelId: string) => {
    try {
      const api = await import('../config/api')
      const apiCall = api.apiCall
      const response = await apiCall(`/api/chat/channels/${channelId}/members`, 'GET')
      if (response.success && response.data && response.data.length > 0) {
        setChannelMembers(response.data)
      } else {
        // Fallback: fetch all users for general channels
        try {
          const allUsersResponse = await apiCall('/api/user/all', 'GET')
          if (allUsersResponse.success && allUsersResponse.data) {
            setChannelMembers(allUsersResponse.data)
          }
        } catch (fallbackError) {
          console.error('Gala: Error fetching all users fallback:', fallbackError)
        }
      }
    } catch (error) {
      console.error('Gala: Error fetching channel members:', error)
      // Try fallback even on error
      try {
        const { apiCall: fallbackApiCall } = await import('../config/api')
        const allUsersResponse = await fallbackApiCall('/api/user/all', 'GET')
        if (allUsersResponse.success && allUsersResponse.data) {
          setChannelMembers(allUsersResponse.data)
        }
      } catch (fallbackError) {
        console.error('Gala: Fallback also failed:', fallbackError)
      }
    }
  }

  // Handle mention autocomplete
  const handleInputChange = (value: string, cursorPos?: number) => {
    setNewMessage(value)
    
    if (!inputRef.current) return
    
    const cursor = cursorPos !== undefined ? cursorPos : inputRef.current.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursor)
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase()
      const startPos = cursor - mentionMatch[0].length
      
      setMentionStartPos(startPos)
      setMentionQuery(query)
      setShowMentionDropdown(true)
      setSelectedMentionIndex(0)
      
      // Filter members based on query
      const filtered = channelMembers.filter(member => 
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) ||
        member.firstName.toLowerCase().startsWith(query) ||
        member.lastName.toLowerCase().startsWith(query)
      )
      
      setMentionSuggestions(filtered.slice(0, 10)) // Limit to 10 suggestions
    } else {
      setShowMentionDropdown(false)
      setMentionQuery('')
      setMentionSuggestions([])
    }
  }

  // Insert mention into message
  const insertMention = (member: any) => {
    const mentionText = `@${member.firstName} ${member.lastName}`
    const beforeMention = newMessage.substring(0, mentionStartPos)
    const afterMention = newMessage.substring(mentionStartPos + mentionQuery.length + 1) // +1 for @
    const newText = beforeMention + mentionText + ' ' + afterMention
    
    setNewMessage(newText)
    setShowMentionDropdown(false)
    setMentionQuery('')
    setMentionSuggestions([])
    
    // Focus back to input and set cursor position
    if (inputRef.current) {
      const newCursorPos = mentionStartPos + mentionText.length + 1
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    }
  }

  // Handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: KeyboardEvent) => {
    if (!showMentionDropdown) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedMentionIndex(prev => 
        prev < mentionSuggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedMentionIndex(prev => 
        prev > 0 ? prev - 1 : mentionSuggestions.length - 1
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (mentionSuggestions[selectedMentionIndex]) {
        insertMention(mentionSuggestions[selectedMentionIndex])
      }
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false)
      setMentionQuery('')
      setMentionSuggestions([])
    }
  }

  // Mark messages as read for Gala channel
  const markMessagesAsRead = async (galaChannelId?: string) => {
    const targetChannelId = galaChannelId || channelId
    if (!targetChannelId) return
    
    try {
      const { apiCall } = await import('../config/api')
      await apiCall(`/api/chat/mark-read/${targetChannelId}`, 'POST')
      // Reset unread count after marking as read
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark Gala messages as read:', error)
    }
  }

  // Fetch unread count for Gala
  const fetchUnreadCount = async () => {
    if (!channelId) return
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/chat/unread-counts', 'GET')
      if (response.success && response.data[channelId]) {
        setUnreadCount(response.data[channelId])
      }
    } catch (error) {
      console.error('Failed to fetch Gala unread count:', error)
    }
  }

  const initializeGalaChat = async () => {
    try {
      const api = await import('../config/api')
      const apiCall = api.apiCall
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://thewomenscirclebackend-production.up.railway.app'
      
      // Fetch initial messages
      const response = await apiCall(`/api/chat/gala-messages?page=1&limit=20`)
      if (response.success) {
        setMessages(response.data.messages)
        setHasMoreMessages(response.data.hasMore)
        setCurrentPage(1)
        setChannelId(response.data.channelId) // Store the channel ID
        
        // Mark messages as read when entering Gala
        if (response.data.channelId) {
          markMessagesAsRead(response.data.channelId)
        }
        
        // Fetch initial unread count
        fetchUnreadCount()
        
        // Scroll to bottom after messages load
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 100)
      }
      
      // Connect to socket
      const newSocket = io(API_BASE_URL, {
        auth: {
          token: localStorage.getItem('authToken')
        }
      })

      newSocket.on('connect', () => {
        console.log('✅ Connected to Gala chat')
        if (response.data.channelId) {
          newSocket.emit('join-channels', [`channel:${response.data.channelId}`])
        }
      })

      newSocket.on('new-message', (message: Message) => {
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id)
          if (exists) return prev
          return [...prev, message]
        })
        // Scroll to new message
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

      newSocket.on('message-edited', (data: { messageId: string; channelId: string; content: string; edited: boolean; editedAt: string }) => {
        console.log('✏️ Message edit received:', data)
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId ? { ...msg, content: data.content, edited: data.edited, editedAt: data.editedAt } : msg
        ))
      })

      newSocket.on('disconnect', () => {
        console.log('❌ Disconnected from Gala chat')
      })

      setSocket(newSocket)
      setLoading(false)
    } catch (error) {
      console.error('Failed to initialize Gala chat:', error)
      setLoading(false)
    }
  }

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages) return
    
    try {
      setLoadingMore(true)
      const { apiCall } = await import('../config/api')
      const nextPage = currentPage + 1
      
      const response = await apiCall(`/api/chat/gala-messages?page=${nextPage}&limit=20`)
      if (response.success) {
        setMessages(prev => [...response.data.messages, ...prev])
        setHasMoreMessages(response.data.hasMore)
        setCurrentPage(nextPage)
        // Maintain view position when loading older
        setTimeout(() => {
          if (messagesContainerRef.current) {
            // no-op here; prepend logic already preserves
          }
        }, 0)
      }
    } catch (error) {
      console.error('Failed to load more messages:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/chat/gala-message', 'POST', {
        content: newMessage.trim(),
        ...(replyingTo ? { parentMessage: replyingTo._id } : {})
      })

      if (response.success) {
        // Optimistically add the message to local state immediately
        setMessages(prev => {
          const exists = prev.some(m => m._id === response.data._id)
          if (exists) {
            return prev
          }
          return [...prev, response.data]
        })
        
        // Scroll to newly sent message
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
      }

      setNewMessage('')
      setReplyingTo(null)
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = '52px'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please try again.')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !channelId || !socket || !user) return

    // Validate each file
    const validFiles: File[] = []
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i]
      
      if (!file.type.startsWith('image/')) {
        alert(`File ${file.name} is not an image`)
        continue
      }

      if (file.size > 20 * 1024 * 1024) {
        alert(`${file.name} is larger than 20MB`)
        continue
      }
      
      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      e.target.value = ''
      return
    }

    if (validFiles.length > 5) {
      alert('You can only upload up to 5 images at once')
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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/channels/${channelId}/upload-image`, {
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
        // Add image message to local state
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.data._id)
          if (exists) {
            return prev
          }
          return [...prev, data.data]
        })
        
        // Scroll to newly sent image
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
        
        // Broadcast via socket
        socket.emit('send-gala-message', data.data)
        
        setNewMessage('')
        setReplyingTo(null)
      } else {
        alert(`Failed to upload images: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to upload images:', error)
      alert('Failed to upload images. Please try again.')
    }

    // Reset file input
    e.target.value = ''
  }

  const handleVoiceUpload = async (audioBlob: Blob, duration: number) => {
    if (!channelId || !socket || !user) return

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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/channels/${channelId}/upload-voice`, {
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
        
        // Scroll to newly sent voice message
        setTimeout(() => {
          requestAnimationFrame(() => scrollToBottom())
        }, 50)
        
        // Broadcast via socket
        socket.emit('send-gala-message', data.data)
        
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

  const addReaction = async (messageId: string, emoji: string) => {
    if (!channelId) {
      console.error('Channel ID not available')
      return
    }
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/chat/channels/${channelId}/messages/${messageId}/react`, 'POST', { emoji })
      
      if (response.success) {
        // Update local state with new reactions
        setMessages(prev => prev.map(msg => 
          msg._id === messageId ? { ...msg, reactions: response.data.reactions } : msg
        ))
      }
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!channelId || !user) return

    const confirmed = confirm('Are you sure you want to delete this message? This action cannot be undone.')
    if (!confirmed) return

    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/chat/channels/${channelId}/messages/${messageId}`, 'DELETE')

      if (response.success) {
        // Remove the message from local state
        setMessages(prev => prev.filter(msg => msg._id !== messageId))
        
        // Emit deletion via socket for real-time updates
        if (socket) {
          socket.emit('message-deleted', {
            messageId,
            channelId
          })
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error)
      alert('Failed to delete message. Please try again.')
    }
  }

  const startEditMessage = (message: Message) => {
    setEditingMessage(message)
    setEditedContent(message.content)
  }

  const cancelEditMessage = () => {
    setEditingMessage(null)
    setEditedContent('')
  }

  const saveEditMessage = async () => {
    if (!channelId || !user || !editingMessage) return
    if (!editedContent.trim()) return

    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(
        `/api/chat/channels/${channelId}/messages/${editingMessage._id}`,
        'PUT',
        { content: editedContent.trim() }
      )

      if (response.success) {
        // Update the message in local state
        setMessages(prev => prev.map(msg => 
          msg._id === editingMessage._id ? response.data : msg
        ))
        
        // Emit edit via socket for real-time updates
        if (socket) {
          socket.emit('message-edited', {
            messageId: editingMessage._id,
            channelId,
            content: response.data.content,
            edited: response.data.edited,
            editedAt: response.data.editedAt
          })
        }

        // Clear editing state
        setEditingMessage(null)
        setEditedContent('')
      }
    } catch (error) {
      console.error('Failed to edit message:', error)
      alert('Failed to edit message. Please try again.')
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

  const handleInputFocus = () => {
    // Scroll the input into view after a brief delay for mobile keyboards
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 300)
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Gala chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', opacity: 0.4 }} />
      <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
      
      {/* Header (fixed) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">Gala Chat</h1>
            <p className="text-xs text-gray-500 truncate">Community discussion</p>
          </div>
        </div>
      </div>

      {/* Spacer below fixed header */}
      <div className="h-[60px] flex-shrink-0" />

      {/* Messages Area (only scrollable area) */}
      <div ref={messagesContainerRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-2 pb-24 bg-transparent" style={{ height: 'calc(100vh - 60px - 64px)' }}>
        {/* Load more button at top */}
        {hasMoreMessages && !loadingMore && messages.length > 0 && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleLoadMore}
              className="text-sm text-white bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-full flex items-center space-x-2 active:scale-95 transition-all shadow-md"
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
            <div className="flex items-center space-x-2 text-sm text-white bg-purple-600 px-6 py-3 rounded-full shadow-md">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Loading older messages...</span>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Welcome to Gala Chat!</h3>
              <p className="text-sm">Be the first to start the conversation.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={message._id}>
                {/* Date Separator */}
                {shouldShowDateSeparator(message, index > 0 ? messages[index - 1] : null) && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium px-3 py-1 rounded-full shadow-sm">
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
                  {/* Reply Indicator */}
                  {message.parentMessage && (
                    <div className="mb-2 pl-3 border-l-2 border-purple-300 text-xs text-gray-600 bg-white/60 backdrop-blur-sm rounded p-2 max-w-full overflow-hidden">
                      <span className="font-medium break-words">
                        Replying to {message.parentMessage.author?.firstName || 'Unknown'} {message.parentMessage.author?.lastName || ''}:
                      </span>
                      <p className="mt-1 break-words overflow-wrap-anywhere">{message.parentMessage.content}</p>
                    </div>
                  )}
                  
                  <div className={`${message.type === 'voice' ? '' : 'backdrop-blur-sm shadow-sm rounded-2xl'} ${message.type === 'image' || message.type === 'voice' ? 'p-1' : 'px-3 py-2'} inline-block max-w-[85%] break-words overflow-wrap-anywhere ${
                    message.type === 'voice' ? '' : user && message.author._id === user._id 
                      ? 'bg-pink-100/95' 
                      : 'bg-white/90'
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
                            
                            {/* Carousel navigation - bigger touch targets */}
                            {message.attachments.length > 1 && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    const currentIndex = carouselIndexes[message._id] || 0
                                    const newIndex = currentIndex === 0 ? message.attachments!.length - 1 : currentIndex - 1
                                    setCarouselIndexes(prev => ({ ...prev, [message._id]: newIndex }))
                                  }}
                                  className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-start pl-2 z-20"
                                  style={{ touchAction: 'manipulation' }}
                                >
                                  <div className="p-3 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full shadow-lg active:scale-95 transition-transform">
                                    <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    const currentIndex = carouselIndexes[message._id] || 0
                                    const newIndex = currentIndex === message.attachments!.length - 1 ? 0 : currentIndex + 1
                                    setCarouselIndexes(prev => ({ ...prev, [message._id]: newIndex }))
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-end pr-2 z-20"
                                  style={{ touchAction: 'manipulation' }}
                                >
                                  <div className="p-3 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full shadow-lg active:scale-95 transition-transform">
                                    <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                                
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
                          <p className="text-sm text-gray-800 mt-2 px-2 pb-1 whitespace-pre-wrap">{highlightMentions(message.content)}</p>
                        )}
                      </div>
                    )}
                    {/* Voice message */}
                    {message.type === 'voice' && message.attachments && message.attachments.length > 0 && (
                      <AudioPlayer 
                        audioUrl={message.attachments[0].url} 
                        duration={message.attachments[0].duration}
                      />
                    )}
                    {/* Regular text message */}
                    {message.type !== 'image' && message.type !== 'voice' && (
                      <>
                        {editingMessage && editingMessage._id === message._id ? (
                          // Inline edit mode
                          <div className="space-y-2">
                            <textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={saveEditMessage}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditMessage}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Normal display mode
                          <div>
                            <p className="text-sm break-words leading-relaxed text-gray-800 whitespace-pre-wrap">
                              {highlightMentions(message.content)}
                            </p>
                            {message.edited && (
                              <span className="text-xs text-gray-500 italic ml-2">(edited)</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {message.reactions.map((reaction, index) => (
                        <button
                          key={index}
                          onClick={() => addReaction(message._id, reaction.emoji)}
                          className="inline-flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs transition-colors"
                        >
                          <span className="mr-1">{reaction.emoji}</span>
                          <span className="text-gray-600">{reaction.users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons (show on hover) */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    <div className="flex space-x-1 items-center">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(message._id, emoji)}
                            className="p-1 hover:bg-white/60 rounded text-sm transition-colors"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        
                        {/* Reply Button Icon */}
                        <button
                          onClick={() => setReplyingTo(message)}
                          className="p-1 hover:bg-white/60 rounded text-xs text-gray-600 hover:text-gray-800 transition-colors"
                          title="Reply to this message"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                        
                        {/* Edit Button (only for own text messages) */}
                        {(user && message.author._id === user._id && message.type === 'text') && (
                          <button
                            onClick={() => startEditMessage(message)}
                            className="p-1 hover:bg-blue-100/60 rounded text-xs text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        
                        {/* Delete Button (only for own messages or if admin) */}
                        {(user && (message.author._id === user._id || user.isAdmin)) && (
                          <button
                            onClick={() => deleteMessage(message._id)}
                            className="p-1 hover:bg-red-100/60 rounded text-xs text-red-600 hover:text-red-800 transition-colors"
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
        )}
      </div>

      {/* Message Input (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-200 px-3 py-3 safe-bottom">
        {/* Reply Indicator */}
        {replyingTo && (
          <div className="mb-3 flex items-center justify-between bg-purple-50/90 backdrop-blur-sm border border-purple-200 rounded-lg p-3 reply-indicator max-w-full">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center space-x-2 text-sm">
                <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-purple-700 font-medium truncate">
                  Replying to {replyingTo.author?.firstName || 'Unknown'} {replyingTo.author?.lastName || 'User'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 pl-6 break-words overflow-wrap-anywhere">{replyingTo.content}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1.5 hover:bg-purple-100 rounded-full text-purple-600 ml-2 flex-shrink-0"
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
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                // Don't handle Enter if mention dropdown is open
                if (showMentionDropdown && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape')) {
                  return // Let the mention handler deal with it
                }
                
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
              placeholder={replyingTo ? `Reply to ${replyingTo.author?.firstName || 'Unknown'}...` : 'Type a message...'}
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 pr-32 text-base min-h-[52px] max-h-[150px] resize-none overflow-y-auto"
              rows={1}
              style={{ height: '52px' }}
            />
            
            {/* Mention Autocomplete Dropdown */}
            {showMentionDropdown && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                {mentionSuggestions.map((member, index) => (
                  <div
                    key={member._id}
                    className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                      index === selectedMentionIndex ? 'bg-purple-50 border-l-2 border-purple-500' : ''
                    }`}
                    onClick={() => insertMention(member)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {member.profile?.profilePicture ? (
                        <img 
                          src={member.profile.profilePicture} 
                          alt={`${member.firstName} ${member.lastName}`}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
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
  )
}

export default Gala
