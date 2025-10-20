import { motion, AnimatePresence } from 'framer-motion'
import { isIOS, isAndroid, getIOSVersion } from '../utils/pwa'

interface PWAInstallPromptProps {
  onDismiss: () => void
}

function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const isIOSDevice = isIOS()
  const isAndroidDevice = isAndroid()
  const iosVersion = getIOSVersion()
  const isIOS18OrLater = iosVersion && iosVersion >= 18

  if (!isIOSDevice && !isAndroidDevice) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl max-w-md w-full p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div className="text-center mb-4">
            <img
              src="/icons/pwa-192.png"
              alt="The Women's Circle"
              className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg"
            />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Install The Women's Circle
            </h2>
            <p className="text-gray-600 text-sm">
              Get the full app experience on your device
            </p>
          </div>

          {/* iOS Instructions */}
          {isIOSDevice && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">
                    📱
                  </span>
                  {isIOS18OrLater ? 'iOS 18+ Instructions' : 'Installation Steps'}
                </h3>
                
                {isIOS18OrLater ? (
                  // iOS 18+ has new steps
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        1
                      </span>
                      <span>Tap the <strong>three dots (•••)</strong> in the bottom right corner</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        2
                      </span>
                      <span>Tap the <strong>Share icon</strong> (square with arrow pointing up)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        3
                      </span>
                      <span>Tap the <strong>three dots (•••)</strong> that say "More" in the bottom right</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        4
                      </span>
                      <span>Select <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        5
                      </span>
                      <span>Tap <strong>"Add"</strong> to confirm</span>
                    </li>
                  </ol>
                ) : (
                  // iOS 17 and earlier
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        1
                      </span>
                      <span>Tap the <strong>Share button</strong> (square with arrow) at the bottom</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        2
                      </span>
                      <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                        3
                      </span>
                      <span>Tap <strong>"Add"</strong> to confirm</span>
                    </li>
                  </ol>
                )}

                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    💡 Tip: Look for the app icon on your home screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions */}
          {isAndroidDevice && (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">
                    📱
                  </span>
                  Installation Steps
                </h3>
                
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                      1
                    </span>
                    <span>Tap the <strong>three dots (⋮)</strong> in the top right corner</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                      2
                    </span>
                    <span>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">
                      3
                    </span>
                    <span>Tap <strong>"Install"</strong> or <strong>"Add"</strong> to confirm</span>
                  </li>
                </ol>

                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs text-green-700 font-medium">
                    💡 Tip: You'll find the app in your app drawer!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={onDismiss}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-all"
            >
              Got it!
            </button>
            <p className="text-xs text-gray-500 text-center">
              You can always install the app later from your browser menu
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PWAInstallPrompt

