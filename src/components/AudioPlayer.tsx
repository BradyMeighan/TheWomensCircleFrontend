import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface AudioPlayerProps {
  audioUrl: string
  duration?: number
}

export default function AudioPlayer({ audioUrl, duration: providedDuration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(providedDuration || 0)
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(30).fill(0))
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  useEffect(() => {
    // Create audio element
    const audio = new Audio()
    audio.crossOrigin = 'anonymous' // Enable CORS for audio
    audio.preload = 'metadata' // Don't preload full audio
    audioRef.current = audio

    // Set source after audio element is created
    audio.src = audioUrl

    audio.addEventListener('loadedmetadata', () => {
      if (!providedDuration) {
        setDuration(Math.floor(audio.duration))
      }
    })

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(Math.floor(audio.currentTime))
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e)
      console.error('Audio URL:', audioUrl)
    })

    // Load the audio
    audio.load()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      audio.pause()
      audio.remove()
    }
  }, [audioUrl, providedDuration])

  const setupAnalyser = () => {
    if (!audioRef.current || sourceRef.current) return

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 128
      analyserRef.current = analyser

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)
      sourceRef.current.connect(analyser)
      analyser.connect(audioContextRef.current.destination)

      visualize()
    } catch (err) {
      console.error('Failed to setup audio analyser:', err)
    }
  }

  const visualize = () => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isPlaying) return
      
      analyserRef.current!.getByteFrequencyData(dataArray)
      
      // Sample and normalize data for visualization
      const sampleSize = 30
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

  const togglePlayPause = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    } else {
      try {
        // Resume audio context if suspended (Chrome requirement)
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume()
        }
        
        // Setup analyser on first play
        if (!sourceRef.current) {
          setupAnalyser()
        }
        
        await audioRef.current.play()
        setIsPlaying(true)
        visualize()
      } catch (err) {
        console.error('Failed to play audio:', err)
      }
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration

    audioRef.current.currentTime = newTime
    setCurrentTime(Math.floor(newTime))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center space-x-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-3 min-w-[280px] max-w-[320px]">
      {/* Play/Pause Button */}
      <motion.button
        onClick={togglePlayPause}
        className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isPlaying ? (
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </motion.button>

      {/* Visualizer and Progress */}
      <div className="flex-1 min-w-0">
        {/* Waveform Visualizer */}
        <div 
          className="h-8 flex items-end justify-start space-x-0.5 cursor-pointer mb-1"
          onClick={handleSeek}
        >
          {visualizerData.map((value, index) => {
            const progress = duration > 0 ? currentTime / duration : 0
            const barProgress = index / visualizerData.length
            const isPassed = barProgress <= progress
            
            return (
              <motion.div
                key={index}
                className={`w-1 rounded-full transition-colors ${
                  isPassed 
                    ? 'bg-gradient-to-t from-pink-500 to-purple-500' 
                    : 'bg-gray-300'
                }`}
                animate={{
                  height: isPlaying 
                    ? `${Math.max(4, value * 32)}px` 
                    : '4px'
                }}
                transition={{
                  duration: 0.1,
                  ease: "easeOut"
                }}
              />
            )
          })}
        </div>

        {/* Time Display */}
        <div className="flex items-center justify-between text-xs font-medium text-gray-600">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Microphone Icon */}
      <div className="flex-shrink-0">
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>
    </div>
  )
}

