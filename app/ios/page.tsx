'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Tally Serial validation: Must be exactly 9 digits.
const validateTallySerial = (serial: string): boolean => {
  const clean = serial.replace(/\s+/g, '');
  return /^\d{9}$/.test(clean);
};

// Email validation
const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

interface Ticket {
  id: string;
  customer_name: string;
  tally_serial: string;
  email: string;
  mobile: string;
  issue_type: string;
  description: string;
  status: 'pending' | 'assigned' | 'resolved';
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  feedback?: {
    rating: number | null;
    comments: string | null;
    resolution_notes?: string | null;
  } | null;
}

export default function IosAppPortal() {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'hub' | 'raise_query_form' | 'new_enquiry_form' | 'query_list'>('splash');
  
  // Issue Form states
  const [queryName, setQueryName] = useState('');
  const [querySerialOrEmail, setQuerySerialOrEmail] = useState('');
  const [queryMobile, setQueryMobile] = useState('');
  const [queryType, setQueryType] = useState('Select your query type');
  const [queryDesc, setQueryDesc] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Enquiry Form states
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryType, setEnquiryType] = useState('');
  const [enquiryDetails, setEnquiryDetails] = useState('');
  
  // Validation / Loading states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Local tickets history states
  const [savedTicketIds, setSavedTicketIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  // Rating Modal states
  const [ratingTicket, setRatingTicket] = useState<Ticket | null>(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  // PWA Install states
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIosMobile, setIsIosMobile] = useState(false);

  // PWA Web Push states
  const [pushPermissionState, setPushPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const issueTypes = [
    'New TallyPrime',
    'Tss Renewal',
    'Tally on Cloud',
    'Tally Customisation',
    'Others',
  ];

  // Splash Screen Timeout
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('hub');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Load local ticket IDs and setup PWA prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Register PWA service worker for notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('Service Worker registered successfully:', reg))
          .catch((err) => console.error('Service Worker registration failed:', err));
      }

      // Check Web Push support and permissions
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushPermissionState('unsupported');
      } else {
        if (Notification.permission === 'granted') {
          setPushPermissionState('granted');
          navigator.serviceWorker.ready.then(async (reg) => {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              localStorage.setItem('suyog_pwa_push_subscription', JSON.stringify(sub));
              setIsSubscribed(true);
            }
          });
        } else if (Notification.permission === 'denied') {
          setPushPermissionState('denied');
        }
      }

      // Load stored ticket IDs
      const stored = localStorage.getItem('suyog_ticket_ids');
      if (stored) {
        try {
          const ids = JSON.parse(stored);
          if (Array.isArray(ids)) {
            setSavedTicketIds(ids);
          }
        } catch (e) {
          console.error('Error parsing stored ticket IDs', e);
        }
      }

      // Check if already running as PWA standalone
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone;

      if (!isStandalone) {
        // Capture Android beforeinstallprompt
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e);
          setShowPwaPrompt(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Detect iOS/macOS device (including Macintosh desktop for testing)
        const ua = window.navigator.userAgent.toLowerCase();
        const isIos = ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('macintosh');
        if (isIos) {
          setIsIosMobile(true);
          setShowPwaPrompt(true);
        }

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
      }
    }
  }, []);

  // Pre-fill contact details on screen navigation
  useEffect(() => {
    if (currentScreen === 'raise_query_form') {
      const lastContact = localStorage.getItem('suyog_last_contact_details');
      if (lastContact) {
        try {
          const details = JSON.parse(lastContact);
          if (details) {
            if (!queryName) setQueryName(details.name || '');
            if (!querySerialOrEmail) setQuerySerialOrEmail(details.serialOrEmail || '');
            if (!queryMobile) setQueryMobile(details.mobile || '');
          }
        } catch (e) {
          console.error('Error parsing cached contact details', e);
        }
      }
      setQueryType('Select your query type');
      setQueryDesc('');
    }
  }, [currentScreen]);

  // Fetch ticket status updates
  const fetchTicketHistory = async () => {
    if (savedTicketIds.length === 0) {
      setTickets([]);
      return;
    }
    setFetchingHistory(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .in('id', savedTicketIds);
      
      if (error) throw error;
      
      if (data) {
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTickets(sorted);
      }
    } catch (err) {
      console.error('Error fetching ticket history:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  // Poll for updates when on relevant screens
  useEffect(() => {
    if (currentScreen === 'query_list' || currentScreen === 'hub') {
      fetchTicketHistory();
      const interval = setInterval(fetchTicketHistory, 10000); // 10s poll
      return () => clearInterval(interval);
    }
  }, [savedTicketIds, currentScreen]);

  // Input Validation on Blur for tickets
  const handleSerialOrEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target.value.trim();
    if (!input) {
      setFormErrors((prev) => ({ ...prev, querySerialOrEmail: '' }));
      return;
    }

    if (input.includes('@')) {
      if (!validateEmail(input)) {
        setFormErrors((prev) => ({ ...prev, querySerialOrEmail: 'Invalid Tally Net Email_id' }));
      } else {
        setFormErrors((prev) => ({ ...prev, querySerialOrEmail: '' }));
      }
    } else {
      if (!validateTallySerial(input)) {
        setFormErrors((prev) => ({ ...prev, querySerialOrEmail: 'Invalid Tally Serial No. (must be exactly 9 digits)' }));
      } else {
        setFormErrors((prev) => ({ ...prev, querySerialOrEmail: '' }));
      }
    }
  };

  // Trigger Android/Chrome Install Prompt
  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowPwaPrompt(false);
  };

  // Request Web Push Subscription for PWA
  const handleSubscribeNotifications = async () => {
    if (typeof window === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushPermissionState(permission === 'default' ? 'prompt' : permission);
        return;
      }
      
      setPushPermissionState('granted');
      const registration = await navigator.serviceWorker.ready;
      
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('VAPID public key is missing');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      const subscriptionStr = JSON.stringify(subscription);
      localStorage.setItem('suyog_pwa_push_subscription', subscriptionStr);
      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe to PWA Push:', err);
    }
  };

  // Submit Ticket (Raise Issue)
  const handleRaiseQuerySubmit = async () => {
    const errors: Record<string, string> = {};
    if (!queryName.trim()) errors.queryName = 'Company name/Contact person is required';
    if (!queryMobile.trim() || queryMobile.length < 10)
      errors.queryMobile = 'Enter a valid 10-digit phone number';
    if (queryType === 'Others' && !queryDesc.trim()) {
      errors.queryDesc = 'Please describe your issue';
    }
    if (queryType === 'Select your query type') errors.queryType = 'Please select an issue type';

    const input = querySerialOrEmail.trim();
    if (!input) {
      errors.querySerialOrEmail = 'Tally Serial or Tally Net Email_id is required';
    } else if (input.includes('@')) {
      if (!validateEmail(input)) {
        errors.querySerialOrEmail = 'Invalid Tally Net Email_id';
      }
    } else {
      if (!validateTallySerial(input)) {
        errors.querySerialOrEmail = 'Invalid Tally Serial No. (must be exactly 9 digits)';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setLoading(true);
    try {
      const isEmail = input.includes('@');
      const savedPushSubscription = typeof window !== 'undefined' ? localStorage.getItem('suyog_pwa_push_subscription') : null;
      const insertData = {
        customer_name: queryName,
        tally_serial: isEmail ? 'N/A' : input,
        email: isEmail ? input : 'N/A',
        mobile: queryMobile,
        issue_type: queryType,
        description: queryDesc,
        status: 'pending',
        push_token: savedPushSubscription || null,
      };

      const { data, error } = await supabase
        .from('tickets')
        .insert([insertData])
        .select('id')
        .single();

      if (error) throw error;

      if (data?.id) {
        const updatedIds = [...savedTicketIds, data.id];
        localStorage.setItem('suyog_ticket_ids', JSON.stringify(updatedIds));
        
        // Save contact details for auto-fill on next launch
        localStorage.setItem('suyog_last_contact_details', JSON.stringify({
          name: queryName,
          serialOrEmail: input,
          mobile: queryMobile,
        }));
        
        setSavedTicketIds(updatedIds);

        setQueryName('');
        setQuerySerialOrEmail('');
        setQueryMobile('');
        setQueryType('Select your query type');
        setQueryDesc('');
        setSubmitSuccess(true);
        
        setTimeout(() => {
          setSubmitSuccess(false);
          setCurrentScreen('hub');
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + (err.message || 'Could not submit request.'));
    } finally {
      setLoading(false);
    }
  };

  // Submit Enquiry
  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!enquiryName.trim()) errors.enquiryName = 'Name is required';
    if (!enquiryPhone.trim() || enquiryPhone.length < 10)
      errors.enquiryPhone = 'Enter a valid 10-digit phone number';
    if (!enquiryType)
      errors.enquiryType = 'Please select an enquiry type';
    if (enquiryType === 'Others' && !enquiryDetails.trim())
      errors.enquiryDetails = 'Description details are required for Others option';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setLoading(true);
    try {
      const { error } = await supabase
        .from('enquiries')
        .insert({
          name: enquiryName,
          phone: enquiryPhone,
          details: enquiryDetails || 'No details provided',
          enquiry_type: enquiryType,
        });

      if (error) throw error;

      setEnquiryName('');
      setEnquiryPhone('');
      setEnquiryType('');
      setEnquiryDetails('');
      setSubmitSuccess(true);

      setTimeout(() => {
        setSubmitSuccess(false);
        setCurrentScreen('hub');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + (err.message || 'Could not submit enquiry.'));
    } finally {
      setLoading(false);
    }
  };

  // Submit Feedback Rating
  const handleFeedbackSubmit = async () => {
    if (!ratingTicket) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          feedback: {
            rating: ratingVal,
            comments: feedbackText.trim() || null,
            resolution_notes: ratingTicket.feedback?.resolution_notes || null,
          },
        })
        .eq('id', ratingTicket.id);

      if (error) throw error;

      setRatingTicket(null);
      setFeedbackText('');
      setRatingVal(5);
      fetchTicketHistory();
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Could not save rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-4 select-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <title>Suyog Support</title>
      <meta name="apple-mobile-web-app-title" content="Suyog Support" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      
      {/* Standalone Simulator Frame */}
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[812px] sm:rounded-[36px] sm:shadow-2xl overflow-hidden flex flex-col border-0 sm:border-8 border-slate-900 relative">
        
        {/* APP BODY SCROLL AREA */}
        <div className="flex-grow flex flex-col justify-between overflow-y-auto">
          
          {/* SCREEN 1: SPLASH SCREEN */}
          {currentScreen === 'splash' && (
            <div className="flex-grow bg-white flex flex-col items-center justify-center min-h-[600px] relative">
              <div className="flex flex-col items-center animate-pulse">
                <img
                  src="/logo.png"
                  alt="Suyog logo"
                  className="w-[240px] h-[80px] object-contain mb-5"
                />
                <h1 
                  className="text-3xl italic font-bold text-[#0F172A] tracking-tight"
                  style={{ fontFamily: '"Times New Roman", Georgia, serif' }}
                >
                  Suyog Support Hub
                </h1>
              </div>
              <div className="absolute bottom-16">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          {/* SCREEN 2: HUB SCREEN */}
          {currentScreen === 'hub' && (
            <div className="flex-grow bg-[#F8FAFC] flex flex-col justify-between min-h-[750px] p-6 pt-16">
              
              {/* Header Logo */}
              <div className="flex flex-col items-center mb-10">
                <img
                  src="/logo.png"
                  alt="Suyog Support Hub Logo"
                  className="w-[200px] h-[70px] object-contain mb-4"
                />
                <h1 
                  className="text-3xl italic font-bold text-[#0F172A]"
                  style={{ fontFamily: '"Times New Roman", Georgia, serif' }}
                >
                  Suyog Support Hub
                </h1>
              </div>

              {/* Notification Banner Option */}
              {pushPermissionState !== 'granted' && !isSubscribed ? (
                <div className="mx-6 mb-2 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 rounded-[20px] p-4.5 text-xs shadow-sm flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-extrabold text-indigo-900 mb-0.5">🔔 Live Updates Alert</p>
                    <p className="text-indigo-600/90 leading-relaxed font-semibold">Enable push notifications to receive instant updates when support tickets resolve.</p>
                  </div>
                  <button
                    onClick={handleSubscribeNotifications}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold px-3 py-2.5 rounded-xl shadow-sm transition whitespace-nowrap active:scale-95"
                  >
                    Enable Alerts
                  </button>
                </div>
              ) : isSubscribed ? (
                <p className="text-center text-[10px] text-emerald-600 font-bold tracking-wider uppercase mb-2">
                  🛡️ Live Push Alerts Enabled
                </p>
              ) : null}

              {/* Action Buttons */}
              <div className="space-y-4 flex-grow flex flex-col justify-center px-6">
                
                {/* Raise Issue Card */}
                <button
                  onClick={() => setCurrentScreen('raise_query_form')}
                  className="w-full bg-white hover:bg-slate-50 border-1.5 border-slate-200 rounded-[20px] p-6 text-left shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col"
                >
                  <span className="text-xl font-bold text-[#0F172A] mb-1">Raise Issue</span>
                  <span className="text-xs text-[#64748B]">File support requests, issues and tickets</span>
                </button>

                {/* New Enquiry Card */}
                <button
                  onClick={() => setCurrentScreen('new_enquiry_form')}
                  className="w-full bg-white hover:bg-slate-50 border-1.5 border-slate-200 rounded-[20px] p-6 text-left shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col"
                >
                  <span className="text-xl font-bold text-[#0F172A] mb-1">New Enquiry</span>
                  <span className="text-xs text-[#64748B]">Get product catalog, pricing, demo calls</span>
                </button>

                {/* View Records Card */}
                {savedTicketIds.length > 0 && (
                  <button
                    onClick={() => {
                      setCurrentScreen('query_list');
                      fetchTicketHistory();
                    }}
                    className="w-full bg-emerald-50 hover:bg-emerald-100/70 border-1.5 border-emerald-200 rounded-[20px] p-6 text-left shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col"
                  >
                    <span className="text-xl font-bold text-emerald-800 mb-1">📋 View Records</span>
                    <span className="text-xs text-emerald-600">Track your existing tickets & ratings</span>
                  </button>
                )}
              </div>

              {/* Hub Footer */}
              <div className="text-center mt-10">
                <p className="text-xs text-slate-400 font-medium">Visit official website</p>
                <a
                  href="https://www.suyog.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-500 font-semibold underline mt-1 inline-block"
                >
                  www.suyog.net
                </a>
              </div>

            </div>
          )}

          {/* SCREEN 3: RAISE QUERY FORM */}
          {currentScreen === 'raise_query_form' && (
            <div className="flex-grow bg-[#F8FAFC] min-h-[750px] p-5">
              
              {/* Form Header */}
              <div className="flex items-center justify-between mb-6 bg-white border-b border-slate-100 px-4 py-3 -mx-5 -mt-5">
                <button
                  onClick={() => setCurrentScreen('hub')}
                  className="text-slate-400 hover:text-slate-600 font-semibold text-sm py-1 flex items-center"
                >
                  ← Hub
                </button>
                <h2 className="text-lg font-bold text-[#0F172A]">Raise Issue</h2>
                {savedTicketIds.length > 0 && (
                  <button
                    onClick={() => {
                      setCurrentScreen('query_list');
                      fetchTicketHistory();
                    }}
                    className="bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#475569] hover:bg-slate-200 transition"
                  >
                    View Records
                  </button>
                )}
              </div>

              {submitSuccess ? (
                <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center py-16 mt-4">
                  <span className="text-5xl mb-4">✅</span>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Issue Raised Successfully!</h3>
                  <p className="text-sm text-slate-500 text-center">We will address your request shortly.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] space-y-4">
                  
                  {/* Customer Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Company Name / Contact Person</label>
                    <input
                      type="text"
                      placeholder="Enter Company Name / Contact Person"
                      value={queryName}
                      onChange={(e) => setQueryName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.queryName ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.queryName && <p className="text-[11px] text-red-500 font-bold">{formErrors.queryName}</p>}
                  </div>

                  {/* Tally Serial or Email */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Tally Serial No. or Tally Net Email_id</label>
                    <input
                      type="text"
                      placeholder="9-digit serial or Tally Net Email_id"
                      value={querySerialOrEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        let clean = val;
                        if (/^\d+$/.test(val)) {
                          clean = val.slice(0, 9);
                        }
                        setQuerySerialOrEmail(clean);
                        if (formErrors.querySerialOrEmail) {
                          setFormErrors((prev) => ({ ...prev, querySerialOrEmail: '' }));
                        }
                      }}
                      onBlur={handleSerialOrEmailBlur}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.querySerialOrEmail ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.querySerialOrEmail && <p className="text-[11px] text-red-500 font-bold">{formErrors.querySerialOrEmail}</p>}
                  </div>

                  {/* Mobile */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Mobile No.</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={queryMobile}
                      onChange={(e) => setQueryMobile(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.queryMobile ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.queryMobile && <p className="text-[11px] text-red-500 font-bold">{formErrors.queryMobile}</p>}
                  </div>

                  {/* Issue Type Selector */}
                  <div className="space-y-1.5 relative">
                    <label className="block text-xs font-semibold text-slate-600">Type of Issue</label>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-between transition ${
                        formErrors.queryType ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC]'
                      }`}
                    >
                      <span className={queryType === 'Select your query type' ? 'text-slate-400' : 'text-slate-800'}>
                        {queryType}
                      </span>
                      <span className="text-[10px] text-slate-400">{showDropdown ? '▲' : '▼'}</span>
                    </button>
                    {formErrors.queryType && <p className="text-[11px] text-red-500 font-bold">{formErrors.queryType}</p>}

                    {showDropdown && (
                      <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {issueTypes.map((type) => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => {
                              setQueryType(type);
                              setShowDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition border-b border-slate-100 last:border-0 text-[#334155]"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Issue Description</label>
                    <textarea
                      rows={3}
                      placeholder="Describe your issue in detail..."
                      value={queryDesc}
                      onChange={(e) => setQueryDesc(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.queryDesc ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.queryDesc && <p className="text-[11px] text-red-500 font-bold">{formErrors.queryDesc}</p>}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleRaiseQuerySubmit}
                    disabled={loading}
                    className="w-full bg-[#10B981] hover:bg-[#059669] text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Raise Issue'
                    )}
                  </button>

                </div>
              )}
            </div>
          )}

          {/* SCREEN 4: NEW ENQUIRY FORM */}
          {currentScreen === 'new_enquiry_form' && (
            <div className="flex-grow bg-[#F8FAFC] min-h-[750px] p-5">
              
              {/* Form Header */}
              <div className="flex items-center justify-between mb-6 bg-white border-b border-slate-100 px-4 py-3 -mx-5 -mt-5">
                <button
                  onClick={() => setCurrentScreen('hub')}
                  className="text-slate-400 hover:text-slate-600 font-semibold text-sm py-1 flex items-center"
                >
                  ← Hub
                </button>
                <h2 className="text-lg font-bold text-[#0F172A]">New Enquiry</h2>
                <div className="w-10" /> {/* Spacer */}
              </div>

              {submitSuccess ? (
                <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center py-16 mt-4">
                  <span className="text-5xl mb-4">📩</span>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Enquiry Logged!</h3>
                  <p className="text-sm text-slate-500 text-center font-medium">Representative will contact you soon.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] space-y-4">
                  
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Contact Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={enquiryName}
                      onChange={(e) => setEnquiryName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.enquiryName ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.enquiryName && <p className="text-[11px] text-red-500 font-bold">{formErrors.enquiryName}</p>}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Phone Number</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={enquiryPhone}
                      onChange={(e) => setEnquiryPhone(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.enquiryPhone ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-300'
                      }`}
                    />
                    {formErrors.enquiryPhone && <p className="text-[11px] text-red-500 font-bold">{formErrors.enquiryPhone}</p>}
                  </div>

                  {/* Enquiry Type */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Select Enquiry Type</label>
                    <select
                      value={enquiryType}
                      onChange={(e) => setEnquiryType(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.enquiryType ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A]'
                      }`}
                    >
                      <option value="">-- Select type of Enquiry --</option>
                      <option value="New TallyPrime">New TallyPrime</option>
                      <option value="Tss Renewal">Tss Renewal</option>
                      <option value="Tally on Cloud">Tally on Cloud</option>
                      <option value="Tally Customisation">Tally Customisation</option>
                      <option value="Others">Others</option>
                    </select>
                    {formErrors.enquiryType && <p className="text-[11px] text-red-500 font-bold">{formErrors.enquiryType}</p>}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">
                      Enquiry Details / Requirements {enquiryType === 'Others' ? <span className="text-red-500 font-bold">* (Required)</span> : <span className="text-slate-400 font-medium">(Optional)</span>}
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Write how we can assist you..."
                      value={enquiryDetails}
                      onChange={(e) => setEnquiryDetails(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        formErrors.enquiryDetails ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] placeholder-slate-305'
                      }`}
                    />
                    {formErrors.enquiryDetails && <p className="text-[11px] text-red-500 font-bold">{formErrors.enquiryDetails}</p>}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleEnquirySubmit}
                    disabled={loading}
                    className="w-full bg-[#10B981] hover:bg-[#059669] text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Submit Enquiry'
                    )}
                  </button>

                </div>
              )}
            </div>
          )}

          {/* SCREEN 5: TICKETS HISTORY */}
          {currentScreen === 'query_list' && (
            <div className="flex-grow bg-[#F8FAFC] min-h-[750px] p-5">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6 bg-white border-b border-slate-100 px-4 py-3 -mx-5 -mt-5">
                <button
                  onClick={() => setCurrentScreen('raise_query_form')}
                  className="text-slate-400 hover:text-slate-600 font-semibold text-sm py-1 flex items-center"
                >
                  ← Form
                </button>
                <h2 className="text-lg font-bold text-[#0F172A]">Query Records</h2>
                <button
                  onClick={fetchTicketHistory}
                  disabled={fetchingHistory}
                  className="p-2 text-slate-400 hover:text-emerald-500 transition"
                >
                  🔄
                </button>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-slate-400 text-sm font-semibold">No queries raised yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white border border-[#E2E8F0] rounded-[18px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#0F172A]">{t.customer_name}</span>
                        <div className={`px-2.5 py-1 rounded-[8px] ${
                          t.status === 'resolved'
                            ? 'bg-[#D1FAE5]'
                            : t.status === 'assigned'
                            ? 'bg-[#DBEAFE]'
                            : 'bg-[#FEF3C7]'
                        }`}>
                          <span className={`text-[11px] font-bold uppercase ${
                            t.status === 'resolved'
                              ? 'text-[#059669]'
                              : t.status === 'assigned'
                              ? 'text-[#2563EB]'
                              : 'text-[#D97706]'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-[#64748B]">
                        <span>ID: {t.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-[#10B981] font-semibold">{t.issue_type}</span>
                      </div>

                      <p className="text-sm text-[#334155] leading-relaxed">
                        {t.description}
                      </p>

                      {/* Pending Duration Panel */}
                      {t.status !== 'resolved' && (
                        <div className="flex items-center mt-3 pt-3 border-t border-[#F1F5F9]">
                          <span className="text-xs text-[#64748B] mr-1.5">Pending duration:</span>
                          <span className="text-xs font-bold text-[#D97706]">
                            {Math.max(1, Math.round((new Date().getTime() - new Date(t.created_at).getTime()) / 60000))} min
                          </span>
                        </div>
                      )}

                      {/* Resolved Panel */}
                      {t.status === 'resolved' && (
                        <div className="mt-3 pt-3 border-t border-[#F1F5F9] space-y-2">
                          {t.feedback?.resolution_notes && (
                            <div className="bg-[#F8FAFC] rounded-lg p-2.5 border border-slate-100">
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tech Notes</p>
                              <p className="text-xs text-[#475569] font-medium">
                                💡 Note: {t.feedback.resolution_notes}
                              </p>
                            </div>
                          )}

                          {t.feedback && t.feedback.rating ? (
                            <div className="bg-[#F8FAFC] rounded-lg p-2.5 border border-slate-100">
                              <div className="text-yellow-500 text-sm mb-1">
                                {'★'.repeat(t.feedback.rating)}
                                {'☆'.repeat(5 - t.feedback.rating)}
                              </div>
                              {t.feedback.comments && (
                                <p className="text-xs text-[#475569] italic">"{t.feedback.comments}"</p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRatingTicket(t);
                                setRatingVal(5);
                                setFeedbackText('');
                              }}
                              className="w-full bg-[#E6F4FE] hover:bg-blue-100 text-[#2563EB] text-xs font-bold py-2.5 rounded-lg text-center transition"
                            >
                              Rate Support Experience
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* FEEDBACK RATING MODAL */}
        {ratingTicket && (
          <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Rate Support Experience</h3>
                <p className="text-xs text-slate-400 mt-1">
                  For issue: {ratingTicket.issue_type} ({ratingTicket.customer_name})
                </p>
              </div>

              {/* Star Selector */}
              <div className="flex justify-center gap-1.5 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => setRatingVal(star)}
                    className="text-4xl px-2 py-1 text-amber-400 cursor-pointer select-none transition-transform active:scale-95 touch-manipulation"
                  >
                    {ratingVal >= star ? '★' : '☆'}
                  </span>
                ))}
              </div>

              {/* Comments Textarea */}
              <textarea
                rows={3}
                placeholder="Tell us what went well or what we can improve..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRatingTicket(null)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={loading}
                  className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING PWA DOWNLOAD/INSTALL PROMPT BANNER */}
        {showPwaPrompt && (
          <div className="absolute bottom-5 left-4 right-4 z-40 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold">Add to Home Screen</h4>
              {isIosMobile ? (
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tap the Safari share icon <span className="text-xs">📤</span> then scroll and select <span className="font-bold">"Add to Home Screen"</span> <span className="text-xs">➕</span>.
                </p>
              ) : (
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Install this support app on your device for a faster, better experience.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isIosMobile && deferredPrompt && (
                <button
                  onClick={handleAndroidInstall}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition active:scale-95"
                >
                  Install
                </button>
              )}
              <button
                onClick={() => setShowPwaPrompt(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
