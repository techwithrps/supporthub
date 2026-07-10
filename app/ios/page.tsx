'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Tally Serial validation: Must be exactly 9 digits, and the sum of digits must equal 9.
const validateTallySerial = (serial: string): boolean => {
  const clean = serial.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(clean)) return false;
  const sum = clean.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
  return sum === 9;
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
  const [currentScreen, setCurrentScreen] = useState<'hub' | 'raise' | 'history' | 'enquiry'>('hub');
  
  // Issue Form states
  const [customerName, setCustomerName] = useState('');
  const [serialOrEmail, setSerialOrEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [issueType, setIssueType] = useState('Tally Prime');
  const [description, setDescription] = useState('');
  
  // Enquiry Form states
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryDetails, setEnquiryDetails] = useState('');
  
  // Validation / Loading states
  const [validationError, setValidationError] = useState('');
  const [enquiryValidationError, setEnquiryValidationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Local tickets history states
  const [savedTicketIds, setSavedTicketIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  // Load local ticket IDs on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
    }
  }, []);

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

  // Poll for updates
  useEffect(() => {
    fetchTicketHistory();
    const interval = setInterval(fetchTicketHistory, 10000); // 10s poll
    return () => clearInterval(interval);
  }, [savedTicketIds, currentScreen]);

  // Input Validation on Blur for tickets
  const handleBlurValidation = () => {
    const input = serialOrEmail.trim();
    if (!input) {
      setValidationError('');
      return;
    }

    if (input.includes('@')) {
      if (!validateEmail(input)) {
        setValidationError('Invalid Email ID format');
      } else {
        setValidationError('');
      }
    } else {
      if (!validateTallySerial(input)) {
        setValidationError('Invalid Tally Serial No. (Must be 9 digits & sum must equal 9)');
      } else {
        setValidationError('');
      }
    }
  };

  // Submit Ticket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMessage('');

    if (!customerName || !serialOrEmail || !mobile || !description) {
      setValidationError('All fields are required');
      return;
    }

    const input = serialOrEmail.trim();
    const isEmail = input.includes('@');
    if (isEmail) {
      if (!validateEmail(input)) {
        setValidationError('Invalid Tally Serial No. or Email ID');
        return;
      }
    } else {
      if (!validateTallySerial(input)) {
        setValidationError('Invalid Tally Serial No. or Email ID');
        return;
      }
    }

    setLoading(true);
    try {
      const insertData = {
        customer_name: customerName,
        tally_serial: isEmail ? 'N/A' : input,
        email: isEmail ? input : 'N/A',
        mobile: mobile,
        issue_type: issueType,
        description: description,
        status: 'pending',
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
        setSavedTicketIds(updatedIds);

        setCustomerName('');
        setSerialOrEmail('');
        setMobile('');
        setValidationError('');
        setDescription('');
        setSuccessMessage('Issue raised successfully!');
        
        setTimeout(() => {
          setSuccessMessage('');
          setCurrentScreen('hub');
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Enquiry (same logic as Android app)
  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnquiryValidationError('');
    setSuccessMessage('');

    if (!enquiryName.trim() || !enquiryPhone.trim() || !enquiryDetails.trim()) {
      setEnquiryValidationError('All fields are required');
      return;
    }

    if (enquiryPhone.trim().length < 10) {
      setEnquiryValidationError('Enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('enquiries')
        .insert({
          name: enquiryName,
          phone: enquiryPhone,
          details: enquiryDetails,
        });

      if (error) throw error;

      setEnquiryName('');
      setEnquiryPhone('');
      setEnquiryDetails('');
      setEnquiryValidationError('');
      setSuccessMessage('Enquiry logged successfully!');

      setTimeout(() => {
        setSuccessMessage('');
        setCurrentScreen('hub');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setEnquiryValidationError(err.message || 'Could not submit enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-4 select-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* PWA iOS Mobile Container Simulator on Desktop */}
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[812px] sm:rounded-[36px] sm:shadow-2xl overflow-hidden flex flex-col justify-between border-0 sm:border-8 border-slate-900 relative">
        
        {/* APP HEADER */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Suyog logo" className="h-8 w-auto object-contain" />
          </div>
          {currentScreen !== 'hub' && (
            <button
              onClick={() => setCurrentScreen('hub')}
              className="text-xs font-bold text-slate-500 hover:text-emerald-500 flex items-center gap-1 transition"
            >
              ← Back
            </button>
          )}
        </header>

        {/* SCREEN ROUTING */}
        <main className="flex-grow p-5 overflow-y-auto">
          
          {/* SCREEN 1: HUB PORTAL */}
          {currentScreen === 'hub' && (
            <div className="space-y-6 flex flex-col justify-center min-h-[500px]">
              <div className="text-center space-y-2 mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Suyog Support Hub</h2>
                <p className="text-xs text-slate-400">Welcome! Select an option below to proceed.</p>
              </div>

              <div className="space-y-4">
                {/* Raise Ticket Button */}
                <button
                  onClick={() => setCurrentScreen('raise')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-5 text-left border border-slate-800 shadow-sm transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-base">Raise Issue</h3>
                    <p className="text-slate-400 text-xs mt-1">File support requests, issues and tickets</p>
                  </div>
                  <span className="text-xl">🛠️</span>
                </button>

                {/* New Enquiry Button */}
                <button
                  onClick={() => setCurrentScreen('enquiry')}
                  className="w-full bg-white hover:bg-slate-50 text-slate-900 rounded-2xl p-5 text-left border border-slate-200 shadow-sm transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-base">New Enquiry</h3>
                    <p className="text-slate-500 text-xs mt-1">Get product catalog, pricing, demo calls</p>
                  </div>
                  <span className="text-xl">📞</span>
                </button>

                {/* View Tickets History Button */}
                <button
                  onClick={() => setCurrentScreen('history')}
                  className="w-full bg-white hover:bg-slate-50 text-slate-900 rounded-2xl p-5 text-left border border-slate-200 shadow-sm transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-base">My Support History</h3>
                    <p className="text-slate-500 text-xs mt-1">Track status and review technician notes</p>
                  </div>
                  <span className="text-xl">📋</span>
                </button>
              </div>

              {tickets.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="bg-emerald-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-800">You have active queries</p>
                    <button 
                      onClick={() => setCurrentScreen('history')}
                      className="text-[11px] text-emerald-600 font-bold underline"
                    >
                      Track status ({tickets.length} tickets) →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCREEN 2: RAISE ISSUE FORM */}
          {currentScreen === 'raise' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800">Raise Support Issue</h2>
                <p className="text-xs text-slate-400">Fill in the fields below. A technician will contact you shortly.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Unified input: Tally Serial No. or Email ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tally Serial No. or Email ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="9-digit serial or email address"
                    value={serialOrEmail}
                    onChange={(e) => setSerialOrEmail(e.target.value)}
                    onBlur={handleBlurValidation}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      validationError
                        ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  />
                  {validationError && (
                    <p className="text-xs font-bold text-red-500 mt-1">{validationError}</p>
                  )}
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter customer or company name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-sm font-semibold transition focus:outline-none"
                  />
                </div>

                {/* Mobile No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile No.
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-sm font-semibold transition focus:outline-none"
                  />
                </div>

                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Issue Type
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-sm font-semibold bg-white transition focus:outline-none"
                  >
                    <option value="Tally Prime">Tally Prime</option>
                    <option value="Tally ERP 9">Tally ERP 9</option>
                    <option value="License Activation">License Activation</option>
                    <option value="Data Recovery">Data Recovery</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Describe your Issue
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain the problem you are facing..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-sm font-semibold transition focus:outline-none"
                  />
                </div>

                {successMessage && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-xl text-center text-xs font-bold">
                    {successMessage}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Submitting...' : 'Submit Support Query'}
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 3: NEW ENQUIRY FORM */}
          {currentScreen === 'enquiry' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800">New Enquiry</h2>
                <p className="text-xs text-slate-400">Share your details and requirements. Our representative will contact you.</p>
              </div>

              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={enquiryName}
                    onChange={(e) => setEnquiryName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      enquiryValidationError && !enquiryName.trim()
                        ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  />
                </div>

                {/* Mobile No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile No.
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number"
                    value={enquiryPhone}
                    onChange={(e) => setEnquiryPhone(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      enquiryValidationError && (enquiryPhone.trim().length < 10)
                        ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  />
                </div>

                {/* Enquiry Details */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Enquiry Details / Requirements
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Specify software requirements, dynamic customizations, or demo slots..."
                    value={enquiryDetails}
                    onChange={(e) => setEnquiryDetails(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-sm font-semibold transition focus:outline-none"
                  />
                </div>

                {enquiryValidationError && (
                  <p className="text-xs font-bold text-red-500 mt-1">{enquiryValidationError}</p>
                )}

                {successMessage && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-xl text-center text-xs font-bold">
                    {successMessage}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Submitting...' : 'Submit Enquiry'}
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 4: TICKETS HISTORY */}
          {currentScreen === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Support History</h2>
                  <p className="text-xs text-slate-400">Private record of tickets created on this device.</p>
                </div>
                <button
                  onClick={fetchTicketHistory}
                  className="p-2 text-slate-400 hover:text-emerald-500 transition"
                  title="Reload tickets"
                >
                  🔄
                </button>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <p className="text-slate-400 text-sm font-medium">No tickets raised from this browser yet.</p>
                  <button
                    onClick={() => setCurrentScreen('raise')}
                    className="text-xs text-emerald-600 font-bold underline"
                  >
                    Raise your first issue now →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-[11px] font-bold text-slate-400">ID: {t.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          t.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-600'
                            : t.status === 'assigned'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {t.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">{t.issue_type}</p>
                        <p className="text-xs text-slate-500 font-medium">
                          Identifier: {t.tally_serial !== 'N/A' ? `Tally Serial ${t.tally_serial}` : t.email}
                        </p>
                        <p className="text-xs text-slate-600 italic">"{t.description}"</p>
                      </div>

                      {t.status === 'resolved' && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resolution Status</p>
                          <p className="text-xs text-slate-600 font-bold">✓ Successfully Resolved</p>
                          {t.feedback?.resolution_notes && (
                            <p className="text-xs text-slate-500 italic">
                              💡 Tech Note: "{t.feedback.resolution_notes}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>

        {/* APP FOOTER */}
        <footer className="bg-slate-50 border-t border-slate-100 px-6 py-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Visit official website</p>
          <a
            href="https://www.suyog.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition"
          >
            www.suyog.net
          </a>
        </footer>

      </div>
    </div>
  );
}
