import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void
  onCancel: () => void
}

export default function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(40).fill(0))
  const [error, setError] = useState<string | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isMountedRef = useRef(true) // Track if component is actually mounted
  const isRequestingPermissionRef = useRef(false) // Prevent double permission requests

  useEffect(() => {
    console.log('🎤 VoiceRecorder mounting...')
    isMountedRef.current = true
    
    // Only start if we don't have an active stream already
    if (!streamRef.current && !mediaRecorderRef.current) {
      startRecording()
    }
    
    // Add event listeners to ensure cleanup on page unload/visibility change
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        console.log('📱 Page hidden, stopping tracks (iOS)...')
        forceStopAllTracks()
      }
    }
    
    const handleBeforeUnload = () => {
      if (streamRef.current) {
        console.log('🚪 Page unloading, stopping tracks (iOS)...')
        forceStopAllTracks()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      console.log('🧹 VoiceRecorder cleanup called...')
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      // Only cleanup on actual unmount (not React Strict Mode)
      isMountedRef.current = false
      
      // Defer cleanup to check if remounting
      const timeoutId = setTimeout(() => {
        if (!isMountedRef.current) {
          console.log('🛑 Component actually unmounted, cleaning up...')
          cleanup()
        } else {
          console.log('✅ Component remounted, skipping cleanup')
        }
      }, 100) // 100ms delay to allow remount
      
      // Cleanup the timeout if component remounts
      return () => clearTimeout(timeoutId)
    }
  }, [])

  // iOS-specific aggressive track cleanup
  const forceStopAllTracks = () => {
    if (streamRef.current) {
      const trackCount = streamRef.current.getTracks().length
      setDebugInfo(`Stopping ${trackCount} tracks...`)
      console.log('🎤 iOS: Aggressively stopping', trackCount, 'tracks...')
      
      streamRef.current.getTracks().forEach((track, index) => {
        const beforeState = `${track.kind}:${track.readyState}:${track.enabled}`
        console.log(`🎤 iOS: Stopping track ${index}:`, track.kind, track.readyState, track.enabled)
        
        // iOS: Multiple stop approaches
        track.stop()
        track.enabled = false
        
        // Try to remove track from stream (iOS specific)
        try {
          streamRef.current?.removeTrack(track)
        } catch (e) {
          console.log('removeTrack not supported, continuing...')
        }
        
        // iOS: Try to clone and stop again (sometimes needed)
        try {
          const clonedTrack = track.clone()
          clonedTrack.stop()
          clonedTrack.enabled = false
        } catch (e) {
          // Ignore clone errors
        }
        
        const afterState = `${track.kind}:${track.readyState}:${track.enabled}`
        setDebugInfo(prev => prev + `\nTrack ${index}: ${beforeState} → ${afterState}`)
        console.log(`🎤 iOS: Track ${index} after stop:`, track.readyState, track.enabled)
      })
      
      // Completely nullify the stream
      streamRef.current = null
      setDebugInfo(prev => prev + '\nStream nullified')
      
      // iOS: Multiple cleanup attempts with different timings
      setTimeout(() => {
        console.log('🧹 iOS: First cleanup attempt...')
        setDebugInfo(prev => prev + '\nGC attempt 1')
        if (typeof window !== 'undefined') {
          if ((window as any).gc) {
            (window as any).gc()
          }
        }
      }, 0)
      
      setTimeout(() => {
        console.log('🧹 iOS: Second cleanup attempt...')
        setDebugInfo(prev => prev + '\nCache clear attempt')
        if (navigator.mediaDevices && (navigator.mediaDevices as any).clearCache) {
          (navigator.mediaDevices as any).clearCache()
        }
      }, 100)
      
      setTimeout(() => {
        console.log('🧹 iOS: Final cleanup attempt...')
        setDebugInfo(prev => prev + '\nFinal GC attempt')
        if ((window as any).gc) {
          (window as any).gc()
        }
      }, 500)
    }
  }

  const cleanup = () => {
    console.log('🧹 Cleaning up voice recorder (iOS optimized)...')
    
    // Clear permission request flag
    isRequestingPermissionRef.current = false
    
    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Stop media recorder first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        console.error('Error stopping media recorder:', err)
      }
      mediaRecorderRef.current = null
    }
    
    // iOS: Aggressive track cleanup
    forceStopAllTracks()
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Stop preview audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    
    // Revoke object URL
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    
    console.log('✅ Voice recorder cleanup complete (iOS)')
  }

  const startRecording = async () => {
    // Prevent multiple simultaneous recordings OR permission requests
    if (streamRef.current || mediaRecorderRef.current || isRequestingPermissionRef.current) {
      console.warn('⚠️ Already recording or requesting permission, skipping...')
      return
    }
    
    try {
      console.log('🎤 Starting recording...')
      setError(null)
      setDuration(0) // Reset duration
      
      // Set flag to prevent double permission requests
      isRequestingPermissionRef.current = true
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      // Store stream reference for cleanup
      streamRef.current = stream
      console.log('✅ Got media stream with', stream.getTracks().length, 'tracks')
      
      // Clear the permission request flag since we succeeded
      isRequestingPermissionRef.current = false

      // Set up audio context and analyser for visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 128
      analyserRef.current = analyser

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyser)

      // Start visualization
      visualize()

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped, processing audio...')
        
        // Don't stop tracks here - already stopped in stopRecording()
        // Just process the audio data
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setAudioURL(url)
        setAudioBlob(audioBlob)
        setIsRecording(false)
        
        // Create preview audio element
        const audio = new Audio(url)
        previewAudioRef.current = audio
        audio.addEventListener('ended', () => {
          setIsPlayingPreview(false)
        })
        
        console.log('✅ Audio processed and ready for preview')
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log('🔴 Recording started')

      // Start timer (using a more reliable approach)
      const startTime = Date.now()
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setDuration(elapsed)
      }, 100) // Update more frequently for smoother display

    } catch (err: any) {
      console.error('❌ Error accessing microphone:', err)
      setError(err.message || 'Failed to access microphone. Please check your permissions.')
      
      // Clear the permission request flag on error
      isRequestingPermissionRef.current = false
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const visualize = () => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      analyserRef.current!.getByteFrequencyData(dataArray)
      
      // Sample and normalize data for visualization
      const sampleSize = 40
      const step = Math.floor(bufferLength / sampleSize)
      const normalized = Array.from({ length: sampleSize }, (_, i) => {
        const index = Math.min(i * step, bufferLength - 1)
        return dataArray[index] / 255
      })
      
      setVisualizerData(normalized)
      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()
  }

  const stopRecording = () => {
    console.log('⏸️ Stopping recording...')
    
    // IMPORTANT: Set recording to false FIRST to prevent UI issues
    setIsRecording(false)
    
    // Stop timers and animation - use window.clearInterval for safety
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Stop the media recorder FIRST (before stopping tracks)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
        console.log('🛑 MediaRecorder stopped')
      } catch (err) {
        console.error('Error stopping recorder:', err)
      }
    }
    
    // Stop microphone tracks AFTER recorder stopped
    if (streamRef.current) {
      console.log('🎤 Stopping microphone tracks...')
      streamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop()
          console.log('🎤 Track stopped:', track.kind, track.readyState)
        }
      })
    }
  }

  const togglePreview = async () => {
    if (!previewAudioRef.current) return

    if (isPlayingPreview) {
      previewAudioRef.current.pause()
      setIsPlayingPreview(false)
    } else {
      try {
        await previewAudioRef.current.play()
        setIsPlayingPreview(true)
      } catch (err) {
        console.error('Failed to play preview:', err)
      }
    }
  }

  const handleSend = () => {
    if (audioBlob && duration > 0) {
      console.log('📤 Sending voice message...')
      
      // Force stop any remaining tracks before sending (iOS optimized)
      forceStopAllTracks()
      
      onSend(audioBlob, duration)
      cleanup()
    }
  }

  const handleCancel = () => {
    console.log('❌ Canceling recording...')
    // Force stop the recording if it's still going
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        console.error('Error stopping on cancel:', err)
      }
    }
    // Immediately stop stream tracks (iOS optimized)
    forceStopAllTracks()
    cleanup()
    onCancel()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-3xl p-6 max-w-sm w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Microphone Access Required</h3>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
          <button
            onClick={handleCancel}
            className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleCancel}
    >
      <motion.div
        className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 max-w-md w-full shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {audioURL ? 'Voice Memo' : 'Recording...'}
          </h3>
          <p className="text-sm text-gray-600">
            {audioURL ? 'Preview your recording' : 'Speak clearly into your microphone'}
          </p>
        </div>

        {/* Visualizer */}
        <div className="mb-8 h-32 bg-white/50 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-center relative">
          <div className="flex items-end justify-center space-x-1 w-full h-full">
            {visualizerData.map((value, index) => (
              <motion.div
                key={index}
                className="w-2 bg-gradient-to-t from-pink-500 to-purple-500 rounded-full"
                animate={{
                  height: audioURL 
                    ? '20%' 
                    : `${Math.max(20, value * 100)}%`
                }}
                transition={{
                  duration: 0.1,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>
          
          {/* Preview Play Button */}
          {audioURL && (
            <motion.button
              onClick={togglePreview}
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                {isPlayingPreview ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </motion.button>
          )}
        </div>

        {/* Duration Display */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-white/70 backdrop-blur-sm px-6 py-3 rounded-full">
            {isRecording && !audioURL && (
              <motion.div
                className="w-3 h-3 bg-red-500 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <span className="text-2xl font-mono font-bold text-gray-900">
              {formatDuration(duration)}
            </span>
          </div>
          
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          {!audioURL ? (
            <>
              {/* Cancel Button */}
              <motion.button
                onClick={handleCancel}
                className="p-4 bg-white/70 hover:bg-white rounded-full shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              {/* Stop Button */}
              <motion.button
                onClick={stopRecording}
                disabled={duration < 1}
                className="p-6 bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-full shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="6" y="6" width="8" height="8" rx="1" />
                </svg>
              </motion.button>
            </>
          ) : (
            <>
              {/* Discard Button */}
              <motion.button
                onClick={handleCancel}
                className="flex-1 px-6 py-4 bg-white/70 hover:bg-white rounded-2xl shadow-lg font-medium text-gray-700"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Discard
              </motion.button>

              {/* Send Button */}
              <motion.button
                onClick={handleSend}
                className="flex-1 px-6 py-4 bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-2xl shadow-lg font-medium text-white"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                Send
              </motion.button>
            </>
          )}
        </div>

        {/* Hint Text */}
        {!audioURL && duration < 1 && (
          <motion.p
            className="text-center text-xs text-gray-500 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Record at least 1 second to send
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  )
}

