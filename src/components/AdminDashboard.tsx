import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiCall } from '../config/api'

interface AdminDashboardProps {
  onBack: () => void
  user: { username: string; email?: string; isAdmin?: boolean } | null
}

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  isAdmin: boolean
  isEmailVerified: boolean
  invitationCode: string
  lastLogin?: string
  createdAt: string
}

interface Stats {
  totalUsers: number
  adminUsers: number
  verifiedUsers: number
  recentUsers: number
  registrationsPerDay: Array<{ _id: string; count: number }>
}

interface InvitationCode {
  _id: string
  code: string
  maxUses: number
  currentUses: number
  isActive: boolean
  expiresAt?: string
  createdBy: {
    firstName: string
    lastName: string
    email: string
  }
  usedBy: Array<{
    userId: {
      firstName: string
      lastName: string
      email: string
    }
    usedAt: string
  }>
  createdAt: string
}

function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'codes' | 'stats' | 'settings'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false)
  const [newCodeData, setNewCodeData] = useState({
    maxUses: 1,
    expiresAt: ''
  })
  
  const [showCustomNotificationModal, setShowCustomNotificationModal] = useState(false)
  const [customNotification, setCustomNotification] = useState({
    title: '',
    message: '',
    type: 'general' as 'general' | 'announcement' | 'event' | 'gallery'
  })
  
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [healthCheckResults, setHealthCheckResults] = useState<any>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [generatedResetCode, setGeneratedResetCode] = useState<string | null>(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.relative')) {
        setOpenDropdown(null)
      }
    }

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])

  const performHealthCheck = async () => {
    setHealthCheckStatus('checking')
    setHealthCheckResults(null)
    
    try {
      const { apiCall } = await import('../config/api')
      
      const endpoints = [
        { name: 'Health', path: '/health' },
        { name: 'Auth', path: '/api/auth/verify' },
        { name: 'Users', path: '/api/user/all' },
        { name: 'Events', path: '/api/events' },
        { name: 'Announcements', path: '/api/announcements' },
        { name: 'Chat', path: '/api/chat/channels' },
        { name: 'Gallery', path: '/api/gallery' }
      ]
      
      const results: any = {}
      
      for (const endpoint of endpoints) {
        const startTime = Date.now()
        try {
          await apiCall(endpoint.path, 'GET')
          const responseTime = Date.now() - startTime
          results[endpoint.name] = { status: 'ok', responseTime }
        } catch (error) {
          const responseTime = Date.now() - startTime
          results[endpoint.name] = { status: 'error', responseTime }
        }
      }
      
      setHealthCheckResults(results)
      setHealthCheckStatus('success')
    } catch (error) {
      console.error('Health check failed:', error)
      setHealthCheckStatus('error')
    }
  }
  
  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const { apiCall } = await import('../config/api')
      
      // Fetch all data in parallel to prevent loading between tabs
      const [usersResponse, statsResponse, codesResponse] = await Promise.all([
        apiCall('/api/admin/users', 'GET').catch(() => ({ success: false, error: 'Failed to fetch users' })),
        apiCall('/api/admin/stats', 'GET').catch(() => ({ success: false, error: 'Failed to fetch stats' })),
        apiCall('/api/admin/invitation-codes', 'GET').catch(() => ({ success: false, data: [] }))
      ])
      
      if (usersResponse.success) {
        setUsers(usersResponse.data)
      }
      
      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
      
      if (codesResponse.success) {
        setInvitationCodes(codesResponse.data)
      }
      
    } catch (err: any) {
      console.error('Admin dashboard error:', err)
      setError(err.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const toggleUserAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall(`/api/admin/users/${userId}`, 'PUT', { isAdmin: !isAdmin })
      
      if (response.success) {
        // Update the user in the local state
        setUsers(users.map(u => 
          u._id === userId ? { ...u, isAdmin: !isAdmin } : u
        ))
      } else {
        setError(response.error || 'Failed to update user')
      }
    } catch (err: any) {
      console.error('Toggle admin error:', err)
      setError(err.message || 'Failed to update user')
    }
  }

  const createInvitationCode = async () => {
    try {
      const { apiCall } = await import('../config/api')
      
      const codeData = {
        maxUses: newCodeData.maxUses,
        isActive: true, // Always active when created
        ...(newCodeData.expiresAt && { expiresAt: newCodeData.expiresAt })
      }
      
      const response = await apiCall('/api/admin/invitation-codes', 'POST', codeData)
      
      if (response.success) {
        setInvitationCodes([response.data, ...invitationCodes])
        setShowCreateCodeModal(false)
        setNewCodeData({ maxUses: 1, expiresAt: '' })
      } else {
        setError(response.error || 'Failed to create invitation code')
      }
    } catch (error: any) {
      console.error('Error creating invitation code:', error)
      setError(error.message || 'Failed to create invitation code')
    }
  }

  const sendCustomNotification = async () => {
    try {
      if (!customNotification.title.trim() || !customNotification.message.trim()) {
        alert('Please fill in both title and message')
        return
      }

      const response = await apiCall('/api/notifications/custom', 'POST', {
        title: customNotification.title,
        body: customNotification.message,
        type: customNotification.type
      })
      
      if (response.success) {
        alert('✅ Custom notification sent to all subscribed users!')
        setShowCustomNotificationModal(false)
        setCustomNotification({
          title: '',
          message: '',
          type: 'general'
        })
      } else {
        alert('❌ Failed to send custom notification')
      }
    } catch (error) {
      console.error('Failed to send custom notification:', error)
      alert('❌ Failed to send custom notification')
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall(`/api/admin/users/${userId}`, 'DELETE')
      
      if (response.success) {
        setUsers(users.filter(u => u._id !== userId))
      } else {
        setError(response.error || 'Failed to delete user')
      }
    } catch (err: any) {
      console.error('Delete user error:', err)
      setError(err.message || 'Failed to delete user')
    }
  }

  const generateResetCode = async () => {
    if (!resetPasswordUser) return

    try {
      const { apiCall } = await import('../config/api')
      
      const response = await apiCall(`/api/admin/users/${resetPasswordUser._id}/generate-reset-code`, 'POST')
      
      if (response.success) {
        setGeneratedResetCode(response.data.code)
      } else {
        alert('Failed to generate reset code: ' + (response.error || 'Unknown error'))
      }
    } catch (err: any) {
      console.error('Generate reset code error:', err)
      alert('Failed to generate reset code: ' + (err.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ebdfdf] flex items-center justify-center safe-area-padding">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ebdfdf] safe-area-padding">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header - Match Home Style */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => setError('')}
              className="text-red-500 text-sm hover:text-red-700 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {(['users', 'codes', 'stats', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'codes' ? 'Codes' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border-2 border-gray-800">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Users ({users.length})</h2>
                <button
                  onClick={() => setShowCustomNotificationModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Send Notification
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {users.map((userData) => (
                  <div key={userData._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {userData.firstName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {userData.firstName} {userData.lastName}
                          </p>
                          {userData.isAdmin && (
                            <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded-full">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{userData.email}</p>
                      </div>
                    </div>
                    
                    {/* Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === userData._id ? null : userData._id)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                      
                      {openDropdown === userData._id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                toggleUserAdmin(userData._id, userData.isAdmin)
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              <span>{userData.isAdmin ? 'Remove Admin' : 'Make Admin'}</span>
                            </button>
                            <button
                              onClick={() => {
                                setResetPasswordUser(userData)
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              <span>Reset Password</span>
                            </button>
                            <button
                              onClick={() => {
                                deleteUser(userData._id)
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete User</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Invitation Codes Tab */}
        {activeTab === 'codes' && (
          <div className="bg-white rounded-3xl border-2 border-gray-800">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Invitation Codes ({invitationCodes.length})</h2>
                <button 
                  onClick={() => setShowCreateCodeModal(true)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm"
                >
                  Create Code
                </button>
              </div>
            </div>
            <div className="p-4">
              {invitationCodes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invitation Codes</h3>
                  <p className="text-gray-600 text-sm mb-4">Create invitation codes to invite new members</p>
                  <button className="px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors">
                    Create Your First Code
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitationCodes.map((code) => (
                    <div key={code._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="bg-gray-800 text-white px-3 py-2 rounded-lg font-mono text-sm">
                          {code.code}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {code.currentUses}/{code.maxUses} uses
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              code.isActive 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {code.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {code.expiresAt && (
                              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded-full">
                                Expires {new Date(code.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Created by {code.createdBy.firstName} {code.createdBy.lastName} on {new Date(code.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === code._id ? null : code._id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                          </svg>
                        </button>
                        
                        {openDropdown === code._id && (
                          <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                            <button
                              onClick={() => {
                                /* Toggle active status */
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <span className="mr-2">{code.isActive ? '⏸️' : '▶️'}</span>
                              {code.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(code.code)
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <span className="mr-2">📋</span>
                              Copy Code
                            </button>
                            <button
                              onClick={() => {
                                /* Delete code */
                                setOpenDropdown(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <span className="mr-2">🗑️</span>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                <div className="text-sm text-gray-600">Total Users</div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.adminUsers}</div>
                <div className="text-sm text-gray-600">Admins</div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.recentUsers}</div>
                <div className="text-sm text-gray-600">This Week</div>
              </div>
            </div>

            {/* Registration Chart */}
            {stats.registrationsPerDay.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Registrations (Last 30 Days)</h3>
                <div className="space-y-2">
                  {stats.registrationsPerDay.map((day) => (
                    <div key={day._id} className="flex items-center space-x-3">
                      <div className="text-sm text-gray-600 w-20">{day._id}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(day.count / Math.max(...stats.registrationsPerDay.map(d => d.count))) * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium text-gray-900 w-8">{day.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl border-2 border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h2>
            <div className="space-y-6">
              
              {/* Server Health Check */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">Server Health Status</h3>
                  <button
                    onClick={performHealthCheck}
                    disabled={healthCheckStatus === 'checking'}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      healthCheckStatus === 'checking'
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {healthCheckStatus === 'checking' ? (
                      <span className="flex items-center space-x-1">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Checking...</span>
                      </span>
                    ) : 'Run Health Check'}
                  </button>
                </div>
                
                {healthCheckStatus === 'idle' && (
                  <p className="text-sm text-gray-600">Click the button to check server status</p>
                )}
                
                {healthCheckStatus === 'success' && healthCheckResults && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-green-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">All systems operational</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 pl-7">
                      {Object.entries(healthCheckResults).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span>{key}</span>
                          <span className={value.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
                            {value.status === 'ok' ? '✓' : '✗'} {value.responseTime}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {healthCheckStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Health check failed</span>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">System Information</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Environment: Production</p>
                  <p>API Version: 1.0.0</p>
                  <p>Last Updated: {new Date().toLocaleDateString()}</p>
                  <p>Database: MongoDB</p>
                  <p>Storage: Railway Volume</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-4">App Features</h3>
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ User Management</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Active</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Profile System</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Active</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Image Upload</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">WebP</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Chat System</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">WebSocket</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Events & RSVP</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Stripe</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Photo Gallery</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Active</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-green-800">✅ Push Notifications</div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Service Worker</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Code Modal */}
      <AnimatePresence>
        {showCreateCodeModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateCodeModal(false)}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-md w-full overflow-hidden"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Invitation Code</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newCodeData.maxUses}
                      onChange={(e) => setNewCodeData({...newCodeData, maxUses: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newCodeData.expiresAt}
                      onChange={(e) => setNewCodeData({...newCodeData, expiresAt: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateCodeModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createInvitationCode}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Create Code
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Notification Modal */}
      {showCustomNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border-2 border-gray-800 w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Send Custom Notification</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={customNotification.title}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="Notification title..."
                  maxLength={50}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={customNotification.message}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="Notification message..."
                  rows={3}
                  maxLength={200}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={customNotification.type}
                  onChange={(e) => setCustomNotification(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="general">General</option>
                  <option value="announcement">Announcement</option>
                  <option value="event">Event</option>
                  <option value="gallery">Gallery</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomNotificationModal(false)
                  setCustomNotification({ title: '', message: '', type: 'general' })
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendCustomNotification}
                disabled={!customNotification.title.trim() || !customNotification.message.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send Notification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border-2 border-gray-800 w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Generate Password Reset Code
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                For: <span className="font-semibold">{resetPasswordUser.firstName} {resetPasswordUser.lastName}</span>
              </p>
              <p className="text-sm text-gray-600">
                Email: <span className="font-semibold">{resetPasswordUser.email}</span>
              </p>
            </div>

            {!generatedResetCode ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    This will generate a unique 8-character code that the user can use to reset their password. 
                    The code will be valid for 24 hours.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setResetPasswordUser(null)
                      setGeneratedResetCode(null)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateResetCode}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Generate Code
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-4 text-center">
                  <p className="text-sm text-green-800 mb-2">Reset code generated successfully!</p>
                  <div className="bg-white border-2 border-green-500 rounded-lg p-4 mb-3">
                    <p className="text-3xl font-bold text-gray-900 tracking-wider">{generatedResetCode}</p>
                  </div>
                  <p className="text-xs text-green-700">
                    Valid for 24 hours • Share this code with the user
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">Instructions for User:</p>
                  <ol className="text-xs text-yellow-800 space-y-1 list-decimal list-inside">
                    <li>Go to the login page and click "Forgot Password"</li>
                    <li>Enter their email address: {resetPasswordUser.email}</li>
                    <li>Enter the reset code: {generatedResetCode}</li>
                    <li>Create a new password</li>
                  </ol>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedResetCode)
                      alert('Reset code copied to clipboard!')
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Copy Code
                  </button>
                  <button
                    onClick={() => {
                      setResetPasswordUser(null)
                      setGeneratedResetCode(null)
                    }}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard