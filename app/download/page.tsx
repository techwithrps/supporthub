'use client';

import { useState } from 'react';

export default function DownloadPage() {
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-100 px-6 py-5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Suyog Support Hub Logo" className="h-10 w-auto object-contain rounded-lg" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Suyog Support Hub</h1>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Official App Setup Portal</p>
            </div>
          </div>
          <a
            href="https://www.suyog.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-500/30 px-3.5 py-1.5 rounded-lg transition-all"
          >
            Go to Website →
          </a>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-12 flex flex-col items-center">
        {/* Intro */}
        <div className="text-center max-w-xl mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            Get the Support App
          </h2>
          <p className="mt-3 text-slate-500 text-sm leading-relaxed">
            Install Suyog Support Hub on your device to raise instant support issues, track queries, and receive real-time resolution updates.
          </p>
        </div>

        {/* Platform Selector Switch */}
        <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-2xl w-full max-w-md shadow-inner mb-12">
          <button
            onClick={() => setPlatform('android')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all ${
              platform === 'android'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🤖</span> Android Device (APK)
          </button>
          <a
            href="https://supporti-os.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 transition-all"
          >
            <span>🍏</span> Apple iOS User
          </a>
        </div>

        {/* GUIDE CONTENT AREA */}
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/20 rounded-full blur-3xl pointer-events-none" />

          {platform === 'android' ? (
            /* ANDROID SYSTEM SETUP */
            <div className="space-y-8">
              {/* Call-to-action button */}
              <div className="text-center pb-6 border-b border-slate-100">
                <a
                  href="/suyog-support.apk"
                  download="suyog-support.apk"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>📥</span> Download Android App (.APK)
                </a>
                <p className="mt-2.5 text-[11px] text-slate-400">File size: 83.7MB • Version 1.0.0</p>
              </div>

              {/* Step-by-step instructions */}
              <div className="space-y-6">
                <h3 className="text-sm font-extrabold text-emerald-600 uppercase tracking-wider">
                  Installation Steps:
                </h3>

                <div className="space-y-5">
                  {[
                    {
                      step: '1',
                      title: 'Download the APK',
                      desc: 'Tap the download button above. If your browser warns you about downloading .apk files, click "Download Anyway" or "OK".',
                    },
                    {
                      step: '2',
                      title: 'Open the File',
                      desc: 'Once the download is complete, open your notification shade or downloads folder and tap "suyog-support.apk".',
                    },
                    {
                      step: '3',
                      title: 'Enable Unknown Sources (First time only)',
                      desc: 'If prompted with a security alert saying installation is blocked, click "Settings" on the popup, and toggle on "Allow from this source".',
                    },
                    {
                      step: '4',
                      title: 'Confirm Installation',
                      desc: 'Return to the installer page and click "Install". The Suyog Support Hub app will be added directly to your app list.',
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4 items-start">
                      <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* IOS / IPHONE SETUP */
            <div className="space-y-8">
              {/* Call-to-action details */}
              <div className="text-center pb-6 border-b border-slate-100">
                <a
                  href="https://supporti-os.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>📱</span> Open iOS Support App
                </a>
                <p className="mt-2.5 text-[11px] text-slate-400">Launch client portal & tap share to add icon</p>
              </div>

              {/* Step-by-step instructions */}
              <div className="space-y-6">
                <h3 className="text-sm font-extrabold text-emerald-600 uppercase tracking-wider">
                  Setup Instructions (Safari):
                </h3>

                <div className="space-y-5">
                  {[
                    {
                      step: '1',
                      title: 'Open in Safari Browser',
                      desc: 'Launch the native Safari browser on your iOS device and enter the web app URL of Suyog Support Hub.',
                    },
                    {
                      step: '2',
                      title: 'Tap the "Share" Button',
                      desc: 'Tap the Share icon 📤 (the blue square box with an arrow pointing upwards) located in Safari\'s bottom navigation bar.',
                    },
                    {
                      step: '3',
                      title: 'Select "Add to Home Screen"',
                      desc: 'Scroll down the list of options in the sharing menu and click the "Add to Home Screen" ➕ option.',
                    },
                    {
                      step: '4',
                      title: 'Confirm and Enjoy Standalone App',
                      desc: 'Tap "Add" in the top-right corner. The Suyog Support Hub app icon will instantly appear on your iOS device screen like a normal native app.',
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4 items-start">
                      <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© 2026 Suyog Support Hub. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="https://www.suyog.net" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-emerald-600">
              Company Website
            </a>
            <span>•</span>
            <a href="/" className="hover:underline hover:text-emerald-600">
              Web Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
