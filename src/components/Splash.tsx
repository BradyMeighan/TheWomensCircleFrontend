import { useState, useEffect } from 'react'

interface SplashProps {
  onComplete: () => void
}

function Splash({ onComplete }: SplashProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Start exit animation after 1.4s
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, 1400)

    // Complete transition after exit animation
    const completeTimer = setTimeout(() => {
      onComplete()
    }, 1600)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-[#ebdfdf] flex items-center justify-center p-4 safe-area-padding">
      <div
        className={`flex items-center justify-center w-full min-h-screen ${
          isExiting ? 'animate-fade-slide-up' : 'animate-fade-scale-in'
        }`}
      >
        <div className="flex items-center justify-center">
          <img
            src="/TWC logo-2.png"
            alt="The Women's Circle Logo"
            className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default Splash
