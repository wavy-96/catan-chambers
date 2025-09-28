'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [currentText, setCurrentText] = useState('')
  const [showButton, setShowButton] = useState(false)
  
  const fullText = "Catan Chambers"
  
  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setCurrentText(fullText.slice(0, index + 1))
        index++
      } else {
        clearInterval(timer)
        setTimeout(() => setShowButton(true), 500)
      }
    }, 100)
    
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4 relative">
      <div className="text-center space-y-6 md:space-y-8 max-w-md mx-auto relative z-10">
        {/* Animated hexagon */}
        <motion.div
          className="mx-auto w-32 h-32 relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div 
            className="w-full h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg transform rotate-45 shadow-2xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <motion.div
              className="absolute inset-2 bg-gradient-to-r from-amber-300 to-orange-400 rounded-lg transform -rotate-45 flex items-center justify-center"
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Image src="/colonist.png" alt="Colonist icon" width={56} height={56} className="w-14 h-14 object-contain" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Animated text */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent tracking-tight font-macondo">
            {currentText}
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-1"
            >
              |
            </motion.span>
          </h1>
          
          <motion.p
            className="text-base md:text-lg text-gray-700/90 max-w-lg mx-auto leading-relaxed font-macondo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            Earn your bragging rights in the chamber
          </motion.p>
        </motion.div>

        {/* Decorative background removed for a cleaner hero */}

        {/* Enter button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: showButton ? 1 : 0, scale: showButton ? 1 : 0.8 }}
          transition={{ duration: 0.5 }}
          className="relative z-20 mt-8"
        >
          {showButton && (
            <Button
              onClick={onComplete}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 relative z-20 font-macondo"
            >
              Enter the chamber
            </Button>
          )}
        </motion.div>

        {/* Bottom decoration removed */}
      </div>
    </div>
  )
}
