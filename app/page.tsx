'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // App Download Modal Popup states
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [deviceOS, setDeviceOS] = useState<'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes('android')) {
        setDeviceOS('android');
        setShowDownloadPopup(true);
      } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || (ua.includes('macintosh') && 'ontouchend' in document)) {
        setDeviceOS('ios');
        setShowDownloadPopup(true);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      
      {/* App Download Modal Overlay */}
      {showDownloadPopup && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-[#F8FAFC] rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden">
                <img src="/logo.png" alt="Suyog logo" className="w-12 h-12 object-contain" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-gray-900">Install Suyog Support</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                Experience faster response times, active status tracking, and offline support queries directly from your phone.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {deviceOS === 'android' ? (
                <a
                  href="https://expo.dev/artifacts/eas/pSV8m6Cddm9WvLXHyiGNIZr0Yons3NTijgoqI-jbQtA.apk"
                  download="suyog-support.apk"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-md transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                >
                  📥 Download Android App (.APK)
                </a>
              ) : (
                <a
                  href="/download"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-md transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                >
                  📱 Open iOS PWA Setup Portal
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowDownloadPopup(false)}
                className="w-full border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold py-3 rounded-xl text-xs transition duration-150"
              >
                Continue to Staff Login
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-md flex items-center justify-center border border-gray-100 overflow-hidden">
              <img src="/logo.png" alt="Suyog Logo" className="w-16 h-16 object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Suyog Support Hub
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Employee Dashboard Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@suyog.net"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Suyog System & Software Pvt. Ltd. · Internal Use Only
        </p>
      </div>
    </div>
  );
}
