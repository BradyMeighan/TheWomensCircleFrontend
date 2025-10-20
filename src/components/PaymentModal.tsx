import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { apiCall } from '../config/api'

interface PaymentModalProps {
  event: {
    _id: string
    title: string
    price: number
    eventDate: string
    eventTime: string
  }
  onClose: () => void
  onSuccess: () => void
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1f2937',
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: false,
}

function PaymentModal({ event, onClose, onSuccess }: PaymentModalProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Create payment intent
      const response = await apiCall('/api/stripe/create-payment-intent', 'POST', {
        eventId: event._id
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to create payment intent')
      }

      const { clientSecret } = response

      // Get card element
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Confirm payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (result.error) {
        setError(result.error.message || 'Payment failed')
        setProcessing(false)
      } else if (result.paymentIntent?.status === 'succeeded') {
        // Payment successful!
        console.log('✅ Payment successful!')
        onSuccess()
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'An error occurred during payment')
      setProcessing(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl border-2 border-gray-800 max-w-md w-full p-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Payment
          </h2>
          <p className="text-gray-600">
            Secure payment for <span className="font-semibold">{event.title}</span>
          </p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Total Amount:</span>
            <span className="text-2xl font-bold text-gray-900">
              ${event.price.toFixed(2)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Card Information
            </label>
            <div className="border-2 border-gray-300 rounded-xl p-4 focus-within:border-purple-500 transition-colors">
              <CardElement
                options={CARD_ELEMENT_OPTIONS}
                onChange={(e) => setCardComplete(e.complete)}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stripe || processing || !cardComplete}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {processing ? 'Processing...' : `Pay $${event.price.toFixed(2)}`}
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-center text-xs text-gray-500">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured by Stripe
        </div>
      </motion.div>
    </motion.div>
  )
}

export default PaymentModal


