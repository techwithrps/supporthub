'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type TicketStatus = 'pending' | 'assigned' | 'resolved';

interface Ticket {
  id: string;
  customer_name: string;
  tally_serial: string;
  email: string;
  mobile: string;
  issue_type: string;
  description: string;
  status: TicketStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  push_token: string | null;
  created_at: string;
  feedback: { rating: number | null; comments: string | null; resolution_notes?: string | null } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email?: string;
  created_at?: string;
}

function LiveTimer({ from, className = "text-orange-600" }: { from: string; className?: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const start = new Date(from).getTime();
      const diff = Date.now() - start;
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m ${s % 60}s`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [from]);

  return <span className={`font-mono text-xs font-bold ${className}`}>{elapsed}</span>;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; full_name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  
  // Admin navigation state: 'overview' | 'employee_detail' | 'enquiries' | 'manage_employees' | 'employee_pulse_list'
  const [adminSection, setAdminSection] = useState<'overview' | 'employee_detail' | 'enquiries' | 'manage_employees' | 'employee_pulse_list'>('overview');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  // Interactive Ticket Filter for Admin Overview
  const [adminFilter, setAdminFilter] = useState<'pending' | 'all' | 'resolved' | 'feedback' | 'tally' | 'cloud' | 'tss' | 'custom' | 'others'>('pending');

  // Interactive Employee Filter for Admin Sidebar Roster: 'all' | 'solving' | 'idle'
  const [employeeFilter, setEmployeeFilter] = useState<'all' | 'solving' | 'idle'>('all');

  // Employee navigation state
  const [activeTab, setActiveTab] = useState<'queue' | 'mine' | 'resolved' | 'enquiries'>('queue');
  const [loading, setLoading] = useState(true);

  // New Employee Creation States
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [empCreating, setEmpCreating] = useState(false);
  const [empSuccessMsg, setEmpSuccessMsg] = useState('');
  const [empErrorMsg, setEmpErrorMsg] = useState('');

  // Assignment states
  const [assigningTicket, setAssigningTicket] = useState<Ticket | null>(null);
  
  // Resolve states
  const [resolveModal, setResolveModal] = useState<Ticket | null>(null);
  const [resolveComment, setResolveComment] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  const fetchData = useCallback(async () => {
    const [ticketsRes, enquiriesRes] = await Promise.all([
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('enquiries').select('*').order('created_at', { ascending: false }),
    ]);

    if (ticketsRes.data) setTickets(ticketsRes.data as Ticket[]);
    if (enquiriesRes.data) setEnquiries(enquiriesRes.data);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === 'admin@suyog.net') {
      try {
        const res = await fetch('/api/employees/list');
        const listData = await res.json();
        if (listData.success) {
          setEmployees(listData.employees);
        }
      } catch (err) {
        console.error('Failed to fetch employees list:', err);
      }
    } else {
      const { data: profilesRes } = await supabase.from('profiles').select('*');
      if (profilesRes) {
        setEmployees(profilesRes as Profile[]);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      const email = session.user.email || '';
      const isSystemAdmin = email === 'admin@suyog.net';
      setIsAdmin(isSystemAdmin);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      setUser({
        id: session.user.id,
        email,
        full_name: profile?.full_name || email.split('@')[0],
      });

      await fetchData();
      setLoading(false);
    };
    init();

    // Real-time subscription
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, fetchData)
      .subscribe();

    // 5-second polling fallback to guarantee timer updates
    const pollInterval = setInterval(fetchData, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [router, fetchData]);

  const claimTicket = async (ticketId: string) => {
    if (!user) return;
    await supabase.from('tickets').update({
      status: 'assigned',
      assigned_to: user.id,
      assigned_at: new Date().toISOString(),
    }).eq('id', ticketId);
    fetchData();
  };

  const assignTicketToEmployee = async (ticketId: string, empId: string) => {
    await supabase.from('tickets').update({
      status: 'assigned',
      assigned_to: empId,
      assigned_at: new Date().toISOString(),
    }).eq('id', ticketId);
    setAssigningTicket(null);
    fetchData();
  };

  const openResolveModal = (ticket: Ticket) => {
    setResolveModal(ticket);
    setResolveComment('');
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setSendingNotif(true);

    await supabase.from('tickets').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      feedback: { rating: null, comments: null, resolution_notes: resolveComment }
    }).eq('id', resolveModal.id);

    if (resolveModal.push_token) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: resolveModal.push_token,
            title: '✅ Query Resolved — Suyog Support Hub',
            body: `Your query "${resolveModal.issue_type}" has been resolved. Please rate your experience!`,
            data: { ticketId: resolveModal.id },
          }),
        });
      } catch (e) {
        console.error('Push notification error:', e);
      }
    }

    setSendingNotif(false);
    setResolveModal(null);
    fetchData();
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpCreating(true);
    setEmpSuccessMsg('');
    setEmpErrorMsg('');

    try {
      const res = await fetch('/api/employees/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEmpName,
          email: newEmpEmail,
          password: newEmpPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        setEmpSuccessMsg(`Employee account for ${newEmpName} created successfully!`);
        setNewEmpName('');
        setNewEmpEmail('');
        setNewEmpPassword('');
        fetchData();
      } else {
        setEmpErrorMsg(data.error || 'Failed to create employee account.');
      }
    } catch (err: any) {
      setEmpErrorMsg(err.message || 'An error occurred during account creation.');
    } finally {
      setEmpCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getEmployeeStatus = (empId: string) => {
    const active = tickets.find(t => t.assigned_to === empId && t.status === 'assigned');
    if (active) {
      return { status: 'Solving', color: 'text-orange-600 bg-orange-50 border-orange-100', activeTicket: active };
    }
    return { status: 'Idle', color: 'text-gray-400 bg-gray-50 border-gray-100', activeTicket: null };
  };

  const pendingTickets = tickets.filter(t => t.status === 'pending');
  const myTickets = tickets.filter(t => t.assigned_to === user?.id && t.status === 'assigned');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  // Compute analytics metrics
  const getCSATAverage = () => {
    const rated = resolvedTickets.filter(t => t.feedback?.rating);
    if (rated.length === 0) return '5.0';
    const sum = rated.reduce((acc, t) => acc + (t.feedback?.rating || 5), 0);
    return (sum / rated.length).toFixed(1);
  };

  const getCategoryStats = () => {
    const categories = ['Tally Related Issue', 'Cloud Related Issue', 'TSS Renewal', 'Tally Customization', 'Others'];
    const total = tickets.length || 1;
    return categories.map(cat => {
      const count = tickets.filter(t => t.issue_type === cat).length;
      const pct = Math.round((count / total) * 100);
      const filterMap: Record<string, 'tally' | 'cloud' | 'tss' | 'custom' | 'others'> = {
        'Tally Related Issue': 'tally',
        'Cloud Related Issue': 'cloud',
        'TSS Renewal': 'tss',
        'Tally Customization': 'custom',
        'Others': 'others'
      };
      return { label: cat, count, pct, filterKey: filterMap[cat] };
    });
  };

  const getAverageResolutionTime = () => {
    if (resolvedTickets.length === 0) return 'N/A';
    const totalMs = resolvedTickets.reduce((acc, t) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.resolved_at!).getTime();
      return acc + (end - start);
    }, 0);
    const avgMins = Math.round(totalMs / (resolvedTickets.length * 60 * 1000));
    if (avgMins > 60) {
      return `${Math.floor(avgMins / 60)}h ${avgMins % 60}m`;
    }
    return `${avgMins} mins`;
  };

  // Filter tickets based on active card click
  const getFilteredTicketsForAdmin = () => {
    switch (adminFilter) {
      case 'pending':
        return tickets.filter(t => t.status === 'pending');
      case 'resolved':
        return tickets.filter(t => t.status === 'resolved');
      case 'feedback':
        return tickets.filter(t => t.status === 'resolved' && t.feedback);
      case 'tally':
        return tickets.filter(t => t.issue_type === 'Tally Related Issue');
      case 'cloud':
        return tickets.filter(t => t.issue_type === 'Cloud Related Issue');
      case 'tss':
        return tickets.filter(t => t.issue_type === 'TSS Renewal');
      case 'custom':
        return tickets.filter(t => t.issue_type === 'Tally Customization');
      case 'others':
        return tickets.filter(t => t.issue_type === 'Others');
      case 'all':
      default:
        return tickets;
    }
  };

  const getFilterHeading = () => {
    const config: Record<string, string> = {
      pending: 'Unassigned Pending Queue',
      resolved: 'Resolved Tickets History',
      feedback: 'Customer Ratings & Feedbacks',
      tally: 'Category: Tally Related Issues',
      cloud: 'Category: Cloud Related Issues',
      tss: 'Category: TSS Renewal Requests',
      custom: 'Category: Tally Customizations',
      others: 'Category: Other Queries',
      all: 'All System Tickets'
    };
    return config[adminFilter] || 'System Tickets';
  };

  // Filter sidebar employees list based on operational pulse clicks
  const getFilteredEmployees = () => {
    const validEmps = employees.filter(e => e.email !== 'admin@suyog.net');
    if (employeeFilter === 'solving') {
      return validEmps.filter(e => getEmployeeStatus(e.id).status === 'Solving');
    }
    if (employeeFilter === 'idle') {
      return validEmps.filter(e => getEmployeeStatus(e.id).status === 'Idle');
    }
    return validEmps;
  };

  const statusBadge = (status: TicketStatus) => {
    const cfg: Record<TicketStatus, { label: string; cls: string }> = {
      pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
      assigned: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
      resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    };
    const c = cfg[status];
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>{c.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Render Admin Dashboard (Highly distinct, dark-sidebar, analytics style)
  if (isAdmin) {
    const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
    const selectedEmpTickets = tickets.filter(t => t.assigned_to === selectedEmployeeId);
    const selectedEmpActive = selectedEmpTickets.find(t => t.status === 'assigned');
    const selectedEmpResolved = selectedEmpTickets.filter(t => t.status === 'resolved');
    const adminFilteredTickets = getFilteredTicketsForAdmin();
    const adminFilteredEmployees = getFilteredEmployees();

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Suyog" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                Suyog Support Hub
              </h1>
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Administration Console</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">Administrator</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition">
              Logout
            </button>
          </div>
        </header>

        {/* CONTAINER */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR: NAVIGATION & ROSTER */}
          <aside className="w-80 bg-[#0F172A] text-slate-300 flex flex-col z-10 shadow-lg">
            {/* Primary Sections */}
            <div className="p-4 space-y-1 border-b border-slate-800">
              <button
                onClick={() => { setAdminSection('overview'); setSelectedEmployeeId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                  adminSection === 'overview' && !selectedEmployeeId
                    ? 'bg-slate-800 text-white shadow-inner'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                📊 Overview & Analytics
              </button>
              <button
                onClick={() => { setAdminSection('enquiries'); setSelectedEmployeeId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                  adminSection === 'enquiries'
                    ? 'bg-slate-800 text-white shadow-inner'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                📝 Enquiry Calls ({enquiries.length})
              </button>
              <button
                onClick={() => { setAdminSection('manage_employees'); setSelectedEmployeeId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                  adminSection === 'manage_employees'
                    ? 'bg-slate-800 text-white shadow-inner'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                👥 Manage Employees ({employees.filter(e => e.email !== 'admin@suyog.net').length})
              </button>
            </div>

            {/* Employee Workstations section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 pt-5 pb-2 flex justify-between items-center">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {employeeFilter === 'all' && 'All Workstations'}
                  {employeeFilter === 'solving' && 'Solving Workstations'}
                  {employeeFilter === 'idle' && 'Idle Workstations'}
                </h2>
                {employeeFilter !== 'all' && (
                  <button
                    onClick={() => setEmployeeFilter('all')}
                    className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                {adminFilteredEmployees.map((emp) => {
                  const state = getEmployeeStatus(emp.id);
                  const isSelected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                        setAdminSection('employee_detail');
                      }}
                      className={`w-full text-left p-3 rounded-lg transition flex flex-col gap-1.5 ${
                        isSelected ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-xs">{emp.full_name}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          state.status === 'Solving' 
                            ? isSelected ? 'bg-white/20 text-white' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : isSelected ? 'bg-white/10 text-white/80' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {state.status}
                        </span>
                      </div>
                      
                      {state.activeTicket ? (
                        <div className={`text-[10px] rounded p-1.5 flex justify-between items-center ${
                          isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800/80 border border-slate-700'
                        }`}>
                          <span className="truncate max-w-[130px] font-medium">🛠️ {state.activeTicket.issue_type}</span>
                          <LiveTimer from={state.activeTicket.assigned_at!} className={isSelected ? 'text-white' : 'text-orange-400'} />
                        </div>
                      ) : (
                        <p className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>Status: Idle</p>
                      )}
                    </button>
                  );
                })}
                {adminFilteredEmployees.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-6">No matching employees found.</p>
                )}
              </div>
            </div>
          </aside>

          {/* MAIN CONSOLE AREA */}
          <main className="flex-1 overflow-y-auto p-8">
            {/* 1. OVERVIEW & QUEUE */}
            {adminSection === 'overview' && !selectedEmployeeId && (
              <div className="space-y-6">
                {/* Clickable Stats cards */}
                <div className="grid grid-cols-4 gap-5">
                  <button
                    onClick={() => setAdminFilter('pending')}
                    className={`text-left border rounded-2xl p-5 shadow-sm transition hover:shadow-md ${
                      adminFilter === 'pending'
                        ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Unassigned Queue</p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-2">{pendingTickets.length}</p>
                  </button>

                  <button
                    onClick={() => setAdminFilter('resolved')}
                    className={`text-left border rounded-2xl p-5 shadow-sm transition hover:shadow-md ${
                      adminFilter === 'resolved'
                        ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Average Resolve Time</p>
                    <p className="text-3xl font-extrabold text-blue-600 mt-2">{getAverageResolutionTime()}</p>
                  </button>

                  <button
                    onClick={() => setAdminFilter('feedback')}
                    className={`text-left border rounded-2xl p-5 shadow-sm transition hover:shadow-md ${
                      adminFilter === 'feedback'
                        ? 'bg-yellow-50 border-yellow-200 ring-2 ring-yellow-100'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Customer CSAT Rate</p>
                    <p className="text-3xl font-extrabold text-yellow-500 mt-2">⭐ {getCSATAverage()}</p>
                  </button>

                  <button
                    onClick={() => setAdminFilter('all')}
                    className={`text-left border rounded-2xl p-5 shadow-sm transition hover:shadow-md ${
                      adminFilter === 'all'
                        ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-200'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Tickets Filed</p>
                    <p className="text-3xl font-extrabold text-slate-800 mt-2">{tickets.length}</p>
                  </button>
                </div>

                {/* Analytical Breakdown grids */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Filtered ticket queue */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                        {getFilterHeading()} ({adminFilteredTickets.length})
                      </h3>
                      {adminFilter !== 'pending' && (
                        <button
                          onClick={() => setAdminFilter('pending')}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200"
                        >
                          Clear Filters (Show Pending)
                        </button>
                      )}
                    </div>

                    {adminFilteredTickets.length === 0 ? (
                      <EmptyState message="No tickets match this filter." />
                    ) : (
                      <div className="space-y-4">
                        {adminFilteredTickets.map((t) => (
                          <TicketCard key={t.id} ticket={t} statusBadge={statusBadge}>
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
                              <div className="flex-1">
                                <p className="text-xs text-gray-400 font-semibold mb-0.5">
                                  {t.status === 'resolved' ? 'Resolved duration' : 'Pending duration'}
                                </p>
                                <LiveTimer from={t.created_at} />
                              </div>
                              
                              {t.status !== 'resolved' && (
                                <button
                                  onClick={() => setAssigningTicket(t)}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"
                                >
                                  {t.status === 'assigned' ? 'Re-assign Task' : 'Assign Employee'}
                                </button>
                              )}

                              {t.status === 'resolved' && t.feedback && (
                                <div className="text-right">
                                  <p className="text-yellow-500 text-sm">{'⭐'.repeat(t.feedback.rating || 0)}</p>
                                  {t.feedback.comments && (
                                    <p className="text-xs text-gray-400 italic mt-0.5">"{t.feedback.comments}"</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TicketCard>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Clickable Category Distribution & Clickable Operational Pulse */}
                  <div className="space-y-6">
                    {/* Category distribution */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-800 mb-4">Queries by Category</h3>
                      <div className="space-y-4">
                        {getCategoryStats().map(cat => {
                          const isSelected = adminFilter === cat.filterKey;
                          return (
                            <button
                              key={cat.label}
                              onClick={() => setAdminFilter(cat.filterKey as any)}
                              className={`w-full text-left space-y-1.5 p-2 rounded-xl transition hover:bg-gray-50 border ${
                                isSelected ? 'bg-emerald-50/50 border-emerald-200' : 'border-transparent'
                              }`}
                            >
                              <div className="flex justify-between text-xs font-bold text-gray-600">
                                <span className="truncate max-w-[150px]">{cat.label}</span>
                                <span>{cat.count} ({cat.pct}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${cat.pct}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Clickable Operational pulse details */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-gray-800">Operational Pulse</h3>
                      
                      <button
                        onClick={() => { setAdminSection('employee_pulse_list'); setEmployeeFilter('solving'); }}
                        className="w-full flex items-center justify-between text-xs py-2.5 border-b border-gray-50 text-left hover:bg-gray-50 rounded-lg px-2 transition"
                      >
                        <span className="text-gray-500 font-medium">🔥 Active Solving Now</span>
                        <span className="font-extrabold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">
                          {employees.filter(e => getEmployeeStatus(e.id).status === 'Solving').length}
                        </span>
                      </button>

                      <button
                        onClick={() => { setAdminSection('employee_pulse_list'); setEmployeeFilter('idle'); }}
                        className="w-full flex items-center justify-between text-xs py-2.5 text-left hover:bg-gray-50 rounded-lg px-2 transition"
                      >
                        <span className="text-gray-500 font-medium">💤 Idle Agents</span>
                        <span className="font-extrabold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-md">
                          {employees.filter(e => e.email !== 'admin@suyog.net' && getEmployeeStatus(e.id).status === 'Idle').length}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ENQUIRIES LIST */}
            {adminSection === 'enquiries' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">New Callback Enquiries</h2>
                <div className="space-y-4">
                  {enquiries.length === 0 ? (
                    <EmptyState message="No call enquiries registered yet." />
                  ) : (
                    enquiries.map((e) => (
                      <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-lg font-bold text-gray-900">{e.name}</p>
                            <a href={`tel:${e.phone}`} className="text-emerald-600 font-semibold text-sm hover:underline mt-1 block">
                              📞 {e.phone}
                            </a>
                          </div>
                          <span className="text-xs text-gray-400 font-medium">
                            {new Date(e.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">{e.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. MANAGE EMPLOYEES (New User Registration & Employee List) */}
            {adminSection === 'manage_employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left panel: Add Employee form */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm h-fit">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Add New Employee</h2>
                  <p className="text-gray-400 text-xs mb-6">Create login credentials for new team member.</p>

                  <form onSubmit={handleCreateEmployee} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Full Name</label>
                      <input
                        type="text"
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        required
                        placeholder="e.g. Amit Sharma"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Email Address</label>
                      <input
                        type="email"
                        value={newEmpEmail}
                        onChange={(e) => setNewEmpEmail(e.target.value)}
                        required
                        placeholder="employee@suyog.net"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Password</label>
                      <input
                        type="password"
                        value={newEmpPassword}
                        onChange={(e) => setNewEmpPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>

                    {empSuccessMsg && (
                      <div className="bg-emerald-50 text-emerald-700 text-xs rounded-xl p-3 border border-emerald-100">
                        ✅ {empSuccessMsg}
                      </div>
                    )}
                    {empErrorMsg && (
                      <div className="bg-red-50 text-red-600 text-xs rounded-xl p-3 border border-red-100">
                        ⚠️ {empErrorMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={empCreating}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition shadow-sm text-sm"
                    >
                      {empCreating ? 'Creating Account...' : 'Create Employee'}
                    </button>
                  </form>
                </div>

                {/* Right panel: Registered Employees List */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Registered System Employees</h3>
                  
                  <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-100 text-sm text-left">
                      <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Employee Details</th>
                          <th className="px-6 py-4">Account Status</th>
                          <th className="px-6 py-4">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employees
                          .filter(e => e.email !== 'admin@suyog.net')
                          .map((emp) => {
                            const state = getEmployeeStatus(emp.id);
                            return (
                              <tr key={emp.id} className="hover:bg-gray-50/50 transition">
                                <td className="px-6 py-4">
                                  <p className="font-bold text-gray-900">{emp.full_name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{emp.email}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${state.color.split(' ')[0]} ${state.color.split(' ')[1]}`}>
                                    {state.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-400">
                                  {emp.created_at
                                    ? new Date(emp.created_at).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : 'Pre-existing'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. EMPLOYEE DETAILS MONITORING */}
            {adminSection === 'employee_detail' && selectedEmp && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedEmp.full_name}</h2>
                    <p className="text-sm text-gray-400">{selectedEmp.email}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center bg-gray-50 border border-gray-100 px-5 py-3 rounded-2xl">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Task</p>
                      <p className="text-2xl font-extrabold text-blue-600 mt-1">{selectedEmpActive ? 1 : 0}</p>
                    </div>
                    <div className="text-center bg-gray-50 border border-gray-100 px-5 py-3 rounded-2xl">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Resolved</p>
                      <p className="text-2xl font-extrabold text-emerald-600 mt-1">{selectedEmpResolved.length}</p>
                    </div>
                  </div>
                </div>

                {/* CURRENT ACTIVE TICKET FOR SELECT EMPLOYEE */}
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Active Assigned Task</h3>
                  {selectedEmpActive ? (
                    <TicketCard ticket={selectedEmpActive} statusBadge={statusBadge} highlight>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400 font-semibold mb-0.5">Solving duration</p>
                          <LiveTimer from={selectedEmpActive.assigned_at!} />
                        </div>
                      </div>
                    </TicketCard>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                      <p className="text-gray-400 text-sm font-medium">Employee is currently idle (no active tickets).</p>
                    </div>
                  )}
                </div>

                {/* WORK HISTORY FOR SELECTED EMPLOYEE */}
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Resolved Tickets History</h3>
                  {selectedEmpResolved.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                      <p className="text-gray-400 text-sm font-medium">No resolved history yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedEmpResolved.map((t) => (
                        <TicketCard key={t.id} ticket={t} statusBadge={statusBadge}>
                          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-400 font-semibold">Total time to resolve</p>
                              <span className="font-bold text-emerald-600 text-sm block mt-0.5">
                                {timeDiff(t.created_at, t.resolved_at!)}
                              </span>
                            </div>
                            {t.feedback && (
                              <div className="text-right bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                {t.feedback.resolution_notes && (
                                  <p className="text-xs text-slate-600 font-semibold mb-1 text-left">
                                    💡 Note: {t.feedback.resolution_notes}
                                  </p>
                                )}
                                {t.feedback.rating ? (
                                  <>
                                    <p className="text-yellow-500 text-base">{'⭐'.repeat(t.feedback.rating || 0)}</p>
                                    {t.feedback.comments && (
                                      <p className="text-xs text-gray-500 italic mt-1 max-w-xs text-right">
                                        "{t.feedback.comments}"
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-[10px] text-gray-400 italic">No client rating yet</p>
                                )}
                              </div>
                            )}
                          </div>
                        </TicketCard>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. EMPLOYEE PULSE LIST (Clean, simplified list format) */}
            {adminSection === 'employee_pulse_list' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">
                    {employeeFilter === 'solving' ? '🔥 Currently Solving Queries' : '💤 Idle Team Members'}
                  </h2>
                  <button
                    onClick={() => { setAdminSection('overview'); setEmployeeFilter('all'); }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200"
                  >
                    ← Back to Overview
                  </button>
                </div>

                <div className="space-y-4">
                  {employees
                    .filter(e => e.email !== 'admin@suyog.net')
                    .filter(e => {
                      const state = getEmployeeStatus(e.id);
                      if (employeeFilter === 'solving') return state.status === 'Solving';
                      if (employeeFilter === 'idle') return state.status === 'Idle';
                      return true;
                    })
                    .map((emp) => {
                      const state = getEmployeeStatus(emp.id);
                      return (
                        <div key={emp.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-lg font-bold text-gray-950">{emp.full_name}</p>
                              <p className="text-xs text-gray-400">{emp.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${state.color.split(' ')[0]} ${state.color.split(' ')[1]}`}>
                                {state.status}
                              </span>
                              {state.activeTicket && (
                                <LiveTimer from={state.activeTicket.assigned_at!} className="text-orange-600 font-bold text-xs" />
                              )}
                            </div>
                          </div>

                          {state.activeTicket ? (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-2">
                              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                                <span>Client: {state.activeTicket.customer_name}</span>
                                <span>Serial: {state.activeTicket.tally_serial} | {state.activeTicket.email}</span>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">
                                <span className="font-bold text-slate-800">Issue:</span> {state.activeTicket.description}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">No active task. Available for new assignments.</p>
                          )}
                        </div>
                      );
                    })}
                  {employees
                    .filter(e => e.email !== 'admin@suyog.net')
                    .filter(e => {
                      const state = getEmployeeStatus(e.id);
                      if (employeeFilter === 'solving') return state.status === 'Solving';
                      if (employeeFilter === 'idle') return state.status === 'Idle';
                      return true;
                    }).length === 0 && (
                    <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 italic">
                      No employees match this filter.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ASSIGNMENT MODAL */}
        {assigningTicket && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Assign Ticket</h2>
              <p className="text-gray-500 text-sm mb-5">
                {assigningTicket.customer_name} — {assigningTicket.issue_type}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {employees
                  .filter(e => e.email !== 'admin@suyog.net')
                  .map((emp) => {
                    const state = getEmployeeStatus(emp.id);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => assignTicketToEmployee(assigningTicket.id, emp.id)}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition text-left"
                      >
                        <div>
                          <p className="font-bold text-sm text-gray-800">{emp.full_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{emp.email}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${state.color.split(' ')[0]} ${state.color.split(' ')[1]}`}>
                          {state.status}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                onClick={() => setAssigningTicket(null)}
                className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Employee Dashboard (Clean white dashboard layout)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOPBAR */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Suyog" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                Suyog Support Hub
              </h1>
              <p className="text-xs text-gray-400">Employee Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending', count: pendingTickets.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
            { label: 'My Active', count: myTickets.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
            { label: 'Resolved', count: resolvedTickets.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Enquiries', count: enquiries.length, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border rounded-2xl p-5`}>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.count}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 bg-white border border-gray-100 rounded-xl p-1.5 w-fit shadow-sm">
          {[
            { key: 'queue', label: `📋 Queue (${pendingTickets.length})` },
            { key: 'mine', label: `🛠️ My Tasks (${myTickets.length})` },
            { key: 'resolved', label: `✅ Resolved (${resolvedTickets.length})` },
            { key: 'enquiries', label: `📝 Enquiries (${enquiries.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* QUEUE TAB */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {pendingTickets.length === 0 ? (
              <EmptyState message="No pending tickets in queue 🎉" />
            ) : (
              pendingTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} statusBadge={statusBadge}>
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Waiting since</p>
                      <LiveTimer from={t.created_at} />
                    </div>
                    <button
                      onClick={() => claimTicket(t.id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                    >
                      Claim Task
                    </button>
                  </div>
                </TicketCard>
              ))
            )}
          </div>
        )}

        {/* MY TASKS TAB */}
        {activeTab === 'mine' && (
          <div className="space-y-4">
            {myTickets.length === 0 ? (
              <EmptyState message="No active tasks. Go to Queue to claim one." />
            ) : (
              myTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} statusBadge={statusBadge} highlight>
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Working for</p>
                      <LiveTimer from={t.assigned_at!} />
                    </div>
                    <button
                      onClick={() => openResolveModal(t)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2"
                    >
                      ✓ Mark Resolved
                    </button>
                  </div>
                </TicketCard>
              ))
            )}
          </div>
        )}

        {/* RESOLVED TAB */}
        {activeTab === 'resolved' && (
          <div className="space-y-4">
            {resolvedTickets.length === 0 ? (
              <EmptyState message="No resolved tickets yet." />
            ) : (
              resolvedTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} statusBadge={statusBadge}>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Resolution time</p>
                      <span className="font-semibold text-emerald-600 text-sm">
                        {timeDiff(t.created_at, t.resolved_at!)}
                      </span>
                    </div>
                    {t.feedback && (
                      <div className="text-right">
                        {t.feedback.rating ? (
                          <p className="text-yellow-500 text-lg">{'⭐'.repeat(t.feedback.rating)}</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">No client rating yet</p>
                        )}
                        {t.feedback.comments && (
                          <p className="text-xs text-gray-400 italic mt-0.5 max-w-xs text-right">
                            "{t.feedback.comments}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </TicketCard>
              ))
            )}
          </div>
        )}

        {/* ENQUIRIES TAB */}
        {activeTab === 'enquiries' && (
          <div className="space-y-4">
            {enquiries.length === 0 ? (
              <EmptyState message="No new enquiries yet." />
            ) : (
              enquiries.map((e) => (
                <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{e.name}</p>
                      <a
                        href={`tel:${e.phone}`}
                        className="text-emerald-600 font-semibold text-sm hover:underline"
                      >
                        📞 {e.phone}
                      </a>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-xl">{e.details}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* RESOLVE MODAL */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Mark as Resolved</h2>
            <p className="text-gray-500 text-sm mb-5">
              {resolveModal.customer_name} — {resolveModal.issue_type}
            </p>

            {resolveModal.push_token && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 text-sm text-emerald-700">
                📲 Client will receive a push notification when resolved.
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Resolution Note (visible to client)</label>
              <textarea
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                placeholder="e.g. Cleared temp folders and successfully updated database tables"
                rows={3}
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-xl p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setResolveModal(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={sendingNotif}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                {sendingNotif ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : '✓ Confirm Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket: t,
  statusBadge,
  highlight = false,
  children,
}: {
  ticket: Ticket;
  statusBadge: (s: TicketStatus) => React.ReactNode;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition ${highlight ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-lg font-bold text-gray-900">{t.customer_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Serial: {t.tally_serial} &nbsp;|&nbsp; {t.email} &nbsp;|&nbsp; 📞 {t.mobile}
          </p>
        </div>
        {statusBadge(t.status)}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
          📁 {t.issue_type}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 rounded-xl p-3">
        {t.description}
      </p>

      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

function timeDiff(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
