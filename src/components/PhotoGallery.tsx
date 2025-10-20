import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PhotoGalleryProps {
  onBack: () => void
  user: { _id: string; username: string; email: string; isAdmin: boolean } | null
}

interface Photo {
  _id: string
  filename: string
  url: string
  caption?: string
  uploadedBy: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  gallery?: string
  createdAt: string
}

interface Gallery {
  _id: string
  name: string
  description?: string
  coverPhoto?: Photo
  createdBy: {
    _id: string
    firstName: string
    lastName: string
  }
  photos: string[]
  photoCount: number
  createdAt: string
}

function PhotoGallery({ onBack, user }: PhotoGalleryProps) {
  const [view, setView] = useState<'galleries' | 'all-photos' | 'gallery-detail'>('galleries')
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [caption, setCaption] = useState('')
  const [selectedGalleryId, setSelectedGalleryId] = useState<string>('')
  const [showCreateGallery, setShowCreateGallery] = useState(false)
  const [newGalleryName, setNewGalleryName] = useState('')
  const [newGalleryDescription, setNewGalleryDescription] = useState('')
  const [scrollY, setScrollY] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const [editedCaption, setEditedCaption] = useState('')
  const [showDeleteGallery, setShowDeleteGallery] = useState(false)

  useEffect(() => {
    fetchGalleries()
    fetchPhotos()
    console.log('PhotoGallery user object:', user)
  }, [user])

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchGalleries = async () => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/galleries')
      
      if (response.success) {
        setGalleries(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch galleries:', error)
    }
  }

  const fetchPhotos = async () => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/gallery')
      
      if (response.success) {
        setPhotos(response.data.photos)
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error)
      // Show fallback/empty state
    } finally {
      setLoading(false)
    }
  }

  const fetchGalleryPhotos = async (galleryId: string) => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/galleries/${galleryId}`)
      
      if (response.success) {
        setSelectedGallery(response.data)
        setGalleryPhotos(response.data.photos || [])
        setView('gallery-detail')
      }
    } catch (error) {
      console.error('Failed to fetch gallery photos:', error)
    }
  }

  const createGallery = async () => {
    if (!newGalleryName.trim()) return
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall('/api/galleries', 'POST', {
        name: newGalleryName,
        description: newGalleryDescription
      })
      
      if (response.success) {
        setGalleries([response.data, ...galleries])
        setShowCreateGallery(false)
        setNewGalleryName('')
        setNewGalleryDescription('')
      }
    } catch (error) {
      console.error('Failed to create gallery:', error)
      alert('Failed to create gallery')
    }
  }

  const deleteGallery = async () => {
    if (!selectedGallery) return
    
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/galleries/${selectedGallery._id}`, 'DELETE')
      
      if (response.success) {
        // Remove from galleries list
        setGalleries(galleries.filter(g => g._id !== selectedGallery._id))
        // Go back to galleries view
        setView('galleries')
        setSelectedGallery(null)
        setShowDeleteGallery(false)
        alert('Gallery deleted successfully')
      } else {
        alert('Failed to delete gallery: ' + response.error)
      }
    } catch (error) {
      console.error('Failed to delete gallery:', error)
      alert('Failed to delete gallery')
    }
  }

  const deletePhoto = async (photoId: string) => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/gallery/${photoId}`, 'DELETE')
      
      if (response.success) {
        // Check if this was a cover photo for any gallery
        const affectedGallery = galleries.find(g => g.coverPhoto?._id === photoId)
        
        // Update all photo lists
        const remainingPhotos = photos.filter(p => p._id !== photoId)
        const remainingGalleryPhotos = galleryPhotos.filter(p => p._id !== photoId)
        setPhotos(remainingPhotos)
        setGalleryPhotos(remainingGalleryPhotos)
        setSelectedPhoto(null)
        
        // If this was a cover photo, set a new one
        if (affectedGallery) {
          // Find the first remaining photo in this gallery
          const newCoverPhoto = remainingGalleryPhotos.find(p => p.gallery === affectedGallery._id)
          if (newCoverPhoto) {
            await apiCall(`/api/galleries/${affectedGallery._id}`, 'PUT', {
              coverPhoto: newCoverPhoto._id
            })
          } else {
            // No photos left, unset cover photo
            await apiCall(`/api/galleries/${affectedGallery._id}`, 'PUT', {
              coverPhoto: null
            })
          }
        }
        
        // Refresh galleries to update photo counts
        await fetchGalleries()
        
        // If in gallery detail view, refresh the current gallery
        if (view === 'gallery-detail' && selectedGallery) {
          await fetchGalleryPhotos(selectedGallery._id)
        }
      } else {
        console.error('Failed to delete photo:', response.error)
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  const updatePhotoCaption = async (photoId: string, newCaption: string) => {
    try {
      const { apiCall } = await import('../config/api')
      const response = await apiCall(`/api/gallery/${photoId}`, 'PUT', { caption: newCaption })
      
      if (response.success) {
        // Update in all photo lists
        setPhotos(photos.map(p => p._id === photoId ? { ...p, caption: newCaption } : p))
        setGalleryPhotos(galleryPhotos.map(p => p._id === photoId ? { ...p, caption: newCaption } : p))
        if (selectedPhoto) {
          setSelectedPhoto({ ...selectedPhoto, caption: newCaption })
        }
        setEditingCaption(false)
        setEditedCaption('')
      } else {
        console.error('Failed to update caption:', response.error)
        alert('Failed to update caption. Please try again.')
      }
    } catch (error) {
      console.error('Error updating caption:', error)
      alert('Failed to update caption. Please try again.')
    }
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Convert FileList to array and validate
    const filesArray = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []
    
    for (const file of filesArray) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        errors.push(`"${file.name}" is not an image file. Please select an image (JPG, PNG, GIF, etc.)`)
        continue
      }
      
      // Check file size (15MB limit for gallery)
      if (file.size > 15 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
        errors.push(`"${file.name}" is too large (${sizeMB}MB). Maximum file size is 15MB.`)
        continue
      }
      
      validFiles.push(file)
    }
    
    // Show errors if any
    if (errors.length > 0) {
      alert('Some files could not be uploaded:\n\n' + errors.join('\n'))
    }
    
    if (validFiles.length === 0) {
      event.target.value = ''
      return
    }
    
    // If multiple files selected, upload them directly
    if (validFiles.length > 1) {
      uploadMultipleFiles(validFiles)
    } else {
      // Single file - show preview dialog
      const file = validFiles[0]
      const url = URL.createObjectURL(file)
      setPreviewFile(file)
      setPreviewUrl(url)
      setCaption('New photo from the circle') // Default caption
      
      // If in gallery detail view, prefill the gallery selector
      if (view === 'gallery-detail' && selectedGallery) {
        setSelectedGalleryId(selectedGallery._id)
      }
    }
    
    // Reset the file input
    event.target.value = ''
  }

  const uploadMultipleFiles = async (files: File[]) => {
    try {
      setUploading(true)
      const { apiCall } = await import('../config/api')
      
      // Determine gallery ID for bulk upload
      const galleryId = view === 'gallery-detail' && selectedGallery ? selectedGallery._id : ''
      
      let uploadedCount = 0
      const uploadedPhotos: Photo[] = []
      const failedUploads: string[] = []
      
      // Upload each file with default caption
      for (const file of files) {
        try {
          const formData = new FormData()
          formData.append('photo', file)
          formData.append('caption', 'New photo from the circle')
          if (galleryId) {
            formData.append('galleryId', galleryId)
          }

          const response = await apiCall('/api/gallery/upload', 'POST', formData)
          
          if (response.success) {
            uploadedPhotos.push(response.data)
            uploadedCount++
          } else {
            failedUploads.push(`${file.name}: ${response.error || 'Unknown error'}`)
          }
        } catch (err: any) {
          failedUploads.push(`${file.name}: ${err?.message || 'Upload failed'}`)
        }
      }
      
      // Update photos list
      setPhotos([...uploadedPhotos, ...photos])
      
      // Handle gallery updates
      if (galleryId) {
        const gallery = galleries.find(g => g._id === galleryId)
        
        // Set first uploaded photo as cover if needed
        if (gallery && uploadedPhotos.length > 0 && (!gallery.coverPhoto || gallery.photoCount === 0)) {
          await apiCall(`/api/galleries/${galleryId}`, 'PUT', {
            coverPhoto: uploadedPhotos[0]._id
          })
        }
        
        // Refresh galleries and current gallery view
        await fetchGalleries()
        if (view === 'gallery-detail') {
          await fetchGalleryPhotos(galleryId)
        }
      }
      
      // Show success/failure message
      if (failedUploads.length > 0) {
        alert(`Uploaded ${uploadedCount} of ${files.length} photos.\n\nFailed uploads:\n${failedUploads.join('\n')}`)
      } else {
        alert(`✅ Successfully uploaded ${uploadedCount} photo${uploadedCount !== 1 ? 's' : ''}!`)
      }
    } catch (error: any) {
      console.error('Failed to upload photos:', error)
      
      let errorMsg = 'Failed to upload photos. Please try again.'
      
      if (error?.message?.includes('Network error')) {
        errorMsg = 'Network error. Please check your internet connection.'
      } else if (error?.message?.includes('timed out')) {
        errorMsg = 'Upload timed out. Please try again with a better connection.'
      } else if (error?.message) {
        errorMsg = error.message
      }
      
      alert(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  const confirmUpload = async () => {
    if (!previewFile) return

    // Validate caption length
    if (caption.length > 500) {
      alert('Caption is too long. Please keep it under 500 characters.')
      return
    }

    try {
      setUploading(true)
      
      const { apiCall } = await import('../config/api')
      
      const formData = new FormData()
      formData.append('photo', previewFile)
      formData.append('caption', caption)
      if (selectedGalleryId) {
        formData.append('galleryId', selectedGalleryId)
      }

      const response = await apiCall('/api/gallery/upload', 'POST', formData, 60000) // 60 second timeout for large images

      if (response.success) {
        // Add the new photo to the beginning of the list
        setPhotos([response.data, ...photos])
        
        // If uploading to a gallery, handle cover photo and refresh
        if (selectedGalleryId) {
          const uploadedPhotoId = response.data._id
          
          // Check if this gallery needs a cover photo (no cover or no photos)
          const gallery = galleries.find(g => g._id === selectedGalleryId)
          if (gallery && (!gallery.coverPhoto || gallery.photoCount === 0)) {
            // Set this as the cover photo
            await apiCall(`/api/galleries/${selectedGalleryId}`, 'PUT', {
              coverPhoto: uploadedPhotoId
            })
            // Refresh galleries list
            await fetchGalleries()
          }
          
          // If viewing this gallery, refresh it
          if (view === 'gallery-detail') {
            await fetchGalleryPhotos(selectedGalleryId)
          }
        }
        
        cancelPreview() // Close preview dialog
        alert('✅ Photo shared successfully!')
      }
    } catch (error: any) {
      console.error('Failed to upload photo:', error)
      
      let errorMsg = 'Failed to upload photo. Please try again.'
      
      if (error?.message?.includes('too large') || error?.message?.includes('15MB')) {
        errorMsg = 'Image file is too large. Maximum file size is 15MB.'
      } else if (error?.message?.includes('format') || error?.message?.includes('type')) {
        errorMsg = 'Invalid image format. Please use JPG, PNG, or GIF images.'
      } else if (error?.message?.includes('Network error')) {
        errorMsg = 'Network error. Please check your internet connection.'
      } else if (error?.message?.includes('timed out')) {
        errorMsg = 'Upload timed out. Please try again with a better connection.'
      } else if (error?.message) {
        errorMsg = error.message
      }
      
      alert(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  const cancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewFile(null)
    setPreviewUrl('')
    setCaption('')
    setSelectedGalleryId('')
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

  const photoVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden safe-area-padding flex items-center justify-center">
        <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/floral-background.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', opacity: 0.4 }} />
        <div className="fixed inset-0 z-0" style={{ backgroundColor: 'rgba(254, 227, 236, 0.3)' }} />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading photos...</p>
        </div>
      </div>
    )
  }

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
      {/* Header */}
      <motion.div 
        className="px-4 pt-6 pb-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={view === 'gallery-detail' ? () => setView('galleries') : onBack}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <h1 className="text-2xl font-bold text-gray-800">
              {view === 'gallery-detail' && selectedGallery ? selectedGallery.name : 'Photo Gallery'}
            </h1>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Delete Gallery Button - only in gallery detail view for creator */}
            {view === 'gallery-detail' && selectedGallery && user && selectedGallery.createdBy._id === user._id && (
              <motion.button
                onClick={() => setShowDeleteGallery(true)}
                className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Delete Gallery"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </motion.button>
            )}
            
            {/* Upload Button */}
            <div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
                disabled={uploading}
              />
              <motion.label
                htmlFor="photo-upload"
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">Add Photo</span>
                  </>
                )}
              </motion.label>
            </div>
          </div>
        </div>

        {/* Filter/View Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 scrollbar-hide">
          <motion.button
            onClick={() => setView('galleries')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs ${
              view === 'galleries' 
                ? 'bg-pink-600 text-white' 
                : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="font-medium">Galleries</span>
          </motion.button>
          
          <motion.button
            onClick={() => setView('all-photos')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs ${
              view === 'all-photos' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">All Photos</span>
          </motion.button>

          {view === 'galleries' && (
            <motion.button
              onClick={() => setShowCreateGallery(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap text-xs"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">New Gallery</span>
            </motion.button>
          )}
        </div>

        {/* Gallery Description - shown below filters if in gallery detail view */}
        {view === 'gallery-detail' && selectedGallery?.description && (
          <motion.div 
            className="px-4 pb-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-sm text-gray-600 bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2 break-words whitespace-normal">
              {selectedGallery.description}
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Galleries View */}
      {view === 'galleries' && (
        <motion.div 
          className="p-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="grid grid-cols-2 gap-3">
            {galleries.map((gallery) => (
              <motion.div
                key={gallery._id}
                variants={photoVariants}
                className="relative aspect-square bg-white rounded-2xl border-2 border-gray-800 overflow-hidden cursor-pointer"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.15)",
                  transition: { duration: 0.3 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fetchGalleryPhotos(gallery._id)}
              >
                {gallery.coverPhoto?.url ? (
                  <img
                    src={gallery.coverPhoto.url}
                    alt={gallery.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <svg className="w-16 h-16 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-sm font-bold truncate">{gallery.name}</p>
                  <p className="text-white/80 text-xs">{gallery.photoCount} photos</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {galleries.length === 0 && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No galleries yet</h3>
              <p className="text-gray-600 text-sm mb-4">Create your first gallery to organize photos!</p>
              <motion.button
                onClick={() => setShowCreateGallery(true)}
                className="px-6 py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Create Gallery
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* All Photos View */}
      {view === 'all-photos' && (
        <motion.div 
          className="p-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="grid grid-cols-2 gap-3">
            {photos.filter(photo => photo && photo.url).map((photo) => (
              <motion.div
                key={photo._id}
                variants={photoVariants}
                className="relative aspect-square bg-white rounded-2xl border-2 border-gray-800 overflow-hidden cursor-pointer"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.15)",
                  transition: { duration: 0.3 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                  <p className="text-white/80 text-xs">{photo.uploadedBy.firstName} {photo.uploadedBy.lastName}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {photos.length === 0 && !loading && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos yet</h3>
              <p className="text-gray-600 text-sm">Be the first to share a moment from the circle!</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Gallery Detail View */}
      {view === 'gallery-detail' && (
        <motion.div 
          className="p-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="grid grid-cols-2 gap-3">
            {galleryPhotos.filter(photo => photo && photo.url).map((photo) => (
              <motion.div
                key={photo._id}
                variants={photoVariants}
                className="relative aspect-square bg-white rounded-2xl border-2 border-gray-800 overflow-hidden cursor-pointer"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 25px 0 rgba(0, 0, 0, 0.15)",
                  transition: { duration: 0.3 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                  <p className="text-white/80 text-xs">{photo.uploadedBy.firstName} {photo.uploadedBy.lastName}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {galleryPhotos.length === 0 && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos in this gallery</h3>
              <p className="text-gray-600 text-sm">Upload photos to this gallery to get started!</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedPhoto(null)
              setShowHint(false)
            }}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-sm w-full overflow-hidden relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="aspect-square relative cursor-pointer"
                onClick={() => {
                  setShowHint(true)
                  setTimeout(() => setShowHint(false), 3000)
                }}
              >
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption}
                  className="w-full h-full object-cover"
                />
                
                {/* Hint Text Overlay - pointer-events-none so it doesn't block long press */}
                <AnimatePresence>
                  {showHint && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="text-center px-6"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <svg className="w-12 h-12 text-white mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        <p className="text-white text-lg font-semibold drop-shadow-lg">
                          Hold down to see full image or save
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-4">
                {/* Caption - editable or static */}
                {editingCaption ? (
                  <div className="mb-3">
                    <textarea
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={3}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">{editedCaption.length}/500</p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingCaption(false)
                            setEditedCaption('')
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => updatePhotoCaption(selectedPhoto._id, editedCaption)}
                          className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <h3 className="font-semibold text-gray-900 mb-1">{selectedPhoto.caption}</h3>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600">By {selectedPhoto.uploadedBy.firstName} {selectedPhoto.uploadedBy.lastName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(selectedPhoto.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                {/* Edit and Delete buttons - only for photo owner */}
                {(() => {
                  const canEdit = user && selectedPhoto.uploadedBy && user.email === selectedPhoto.uploadedBy.email;
                  return canEdit;
                })() && !editingCaption && (
                  <div className="flex space-x-2 justify-end">
                    <button
                      onClick={() => {
                        setEditingCaption(true)
                        setEditedCaption(selectedPhoto.caption || '')
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                      title="Edit caption"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => deletePhoto(selectedPhoto._id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Preview Dialog */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cancelPreview}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-md w-full overflow-hidden"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-square">
                <img
                  src={previewUrl}
                  alt="Photo preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Add Photo</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="What's happening in this photo?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">{caption.length}/500</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add to Gallery (Optional)
                  </label>
                  <select
                    value={selectedGalleryId}
                    onChange={(e) => setSelectedGalleryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">No Gallery</option>
                    {galleries.map((gallery) => (
                      <option key={gallery._id} value={gallery._id}>{gallery.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={cancelPreview}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmUpload}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Share Photo'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Gallery Modal */}
      <AnimatePresence>
        {showCreateGallery && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateGallery(false)}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-md w-full overflow-hidden"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-xl">Create New Gallery</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gallery Name *
                    </label>
                    <input
                      type="text"
                      value={newGalleryName}
                      onChange={(e) => setNewGalleryName(e.target.value)}
                      placeholder="Summer 2025, Trip to..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newGalleryDescription}
                      onChange={(e) => setNewGalleryDescription(e.target.value)}
                      placeholder="Describe this gallery..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      maxLength={500}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateGallery(false)
                      setNewGalleryName('')
                      setNewGalleryDescription('')
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createGallery}
                    disabled={!newGalleryName.trim()}
                    className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Gallery
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Gallery Confirmation Modal */}
      <AnimatePresence>
        {showDeleteGallery && selectedGallery && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteGallery(false)}
          >
            <motion.div
              className="bg-white rounded-3xl border-2 border-gray-800 max-w-md w-full overflow-hidden"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-xl text-center">Delete Gallery?</h3>
                <p className="text-gray-600 text-center mb-2">
                  Are you sure you want to delete <span className="font-semibold">"{selectedGallery.name}"</span>?
                </p>
                <p className="text-red-600 text-sm text-center mb-6">
                  This will permanently delete the gallery and all {selectedGallery.photoCount} photo{selectedGallery.photoCount !== 1 ? 's' : ''} inside it. This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteGallery(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteGallery}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete Gallery
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

export default PhotoGallery
