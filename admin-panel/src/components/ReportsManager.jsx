import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReportsManager = ({ token, theme }) => {
  const [range, setRange] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [preset, setPreset] = useState('today'); // 'today', 'yesterday', 'past7', 'thisMonth', 'lastMonth'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    statementDate: selectedDate,
    kpis: {
      dailyDeposits: 0,
      completedDepositsCount: 0,
      dailyWithdrawals: 0,
      completedWithdrawalsCount: 0,
      netPlatformFlow: 0,
      recurringDeposits: 0,
      recurringPercent: 0,
      repeatUsersCount: 0,
      newRegistrations: 0
    },
    activityLog: {
      deposits: [],
      withdrawals: [],
      newUsers: []
    }
  });

  // Activity log tab state: 'deposits', 'withdrawals', 'users'
  const [activeLogTab, setActiveLogTab] = useState('deposits');
  // Sub-filter for deposits: 'all', 'ftd', 'recurring'
  const [depositSubFilter, setDepositSubFilter] = useState('all');

  const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const API_ADMIN = rawApiUrl.endsWith('/api') ? `${rawApiUrl}/admin` : `${rawApiUrl}/api/admin`;

  const fetchReports = async (overridePreset, overrideRange, overrideDate) => {
    setLoading(true);
    try {
      const p = overridePreset !== undefined ? overridePreset : preset;
      const r = overrideRange !== undefined ? overrideRange : range;
      const d = overrideDate !== undefined ? overrideDate : selectedDate;

      const res = await axios.get(`${API_ADMIN}/reports`, {
        params: { range: r, preset: p, date: d },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(preset, range, selectedDate);
  }, []);

  const handleRangeChange = (newRange) => {
    setRange(newRange);
    let newPreset = preset;
    if (newRange === 'daily') newPreset = 'today';
    else if (newRange === 'weekly') newPreset = 'past7';
    else if (newRange === 'monthly') newPreset = 'thisMonth';
    setPreset(newPreset);
    fetchReports(newPreset, newRange, selectedDate);
  };

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    let newRange = range;
    if (newPreset === 'past7') newRange = 'weekly';
    else if (newPreset === 'thisMonth' || newPreset === 'lastMonth') newRange = 'monthly';
    else newRange = 'daily';
    setRange(newRange);
    fetchReports(newPreset, newRange, selectedDate);
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    setPreset('');
    fetchReports('', range, val);
  };

  const kpis = reportData.kpis || {};
  const activity = reportData.activityLog || { deposits: [], withdrawals: [], newUsers: [] };

  // Calculate filtered deposits
  const allDeposits = activity.deposits || [];
  const ftdDeposits = allDeposits.filter(d => d.is_ftd);
  const recurringDepositsList = allDeposits.filter(d => !d.is_ftd);

  const ftdSum = ftdDeposits.reduce((acc, d) => acc + (d.amount || 0), 0);
  const recurringSum = recurringDepositsList.reduce((acc, d) => acc + (d.amount || 0), 0);

  let displayedDeposits = allDeposits;
  if (depositSubFilter === 'ftd') displayedDeposits = ftdDeposits;
  else if (depositSubFilter === 'recurring') displayedDeposits = recurringDepositsList;

  const cardStyle = theme === 'dark'
    ? 'bg-[#131427] border-[#1b1c34]/80 text-white'
    : 'bg-white border-slate-200 text-slate-800';

  const subtitleColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header with Title and Range Bar */}
      <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title Area */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-600/20 shrink-0">
              <i className="fas fa-chart-pie" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider">Financial & Operational Reports</h2>
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live
                </span>
              </div>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${subtitleColor} mt-0.5`}>
                {range.toUpperCase()} STATEMENT FOR {reportData.statementDate || selectedDate}
              </p>
            </div>
          </div>

          {/* Filter Bar Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Range Toggle: DAILY / WEEKLY / MONTHLY */}
            <div className={`p-1 rounded-2xl border flex items-center gap-1 ${theme === 'dark' ? 'bg-[#0d0d1a] border-[#1b1c34]' : 'bg-slate-100 border-slate-200'}`}>
              {[
                { id: 'daily', label: 'Daily', icon: 'fas fa-calendar-day' },
                { id: 'weekly', label: 'Weekly', icon: 'fas fa-calendar-week' },
                { id: 'monthly', label: 'Monthly', icon: 'fas fa-calendar-alt' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => handleRangeChange(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    range === r.id
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className={`${r.icon} text-[9px]`} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            {/* Date Input */}
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className={`border rounded-2xl px-3.5 py-2 text-xs font-mono font-bold focus:outline-none focus:border-violet-500 ${
                theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />

            {/* Presets */}
            <div className="flex items-center gap-1">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'past7', label: 'Past 7 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'lastMonth', label: 'Last Month' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    preset === p.id
                      ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-600/25'
                      : theme === 'dark'
                      ? 'bg-[#181931] border-[#1b1c34] text-slate-400 hover:text-white hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sync Button */}
            <button
              onClick={() => fetchReports()}
              disabled={loading}
              className="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-60"
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Daily Deposits */}
        <div className={`border rounded-[1.6rem] p-5 shadow-md flex items-center justify-between ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${subtitleColor}`}>Daily Deposits</span>
            <div className="text-xl font-black text-emerald-400 mt-1 leading-none">
              ₹{Number(kpis.dailyDeposits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`text-[9px] font-bold block mt-1.5 ${subtitleColor}`}>
              <span className="text-emerald-400 font-extrabold">{kpis.completedDepositsCount || 0}</span> completed orders
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm shrink-0">
            <i className="fas fa-arrow-down" />
          </div>
        </div>

        {/* KPI 2: Daily Withdrawals */}
        <div className={`border rounded-[1.6rem] p-5 shadow-md flex items-center justify-between ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${subtitleColor}`}>Daily Withdrawals</span>
            <div className="text-xl font-black text-rose-400 mt-1 leading-none">
              ₹{Number(kpis.dailyWithdrawals || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`text-[9px] font-bold block mt-1.5 ${subtitleColor}`}>
              <span className="text-rose-400 font-extrabold">{kpis.completedWithdrawalsCount || 0}</span> payouts executed
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-sm shrink-0">
            <i className="fas fa-arrow-up" />
          </div>
        </div>

        {/* KPI 3: Net Platform Flow */}
        <div className={`border rounded-[1.6rem] p-5 shadow-md flex items-center justify-between ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${subtitleColor}`}>Net Platform Flow</span>
            <div className={`text-xl font-black mt-1 leading-none ${Number(kpis.netPlatformFlow || 0) >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
              ₹{Number(kpis.netPlatformFlow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider mt-1.5 text-cyan-400">
              {Number(kpis.netPlatformFlow || 0) >= 0 ? '+ Inflow Positive' : '- Net Outflow'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm shrink-0">
            <i className="fas fa-wallet" />
          </div>
        </div>

        {/* KPI 4: Recurring Deposits */}
        <div className={`border rounded-[1.6rem] p-5 shadow-md flex items-center justify-between ${cardStyle}`}>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black uppercase tracking-wider block ${subtitleColor}`}>Recurring Deposits</span>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {kpis.recurringPercent || 0}%
              </span>
            </div>
            <div className="text-xl font-black text-indigo-400 mt-1 leading-none">
              ₹{Number(kpis.recurringDeposits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`text-[9px] font-bold block mt-1.5 ${subtitleColor}`}>
              <span className="text-indigo-400 font-extrabold">{kpis.repeatUsersCount || 0}</span> repeat users ({kpis.recurringPercent || 0}% retention)
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm shrink-0">
            <i className="fas fa-sync" />
          </div>
        </div>

        {/* KPI 5: New Registrations */}
        <div className={`border rounded-[1.6rem] p-5 shadow-md flex items-center justify-between ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${subtitleColor}`}>New Registrations</span>
            <div className="text-2xl font-black text-white mt-1 leading-none">
              {kpis.newRegistrations || 0}
            </div>
            <span className={`text-[9px] font-bold block mt-1.5 ${subtitleColor}`}>
              registered accounts
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-sm shrink-0">
            <i className="fas fa-user-check" />
          </div>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className={`border rounded-[1.8rem] overflow-hidden shadow-md ${cardStyle}`}>
        {/* Activity Log Header */}
        <div className={`p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'
        }`}>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              Daily Activity Log: {reportData.statementDate || selectedDate}
            </h3>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-0.5`}>
              Detailed Transaction Records, Customer Deposit Sequence, and Member Signups
            </p>
          </div>

          {/* Activity Category Tabs: DEPOSITS / WITHDRAWALS / NEW USERS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveLogTab('deposits')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                activeLogTab === 'deposits'
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : theme === 'dark'
                  ? 'bg-[#181931] border-[#1b1c34] text-slate-400 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-arrow-down text-[10px]" />
              <span>Deposits ({activity.deposits?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveLogTab('withdrawals')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                activeLogTab === 'withdrawals'
                  ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30'
                  : theme === 'dark'
                  ? 'bg-[#181931] border-[#1b1c34] text-slate-400 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-arrow-up text-[10px]" />
              <span>Withdrawals ({activity.withdrawals?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveLogTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                activeLogTab === 'users'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                  : theme === 'dark'
                  ? 'bg-[#181931] border-[#1b1c34] text-slate-400 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-user-plus text-[10px]" />
              <span>New Users ({activity.newUsers?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Sub-Filters for Deposits */}
        {activeLogTab === 'deposits' && (
          <div className={`px-6 py-3 border-b flex items-center gap-3 text-xs ${
            theme === 'dark' ? 'bg-[#0f1021] border-[#1b1c34]/40' : 'bg-slate-50 border-slate-100'
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider ${subtitleColor}`}>Customer Type:</span>
            
            <button
              onClick={() => setDepositSubFilter('all')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                depositSubFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Deposits ({allDeposits.length})
            </button>

            <button
              onClick={() => setDepositSubFilter('ftd')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                depositSubFilter === 'ftd'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-star text-[8px] text-amber-400" />
              <span>First-Time FTD ({ftdDeposits.length} - ₹{ftdSum.toLocaleString('en-IN')})</span>
            </button>

            <button
              onClick={() => setDepositSubFilter('recurring')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                depositSubFilter === 'recurring'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-sync text-[8px] text-indigo-400" />
              <span>Recurring / Repeat ({recurringDepositsList.length} - ₹{recurringSum.toLocaleString('en-IN')})</span>
            </button>
          </div>
        )}

        {/* Tabular Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-slate-400 select-none">
              <i className="fas fa-spinner fa-spin text-2xl text-violet-500 block mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Syncing activity records...</span>
            </div>
          ) : (
            <>
              {/* 1. DEPOSITS LOG */}
              {activeLogTab === 'deposits' && (
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider text-[10px] ${
                      theme === 'dark' ? 'border-[#1b1c34] text-slate-400 bg-[#16172e]' : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}>
                      <th className="px-6 py-3.5">Order ID</th>
                      <th className="px-6 py-3.5">User UID / Mobile</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Customer Type</th>
                      <th className="px-6 py-3.5">UTR Reference</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#1b1c34]/50' : 'divide-slate-100'}`}>
                    {displayedDeposits.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                          No deposit activity found for selected range.
                        </td>
                      </tr>
                    ) : (
                      displayedDeposits.map(d => (
                        <tr key={d.id || d.order_id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                            {d.order_id}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-white block">{d.user_uid}</span>
                            <span className="text-[10px] text-slate-400 block">{d.user_mobile}</span>
                          </td>
                          <td className="px-6 py-4 font-black text-emerald-400">
                            ₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              d.is_ftd
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                            }`}>
                              <i className={`fas ${d.is_ftd ? 'fa-star' : 'fa-sync'} text-[8px]`} />
                              {d.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-300">
                            {d.utr || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                              d.status === 'Completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : d.status === 'Confirming'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">
                            {d.created_at ? new Date(d.created_at).toLocaleTimeString('en-IN') : '---'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* 2. WITHDRAWALS LOG */}
              {activeLogTab === 'withdrawals' && (
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider text-[10px] ${
                      theme === 'dark' ? 'border-[#1b1c34] text-slate-400 bg-[#16172e]' : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}>
                      <th className="px-6 py-3.5">User UID / Mobile</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Description / Note</th>
                      <th className="px-6 py-3.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#1b1c34]/50' : 'divide-slate-100'}`}>
                    {(activity.withdrawals || []).length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                          No withdrawal transactions recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      activity.withdrawals.map(w => (
                        <tr key={w.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4">
                            <span className="font-bold text-white block">{w.user_uid}</span>
                            <span className="text-[10px] text-slate-400 block">{w.user_mobile}</span>
                          </td>
                          <td className="px-6 py-4 font-black text-rose-400">
                            ₹{Number(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {w.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 text-[11px]">
                            {w.description || 'Payout execution'}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">
                            {w.created_at ? new Date(w.created_at).toLocaleTimeString('en-IN') : '---'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* 3. NEW USERS LOG */}
              {activeLogTab === 'users' && (
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider text-[10px] ${
                      theme === 'dark' ? 'border-[#1b1c34] text-slate-400 bg-[#16172e]' : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}>
                      <th className="px-6 py-3.5">User UID</th>
                      <th className="px-6 py-3.5">Mobile Number</th>
                      <th className="px-6 py-3.5">Referral Code</th>
                      <th className="px-6 py-3.5">INR Balance</th>
                      <th className="px-6 py-3.5">T Coin</th>
                      <th className="px-6 py-3.5 text-right">Joined Time</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#1b1c34]/50' : 'divide-slate-100'}`}>
                    {(activity.newUsers || []).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                          No new user registrations recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      activity.newUsers.map(u => (
                        <tr key={u.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                            {u.uid}
                          </td>
                          <td className="px-6 py-4 font-bold text-white">
                            {u.mobile}
                          </td>
                          <td className="px-6 py-4 font-mono text-amber-400 font-bold">
                            {u.invite_code}
                          </td>
                          <td className="px-6 py-4 text-emerald-400 font-bold">
                            ₹{Number(u.inr_balance || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-amber-400 font-bold">
                            ₹{Number(u.bcoin_balance || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">
                            {u.created_at ? new Date(u.created_at).toLocaleTimeString('en-IN') : '---'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsManager;
