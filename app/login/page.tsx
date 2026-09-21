'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, Mail, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  // Check if session is already active — skip login page if so
  useEffect(() => {
    let mounted = true
    const checkActiveSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session?.user) {
          window.location.href = '/'
          return
        }
      } catch (err) {
        console.error('Session check failed:', err)
      } finally {
        if (mounted) setCheckingSession(false)
      }
    }

    checkActiveSession()
    return () => {
      mounted = false
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email and password.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      })

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email or password. Please verify your credentials and try again.')
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setError('Your email is not confirmed. Please check your inbox.')
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      if (data?.session) {
        // Hard navigation guarantees cookies are transferred to Server Components reliably
        window.location.href = '/'
      } else {
        setError('Login session could not be established. Please try again.')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#e3231c] animate-spin" />
          <p className="text-xs font-semibold text-white/50 tracking-wider uppercase">Verifying session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#e3231c]/10 blur-[120px] pointer-events-none animate-pulse mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="bg-[#111111]/80 backdrop-blur-2xl border border-white/[0.08] rounded-[2rem] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Top highlight */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-[#e3231c]" />
            </div>
            <Image
              src="/logo/outflank-logo.png"
              alt="Outflank"
              width={160}
              height={50}
              className="h-10 w-auto object-contain brightness-0 invert mb-2"
              priority
            />
            <p className="text-xs text-white/40 font-medium tracking-wide">Enterprise Operations Center</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/60 ml-1 uppercase tracking-wider">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-[#e3231c] transition-colors" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@outflank.in"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#e3231c]/50 focus:bg-white/10 transition-all shadow-inner text-sm"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/60 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-[#e3231c] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#e3231c]/50 focus:bg-white/10 transition-all shadow-inner text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-medium flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#e3231c] to-[#b31914] overflow-hidden hover:from-[#f42f27] hover:to-[#c41b16] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 group cursor-pointer shadow-lg shadow-[#e3231c]/20"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <div className="relative flex items-center justify-center gap-2 text-sm">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Secure Login</span>
                )}
              </div>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center border-t border-white/10 pt-6">
            <p className="text-[11px] text-white/30">
              Protected by military-grade encryption.
              <br /> Unauthorized access is strictly prohibited.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
