import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SliderManager from './components/SliderManager';
import ProductManager from './components/ProductManager';
import MessageManager from './components/MessageManager';
import SettingsManager from './components/SettingsManager';
import DisputeManager from './components/DisputeManager';

const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/admin`;

// Live 15-Minute Countdown Timer Component for Deposit Orders Queue
const OrderTimer = ({ createdAt, timerExpiry, status }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const targetTime = timerExpiry
        ? new Date(timerExpiry).getTime()
        : (new Date(createdAt).getTime() + 15 * 60 * 1000);
      const diffMs = targetTime - Date.now();

      if (diffMs <= 0) {
        setTimeLeft('15m Expired');
        setIsExpired(true);
      } else {
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s left`);
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt, timerExpiry]);

  if (['Completed', 'Canceled', 'Cancelled'].includes(status)) {
    return <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ended</span>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 select-none">
      <span className={`inline-flex items-center gap-1 font-mono font-extrabold text-[10px] px-2.5 py-1 rounded-full border ${
        isExpired || status === 'Admin Review'
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
      }`}>
        <i className="fas fa-clock text-[9px]" />
        {timeLeft}
      </span>
    </div>
  );
};

// Protected Layout Wrapper
const ProtectedLayout = ({ children, token, handleLogout, theme, setTheme }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || 'Tushar Admin');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(adminName);

  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [submittingChangePass, setSubmittingChangePass] = useState(false);
  const [changePassAlert, setChangePassAlert] = useState({ type: '', msg: '' });

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setChangePassAlert({ type: '', msg: '' });
    if (!currentPassInput || !newPassInput || !confirmPassInput) {
      setChangePassAlert({ type: 'error', msg: 'Please fill all password fields.' });
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setChangePassAlert({ type: 'error', msg: 'New password & confirmation do not match.' });
      return;
    }
    if (newPassInput.length < 5) {
      setChangePassAlert({ type: 'error', msg: 'New password must be at least 5 characters.' });
      return;
    }

    setSubmittingChangePass(true);
    try {
      const res = await axios.post(
        `${API_BASE}/change-password`,
        {
          currentPassword: currentPassInput,
          newPassword: newPassInput,
          confirmPassword: confirmPassInput
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setChangePassAlert({ type: 'success', msg: res.data.message || 'Password changed successfully!' });
        setCurrentPassInput('');
        setNewPassInput('');
        setConfirmPassInput('');
        setTimeout(() => {
          setShowChangePassModal(false);
          setChangePassAlert({ type: '', msg: '' });
        }, 2000);
      }
    } catch (err) {
      setChangePassAlert({ type: 'error', msg: err.response?.data?.error || 'Failed to update password.' });
    } finally {
      setSubmittingChangePass(false);
    }
  };

  const pageTitles = {
    dashboard: 'Dashboard Overview',
    orders: 'Deposit Orders Queue',
    users: 'Registered Users Directory',
    sliders: 'Manage Home Banners',
    products: 'Manage Investment Products',
    messages: 'Manage Broadcast Messages',
    settings: 'Configure Referral Commissions',
    disputes: 'P2P Disputes Board'
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans theme-transition ${
      theme === 'dark' ? 'bg-[#15162a] text-[#f8fafc]' : 'bg-[#f4f5f9] text-[#1e293b]'
    }`}>
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-64 md:static md:translate-x-0 flex flex-col justify-between shrink-0 select-none border-r theme-transition transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        theme === 'dark' ? 'bg-[#131427] border-[#1b1c34]/50' : 'bg-white border-slate-200'
      }`}>
        <div>
          {/* Brand header */}
          <div className={`h-16 flex items-center justify-between px-6 border-b theme-transition ${
            theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-xs shadow-md shadow-blue-500/20 select-none">TX</div>
              <div>
                <span className={`font-black text-sm tracking-wider uppercase block leading-none ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>TpayX</span>
                <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">Management</span>
              </div>
            </div>
            {/* Close button inside sidebar on mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
            >
              <i className="fas fa-times" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="mt-6 px-4 space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
              { id: 'orders', label: 'Deposit Orders', icon: 'fas fa-shopping-bag' },
              { id: 'users', label: 'Users Directory', icon: 'fas fa-users' },
              { id: 'sliders', label: 'Home Banners', icon: 'fas fa-image' },
              { id: 'products', label: 'Manage Products', icon: 'fas fa-boxes' },
              { id: 'messages', label: 'Broadcast Messages', icon: 'fas fa-envelope' },
              { id: 'settings', label: 'Commission Setup', icon: 'fas fa-percent' },
              { id: 'disputes', label: 'Disputes Board', icon: 'fas fa-gavel' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowProfileDropdown(false);
                  setShowNotificationsDropdown(false);
                  setIsSidebarOpen(false); // Close sidebar on mobile select
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:bg-[#181931] hover:text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <i className={`${tab.icon} w-5 text-center text-sm`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Theme toggle & Logout */}
        <div className={`p-4 border-t space-y-4 theme-transition ${
          theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'
        }`}>
          <div className="flex items-center justify-between gap-4">
            {/* Live Theme Toggle widget */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border theme-transition ${
              theme === 'dark' ? 'bg-[#181931] border-[#1b1c34]/60' : 'bg-slate-55 border-slate-200'
            }`}>
              <i className={`fas fa-moon text-xs ${theme === 'dark' ? 'text-amber-400' : 'text-slate-400'}`} />
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-9 h-5 rounded-full relative p-0.5 transition-all duration-300 ${
                  theme === 'dark' ? 'bg-violet-600' : 'bg-slate-300'
                }`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                  theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
              <i className={`fas fa-sun text-xs ${theme === 'light' ? 'text-amber-500' : 'text-slate-500'}`} />
            </div>

            <button
              onClick={handleLogout}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-red-500 transition-colors border active:scale-95 ${
                theme === 'dark' ? 'bg-red-950/20 border-red-900/30 hover:bg-red-950/40' : 'bg-red-50 border-red-100 hover:bg-red-100'
              }`}
              title="Logout"
            >
              <i className="fas fa-sign-out-alt text-sm" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className={`h-16 border-b flex items-center justify-between px-4 md:px-8 select-none theme-transition ${
          theme === 'dark' ? 'bg-[#131427]/80 border-[#1b1c34]/50' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`md:hidden w-9 h-9 rounded-xl border flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer mr-1 ${
                theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'
              }`}
            >
              <i className="fas fa-bars" />
            </button>
            <h1 className={`text-xs sm:text-base font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-800'} truncate max-w-[120px] sm:max-w-none`}>
              {pageTitles[activeTab]}
            </h1>
            <span className="text-[8px] sm:text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 sm:px-2 py-0.5 rounded font-mono uppercase tracking-widest font-black select-none whitespace-nowrap">
              Port 5001 Active
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Header controls layout */}
            <div className="flex items-center gap-2">
              {/* Notification Bell Widget */}
              <div className="relative">
                <span 
                  onClick={() => {
                    setShowNotificationsDropdown(!showNotificationsDropdown);
                    setShowProfileDropdown(false);
                  }}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs select-none cursor-pointer relative ${
                    theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <i className="fas fa-bell" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse border border-[#131427]" />
                </span>
                
                {showNotificationsDropdown && (
                  <div className={`absolute right-0 mt-2 w-72 rounded-2xl p-4 shadow-xl z-50 border text-xs ${
                    theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <h4 className="font-bold border-b pb-2 mb-2 uppercase tracking-wider select-none">Notifications</h4>
                    <div className="space-y-2.5">
                      <div className="flex gap-2.5 items-start">
                        <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                        <div>
                          <span className="font-bold block select-none">Live Connection Connected</span>
                          <span className="text-[10px] text-slate-500">API port 5001 is active</span>
                        </div>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="w-2 h-2 rounded-full bg-violet-500 mt-1 shrink-0" />
                        <div>
                          <span className="font-bold block select-none">Dashboard Loaded</span>
                          <span className="text-[10px] text-slate-500">Analytics cards are fully synced</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Avatar Widget */}
            <div className="relative">
              <div 
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowNotificationsDropdown(false);
                }}
                className={`h-9 flex items-center gap-2.5 pl-3 border-l cursor-pointer select-none ${
                  theme === 'dark' ? 'border-[#1b1c34]' : 'border-slate-200'
                }`}
              >
                <img 
                  src="/admin_avatar.png" 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-violet-500 object-cover shadow-sm"
                />
                <div className="hidden md:block text-left">
                  <div className={`text-xs font-black uppercase tracking-wider ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{adminName}</div>
                  <div className="text-[9px] text-slate-500 font-bold tracking-widest uppercase flex items-center gap-1">
                    Global Role <i className="fas fa-chevron-down text-[8px] opacity-70" />
                  </div>
                </div>
              </div>
              
              {showProfileDropdown && (
                <div className={`absolute right-0 mt-2 w-48 rounded-2xl p-2.5 shadow-xl z-50 border text-xs ${
                  theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="px-3.5 py-2 border-b select-none">
                    {isEditingName ? (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="text" 
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className={`w-full px-2 py-1 rounded border text-[11px] font-bold focus:outline-none focus:border-violet-500 ${
                            theme === 'dark' ? 'bg-[#0d0d1a] border-[#1b1c34] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (tempName.trim()) {
                                setAdminName(tempName.trim());
                                localStorage.setItem('adminName', tempName.trim());
                              }
                              setIsEditingName(false);
                            } else if (e.key === 'Escape') {
                              setIsEditingName(false);
                            }
                          }}
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button 
                            onClick={() => {
                              if (tempName.trim()) {
                                setAdminName(tempName.trim());
                                localStorage.setItem('adminName', tempName.trim());
                              }
                              setIsEditingName(false);
                            }}
                            className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase hover:bg-emerald-600 active:scale-95 transition-all"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setIsEditingName(false)}
                            className="bg-slate-500 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase hover:bg-slate-600 active:scale-95 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="cursor-pointer group flex items-center justify-between"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempName(adminName);
                          setIsEditingName(true);
                        }}
                        title="Click to edit name"
                      >
                        <div className="truncate">
                          <span className="font-bold block group-hover:text-violet-500 transition-colors truncate">{adminName}</span>
                          <span className="text-[10px] text-slate-500 block truncate">tushar@TpayX.com</span>
                        </div>
                        <i className="fas fa-pen text-slate-500 text-[10px] opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempName(adminName);
                        setIsEditingName(true);
                      }}
                      className={`w-full text-left px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-violet-600 hover:text-white transition-colors`}
                    >
                      Edit Name
                    </button>
                    <button 
                      onClick={() => {
                        setActiveTab('products');
                        setShowProfileDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-violet-600 hover:text-white transition-colors`}
                    >
                      Edit Products
                    </button>
                    <button 
                      onClick={() => {
                        setShowChangePassModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-violet-600 hover:text-white transition-colors flex items-center gap-2`}
                    >
                      <i className="fas fa-key text-[10px]" /> Change Password
                    </button>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setShowProfileDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider text-[10px] text-red-500 hover:bg-red-500 hover:text-white transition-colors`}
                    >
                      Logout Panel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Change Admin Password Modal */}
        {showChangePassModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
            <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all duration-300 ${
              theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex justify-between items-center mb-4 border-b border-slate-700/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/20">
                    <i className="fas fa-key" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Change Admin Password</h3>
                    <p className="text-[9px] text-slate-500">Update workspace security credentials</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowChangePassModal(false);
                    setChangePassAlert({ type: '', msg: '' });
                  }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {changePassAlert.msg && (
                <div className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2 ${
                  changePassAlert.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}>
                  <i className={`fas ${changePassAlert.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`} />
                  <span>{changePassAlert.msg}</span>
                </div>
              )}

              <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password..."
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none ${
                      theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min 5 chars)..."
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none ${
                      theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password..."
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none ${
                      theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                    }`}
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassModal(false);
                      setChangePassAlert({ type: '', msg: '' });
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all ${
                      theme === 'dark' ? 'bg-[#181931] text-slate-300 hover:bg-[#1b1c34]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingChangePass}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {submittingChangePass ? <i className="fas fa-spinner fa-spin" /> : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dynamic page render */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-panel">
          {React.cloneElement(children, { activeTab, theme })}
        </main>
      </div>
    </div>
  );
};

// Login View
const Login = ({ setToken }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
      if (res.data.success && res.data.token) {
        localStorage.setItem('adminToken', res.data.token);
        setToken(res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Connection error. Check backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-[#0d0d1a] font-sans p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600 rounded-full blur-3xl opacity-10 pointer-events-none"></div>

      <div className="w-full max-w-sm bg-[#131427] border border-[#1b1c34]/80 rounded-[2rem] p-8 shadow-2xl relative">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/20 mb-4 select-none">TX</div>
          <h2 className="text-lg font-black tracking-widest text-white uppercase">TpayX <span className="text-blue-500">Admin</span></h2>
          <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider select-none">Enter credential details below</p>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 text-xs text-red-400 mb-6 flex gap-2 items-center">
            <i className="fas fa-exclamation-circle text-base shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full bg-[#0d0d1a] border border-[#1b1c34] rounded-xl px-4 py-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0d0d1a] border border-[#1b1c34] rounded-xl px-4 py-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-all font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs tracking-wider uppercase"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin text-sm" />
                <span>Syncing Session...</span>
              </>
            ) : (
              <span>Login Workspace</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// Dashboard View
const Dashboard = ({ token, handleLogout, activeTab, theme }) => {
  const [stats, setStats] = useState({ totalUsers: 0, totalVolume: 0, pendingOrders: 0, completedOrders: 0, canceledOrders: 0 });
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserForWithdraw, setSelectedUserForWithdraw] = useState(null);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [withdrawUtrInput, setWithdrawUtrInput] = useState('');
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [selectedUserForBalance, setSelectedUserForBalance] = useState(null);
  const [editBalanceInput, setEditBalanceInput] = useState('');
  const [submittingBalance, setSubmittingBalance] = useState(false);

  // Setup axios authentication headers
  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Stats
      const statsRes = await axios.get(`${API_BASE}/stats`, getAuthHeaders());
      if (statsRes.data.success) setStats(statsRes.data.stats);

      // 2. Orders
      const ordersRes = await axios.get(`${API_BASE}/orders`, getAuthHeaders());
      if (ordersRes.data.success) setOrders(ordersRes.data.orders);

      // 3. Users
      const usersRes = await axios.get(`${API_BASE}/users`, getAuthHeaders());
      if (usersRes.data.success) setUsers(usersRes.data.users);
    } catch (error) {
      console.error('Fetch error:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleApprove = async (orderId) => {
    try {
      const res = await axios.post(`${API_BASE}/orders/${orderId}/approve`, {}, getAuthHeaders());
      if (res.data.success) {
        triggerToast(`Order ${orderId} approved successfully! User wallet credited.`);
        setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Completed' } : o));
        fetchData();
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Approval failed.');
    }
  };

  const handleCancel = async (orderId) => {
    try {
      const res = await axios.post(`${API_BASE}/orders/${orderId}/cancel`, {}, getAuthHeaders());
      if (res.data.success) {
        triggerToast(`Order ${orderId} canceled.`);
        setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Canceled' } : o));
        fetchData();
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Cancellation failed.');
    }
  };

  const handleOpenWithdrawModal = (user) => {
    setSelectedUserForWithdraw(user);
    setWithdrawAmountInput('');
    setWithdrawUtrInput('');
    setShowWithdrawModal(true);
  };

  const handleOpenHistoryModal = async (user) => {
    setSelectedUserForHistory(user);
    setUserWithdrawals([]);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE}/users/${user.id}/withdrawals`, getAuthHeaders());
      if (res.data.success) {
        setUserWithdrawals(res.data.withdrawals || []);
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Failed to fetch withdrawals history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateWithdrawal = async () => {
    if (!withdrawAmountInput || isNaN(Number(withdrawAmountInput)) || Number(withdrawAmountInput) <= 0) {
      triggerToast('Please enter a valid amount greater than 0.');
      return;
    }
    if (!withdrawUtrInput || withdrawUtrInput.trim().length === 0) {
      triggerToast('Please enter a valid UTR number.');
      return;
    }
    try {
      const res = await axios.post(
        `${API_BASE}/users/${selectedUserForWithdraw.id}/withdraw`,
        { 
          amount: Number(withdrawAmountInput),
          utr: withdrawUtrInput.trim()
        },
        getAuthHeaders()
      );
      if (res.data.success) {
        triggerToast(res.data.message || 'Withdrawal debited successfully.');
        setShowWithdrawModal(false);
        fetchData();
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Failed to request withdrawal debit.');
    }
  };

  const handleOpenEditBalanceModal = (user) => {
    setSelectedUserForBalance(user);
    setEditBalanceInput(String(user.bcoin_balance));
    setShowEditBalanceModal(true);
  };

  const handleUpdateBalance = async () => {
    if (editBalanceInput === '' || isNaN(Number(editBalanceInput)) || Number(editBalanceInput) < 0) {
      triggerToast('Please enter a valid balance greater than or equal to 0.');
      return;
    }
    setSubmittingBalance(true);
    try {
      const res = await axios.post(
        `${API_BASE}/users/${selectedUserForBalance.id}/balance`,
        { bcoin_balance: Number(editBalanceInput) },
        getAuthHeaders()
      );
      if (res.data.success) {
        triggerToast(res.data.message || 'Balance updated successfully.');
        setShowEditBalanceModal(false);
        fetchData();
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Failed to update balance.');
    } finally {
      setSubmittingBalance(false);
    }
  };

  const handleToggleBlock = async (user) => {
    try {
      const res = await axios.post(`${API_BASE}/users/${user.id}/toggle-block`, {}, getAuthHeaders());
      if (res.data.success) {
        triggerToast(res.data.message);
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_blocked: res.data.is_blocked } : u));
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || 'Failed to change block status.');
    }
  };

  const formatCurrency = (val) => {
    return typeof val === 'number' ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  };

  // Filter users by search
  const filteredUsers = users.filter(u => 
    u.uid.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
    u.mobile.includes(userSearch)
  );

  // SVG Trend graph coordinates calculations
  const chartData = stats.chartData || [];
  const maxVal = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1000);
  
  const pointsDeposits = chartData.map((d, index) => {
    const x = (index * (380 / 6)) + 40;
    const y = 160 - (d.deposits / maxVal) * 120;
    return `${x},${y}`;
  }).join(' ');

  const pointsWithdrawals = chartData.map((d, index) => {
    const x = (index * (380 / 6)) + 40;
    const y = 160 - (d.withdrawals / maxVal) * 120;
    return `${x},${y}`;
  }).join(' ');

  // Create standard class names
  const cardStyle = theme === 'dark'
    ? 'bg-[#131427] border-[#1b1c34]/50'
    : 'bg-white border-slate-200';

  const tableHeadStyle = theme === 'dark'
    ? 'bg-[#181931] border-[#1b1c34]/60 text-slate-400'
    : 'bg-slate-50 border-slate-200 text-slate-600';

  const titleColor = theme === 'dark' ? 'text-white' : 'text-slate-800';
  const subtitleColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-8 select-none">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#131427] border border-[#1b1c34] text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-slide-in">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
            <i className="fas fa-info-circle text-xs" />
          </div>
          <span className="text-xs font-semibold pr-2">{toastMsg}</span>
        </div>
      )}

      {loading && (
        <div className={`text-center py-16 rounded-[2rem] border ${cardStyle}`}>
          <i className="fas fa-spinner fa-spin text-3xl text-violet-500 mb-3" />
          <div className="text-sm font-black uppercase tracking-wider">Syncing database workspace...</div>
        </div>
      )}

      {!loading && activeTab === 'dashboard' && (
        <>
          {/* Top KPI Cards Grid matching premium sparklines */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Card 1: Users */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>Users</span>
                <h3 className={`text-2xl font-black mt-2 leading-none ${titleColor}`}>{stats.totalUsers || 0}</h3>
                <span className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center gap-1 leading-none">
                  <i className="fas fa-arrow-up" /> +23%
                </span>
              </div>
              <svg className="w-20 h-10 overflow-visible shrink-0" viewBox="0 0 100 40">
                <path d="M0,35 Q20,10 40,25 T80,5 T100,20" fill="none" stroke="#22c55e" strokeWidth="2.5" className="sparkline-path" />
              </svg>
            </div>

            {/* Card 2: Deposits */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>Deposits</span>
                <h3 className={`text-xl font-black mt-2 leading-none ${titleColor}`}>₹{formatCurrency(stats.totalDeposits || 0)}</h3>
                <span className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center gap-1 leading-none">
                  <i className="fas fa-arrow-up" /> +12%
                </span>
              </div>
              <svg className="w-20 h-10 overflow-visible shrink-0" viewBox="0 0 100 40">
                <path d="M0,25 Q20,5 40,30 T80,10 T100,5" fill="none" stroke="#22c55e" strokeWidth="2.5" className="sparkline-path" />
              </svg>
            </div>

            {/* Card 3: Withdrawals */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>Withdrawals</span>
                <h3 className={`text-xl font-black mt-2 leading-none ${titleColor}`}>₹{formatCurrency(stats.totalWithdrawals || 0)}</h3>
                <span className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1 leading-none">
                  <i className="fas fa-arrow-down" /> -8%
                </span>
              </div>
              <svg className="w-20 h-10 overflow-visible shrink-0" viewBox="0 0 100 40">
                <path d="M0,10 Q20,35 40,15 T80,38 T100,30" fill="none" stroke="#f43f5e" strokeWidth="2.5" className="sparkline-path" />
              </svg>
            </div>

            {/* Card 4: Active Loop */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>Active Loop</span>
                <h3 className={`text-xl font-black mt-2 leading-none ${titleColor}`}>₹{formatCurrency(stats.totalActivePlans || 0)}</h3>
                <span className="text-[10px] text-indigo-500 font-bold mt-2 flex items-center gap-1 leading-none">
                  <i className="fas fa-chart-line" /> +15%
                </span>
              </div>
              <svg className="w-20 h-10 overflow-visible shrink-0" viewBox="0 0 100 40">
                <path d="M0,35 Q30,15 50,30 T100,8" fill="none" stroke="#6366f1" strokeWidth="2.5" className="sparkline-path" />
              </svg>
            </div>
          </div>

          {/* Visual Rows */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
            
            {/* Column 1: Real-time progress + Devices */}
            <div className="space-y-8">
              {/* Real-time statistics meter */}
              <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
                <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Real-time stats</h3>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1 mb-6`}>Live transaction metrics</p>
                
                <div className="space-y-4">
                  {[
                    { label: 'Online visitor check', value: '545', max: '600', color: 'bg-violet-600' },
                    { label: 'Pending Deposit Orders', value: stats.pendingOrders || 0, max: '50', color: 'bg-amber-500' },
                    { label: 'Completed Transactions', value: stats.completedOrders || 0, max: '500', color: 'bg-emerald-500' },
                    { label: 'Canceled requests pool', value: stats.canceledOrders || 0, max: '100', color: 'bg-rose-500' }
                  ].map((bar, idx) => {
                    const widthPercent = Math.min((parseFloat(bar.value) / parseFloat(bar.max)) * 100, 100) || 5;
                    return (
                      <div key={idx} className="space-y-2 select-none">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className={subtitleColor}>{bar.label}</span>
                          <span className={titleColor}>{bar.value} / {bar.max}</span>
                        </div>
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-[#181931]' : 'bg-slate-100'}`}>
                          <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${widthPercent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Devices Donut Chart */}
              <div className={`border rounded-[1.8rem] p-6 shadow-md flex flex-col items-center justify-between min-h-[220px] ${cardStyle}`}>
                <div className="w-full text-left">
                  <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Devices & Status</h3>
                </div>

                <div className="flex items-center gap-6 my-4 select-none">
                  {/* SVG Donut */}
                  <svg className="w-24 h-24 overflow-visible" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="35" fill="none" stroke={theme === 'dark' ? '#1c1d39' : '#f1f5f9'} strokeWidth="10" />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#8b5cf6" strokeWidth="10" strokeDasharray="220" strokeDashoffset="55" strokeLinecap="round" transform="rotate(-90 50 50)" />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#22c55e" strokeWidth="10" strokeDasharray="220" strokeDashoffset="160" strokeLinecap="round" transform="rotate(60 50 50)" />
                    <text x="50" y="47" textAnchor="middle" dominantBaseline="middle" className={`text-[12px] font-black ${theme === 'dark' ? 'fill-white' : 'fill-slate-800'}`}>Active</text>
                    <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" className={`text-[9px] font-bold ${theme === 'dark' ? 'fill-slate-400' : 'fill-slate-500'}`}>{stats.totalUsers} profiles</text>
                  </svg>

                  <div className="space-y-1.5 text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-600" />
                      <span className={subtitleColor}>Normal User: 75%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className={subtitleColor}>Active Agents: 25%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Dual Line Site Traffic Chart */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex flex-col justify-between lg:col-span-2 ${cardStyle}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Site Transaction Traffic</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1`}>Comparison of approved orders</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold select-none uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className={subtitleColor}>Deposits</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className={subtitleColor}>Withdrawals</span>
                  </div>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="relative pt-4 pb-2 select-none">
                  <svg className="w-full h-56 mt-4 overflow-visible" viewBox="0 0 460 200">
                    <defs>
                      <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="withGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = 160 - ratio * 120;
                      return (
                        <g key={idx}>
                          <line x1="40" y1={y} x2="420" y2={y} stroke={theme === 'dark' ? '#1b1c34' : '#f1f5f9'} strokeDasharray="4 4" strokeWidth="1" />
                          <text x="32" y={y + 3} fill="#64748b" className="text-[8px] font-bold" textAnchor="end">
                            ₹{formatCurrency(ratio * maxVal)}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* X axis labels */}
                    {chartData.map((d, idx) => {
                      const x = (idx * (380 / 6)) + 40;
                      return (
                        <text key={idx} x={x} y="185" fill="#64748b" className="text-[8px] font-bold" textAnchor="middle">
                          {d.date}
                        </text>
                      );
                    })}

                    {/* Deposits Area */}
                    {pointsDeposits && (
                      <polygon
                        fill="url(#depGrad)"
                        points={`40,160 ${pointsDeposits} ${(chartData.length - 1) * (380 / 6) + 40},160`}
                      />
                    )}

                    {/* Withdrawals Area */}
                    {pointsWithdrawals && (
                      <polygon
                        fill="url(#withGrad)"
                        points={`40,160 ${pointsWithdrawals} ${(chartData.length - 1) * (380 / 6) + 40},160`}
                      />
                    )}

                    {/* Deposits path */}
                    {pointsDeposits && (
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pointsDeposits}
                      />
                    )}

                    {/* Withdrawals path */}
                    {pointsWithdrawals && (
                      <polyline
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pointsWithdrawals}
                      />
                    )}

                    {/* Point circles */}
                    {chartData.map((d, idx) => {
                      const x = (idx * (380 / 6)) + 40;
                      const yDep = 160 - (d.deposits / maxVal) * 120;
                      const yWith = 160 - (d.withdrawals / maxVal) * 120;
                      return (
                        <g key={idx}>
                          <circle cx={x} cy={yDep} r="3" fill="#3b82f6" stroke={theme === 'dark' ? '#131427' : '#fff'} strokeWidth="1.5" />
                          <circle cx={x} cy={yWith} r="3" fill="#f43f5e" stroke={theme === 'dark' ? '#131427' : '#fff'} strokeWidth="1.5" />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 font-medium">No transaction trends seeded yet.</div>
              )}
            </div>
          </div>

          {/* Bottom Row split: Time spent + Active plans */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Middle time on site (column chart) */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex flex-col justify-between ${cardStyle}`}>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Middle time on site</h3>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1 mb-4`}>Daily session duration spikes</p>
              </div>

              {chartData.length > 0 ? (
                <div className="pt-2 select-none">
                  <svg className="w-full h-32 overflow-visible" viewBox="0 0 100 60">
                    {chartData.map((d, idx) => {
                      const height = Math.min((d.deposits / maxVal) * 45, 45) || 5;
                      const x = 10 + idx * 13;
                      const y = 50 - height;
                      return (
                        <g key={idx}>
                          <rect x={x} y={y} width="7" height={height} rx="1.5" fill="#8b5cf6" className="transition-all duration-300 hover:fill-violet-400" />
                          <text x={x + 3.5} y="58" textAnchor="middle" className={`text-[4px] font-black ${theme === 'dark' ? 'fill-slate-500' : 'fill-slate-400'}`}>{d.date}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">No chart coordinates mapped.</div>
              )}
            </div>

            {/* Active Plans Breakdown */}
            <div className={`border rounded-[1.8rem] p-6 shadow-md flex flex-col lg:col-span-2 ${cardStyle}`}>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Active Plans Breakdown</h3>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1 mb-5`}>Volume distribution of investments</p>
              </div>
              
              <div className="space-y-3 overflow-y-auto max-h-[220px] pr-2 scrollbar-none flex-1">
                {stats.activePlansBreakdown && stats.activePlansBreakdown.length > 0 ? (
                  stats.activePlansBreakdown.map(p => (
                    <div key={p.id} className={`border rounded-2xl p-4 flex items-center justify-between shadow-sm ${
                      theme === 'dark' ? 'bg-[#181931]/60 border-[#1b1c34]/50' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          p.type === 'USDT' ? 'bg-amber-600/20 text-amber-500 border border-amber-500/20' : 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                        }`}>
                          {p.type === 'USDT' ? 'U' : '₹'}
                        </div>
                        <div>
                          <span className={`font-black text-xs uppercase tracking-wide block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{p.name}</span>
                          <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            Base: ₹{formatCurrency(p.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-extrabold text-sm block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>₹{formatCurrency(p.totalValue)}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mt-1 border ${
                          theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          {p.count} active
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500">No plans breakdown seeded.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Orders View */}
      {!loading && activeTab === 'orders' && (
        <div className={`border rounded-[1.8rem] overflow-hidden shadow-md ${cardStyle}`}>
          <div className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'}`}>
            <div>
              <span className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Transactions Queue</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Pending payments awaiting verification</p>
            </div>
            <button
              onClick={fetchData}
              className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 w-fit ${
                theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-55 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-sync-alt" /> Sync Queue
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className={`border-b font-black uppercase tracking-wider ${tableHeadStyle}`}>
                  <th className="px-6 py-4">Order Details</th>
                  <th className="px-6 py-4">User Mobile</th>
                  <th className="px-6 py-4">Reference/Asset</th>
                  <th className="px-6 py-4">Assigned Receiver</th>
                  <th className="px-6 py-4 text-center">15-Min Timer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1c34]/40">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                      No deposit orders found in database.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.order_id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <span className={`font-semibold block font-mono text-[12px] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{order.order_id}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">
                          {new Date(order.created_at).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{order.user_mobile}</span>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">UID: {order.user_uid}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                            Asset: <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>{order.asset_type}</span>
                          </span>
                          <span className="text-[11px] font-mono text-violet-400 font-bold block">
                            UTR: {order.utr || 'NOT_SUBMITTED'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-[11px]">
                          <span className="font-bold text-emerald-400 block">{order.receiver_name || 'Tushar Admin'}</span>
                          <span className="text-slate-400 font-mono block text-[10px]">Mob: {order.receiver_mobile || '8763527330'}</span>
                          <span className="text-slate-500 text-[10px] block leading-tight">
                            {order.receiver_bank || 'HDFC Bank'} (A/C: {order.receiver_account || 'N/A'})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <OrderTimer createdAt={order.created_at} timerExpiry={order.timer_expiry} status={order.status} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>₹{formatCurrency(order.amount)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            order.status === 'Confirming'
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              : order.status === 'Admin Review'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold'
                              : order.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-rose-500/10 text-red-500 border-rose-500/20'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {['Confirming', 'Admin Review', 'Pending'].includes(order.status) ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleApprove(order.order_id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs"
                            >
                              <i className="fas fa-check" /> Approve
                            </button>
                            <button
                              onClick={() => handleCancel(order.order_id)}
                              className={`font-bold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 uppercase tracking-wider text-xs border ${
                                theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-red-400 hover:bg-red-500 hover:text-white' : 'bg-red-50 border-red-100 text-red-500 hover:bg-red-500 hover:text-white'
                              }`}
                            >
                              <i className="fas fa-times" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic pr-3">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users View */}
      {!loading && activeTab === 'users' && (
        <div className={`border rounded-[1.8rem] overflow-hidden shadow-md ${cardStyle}`}>
          <div className={`p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'}`}>
            <div>
              <span className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Users Directory</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Directory of registered user wallets</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search UID, Name or Mobile..."
                className={`border rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none w-48 ${
                  theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white placeholder-slate-600 focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-violet-400'
                }`}
              />
              <button
                onClick={fetchData}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 ${
                  theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-sync-alt" /> Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className={`border-b font-black uppercase tracking-wider ${tableHeadStyle}`}>
                  <th className="px-6 py-4">User UID</th>
                  <th className="px-6 py-4">Mobile</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">INR Balance</th>
                  <th className="px-6 py-4">T Coin</th>
                  <th className="px-6 py-4">Total Earnings</th>
                  <th className="px-6 py-4">Withdrawals</th>
                  <th className="px-6 py-4">Bank Details</th>
                  <th className="px-6 py-4">Registered</th>
                  <th className="px-6 py-4 text-center">Access Control</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1c34]/40">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                      No user records match the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <span className={`font-semibold block font-mono text-[12px] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{u.uid}</span>
                        <span className={`text-[10px] block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{u.username || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{u.mobile}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          u.is_blocked 
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {u.is_blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-emerald-500 text-sm">₹{formatCurrency(u.inr_balance)}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-amber-500 text-sm">
                        <div className="flex items-center gap-1.5 justify-start">
                          <span>{formatCurrency(u.bcoin_balance)}</span>
                          <button
                            onClick={() => handleOpenEditBalanceModal(u)}
                            className="text-slate-400 hover:text-amber-500 active:scale-95 transition-all p-1"
                            title="Edit T Coin Balance"
                          >
                            <i className="fas fa-pencil-alt text-[10px]" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-extrabold text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>₹{formatCurrency(u.total_earnings)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-rose-500 text-sm">₹{formatCurrency(u.total_withdrawals)}</span>
                      </td>
                      <td className="px-6 py-4">
                        {u.bank_details ? (
                          <div className={`text-[10px] leading-normal ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            <div className="font-bold">{u.bank_details.bank_name}</div>
                            <div>A/C: {u.bank_details.account_number}</div>
                            <div>IFSC: {u.bank_details.ifsc_code}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">No bank account</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-bold uppercase tracking-wide">
                        {new Date(u.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleBlock(u)}
                          className={`font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center gap-1 mx-auto ${
                            u.is_blocked 
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' 
                              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
                          }`}
                          title={u.is_blocked ? "Unblock this user account" : "Block this user account"}
                        >
                          <i className={`fas ${u.is_blocked ? 'fa-unlock' : 'fa-ban'}`} />
                          {u.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleOpenWithdrawModal(u)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-rose-500/10"
                        >
                          Withdrawal
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenHistoryModal(u)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-indigo-500/10"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Withdrawal Debit Modal */}
          {showWithdrawModal && selectedUserForWithdraw && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Debit Withdrawal</h3>
                  <button 
                    onClick={() => setShowWithdrawModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                
                <div className={`p-4 rounded-2xl mb-4 text-xs leading-relaxed ${
                  theme === 'dark' ? 'bg-[#181931] text-slate-300' : 'bg-slate-50 text-slate-600'
                }`}>
                  <div className="flex justify-between mb-1">
                    <span>User UID:</span>
                    <span className="font-mono font-bold">{selectedUserForWithdraw.uid}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Mobile:</span>
                    <span className="font-bold">{selectedUserForWithdraw.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>T Coin Balance:</span>
                    <span className="font-bold text-amber-500">{formatCurrency(selectedUserForWithdraw.bcoin_balance)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Debit Amount (₹)</label>
                    <input
                      type="text"
                      placeholder="Enter withdrawal amount..."
                      value={withdrawAmountInput}
                      onChange={(e) => setWithdrawAmountInput(e.target.value.replace(/\D/g, ''))}
                      className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none ${
                        theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                      }`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">UTR Number</label>
                    <input
                      type="text"
                      placeholder="Enter transaction UTR..."
                      value={withdrawUtrInput}
                      onChange={(e) => setWithdrawUtrInput(e.target.value.replace(/\s/g, ''))}
                      className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none ${
                        theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all ${
                      theme === 'dark' ? 'bg-[#181931] text-slate-300 hover:bg-[#1b1c34]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWithdrawal}
                    className="flex-1 py-3 rounded-2xl bg-[#f43f5e] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#f43f5e]/25 active:scale-95 transition-all hover:bg-rose-500"
                  >
                    Submit Debit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Balance Modal */}
          {showEditBalanceModal && selectedUserForBalance && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Adjust T Coin Balance</h3>
                  <button 
                    onClick={() => setShowEditBalanceModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                
                <div className={`p-4 rounded-2xl mb-4 text-xs leading-relaxed ${
                  theme === 'dark' ? 'bg-[#181931] text-slate-300' : 'bg-slate-50 text-slate-600'
                }`}>
                  <div className="flex justify-between mb-1">
                    <span>User UID:</span>
                    <span className="font-mono font-bold">{selectedUserForBalance.uid}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Mobile:</span>
                    <span className="font-bold">{selectedUserForBalance.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current T Coin:</span>
                    <span className="font-bold text-amber-500">{formatCurrency(selectedUserForBalance.bcoin_balance)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">New T Coin Balance</label>
                    <input
                      type="text"
                      placeholder="Enter new balance..."
                      value={editBalanceInput}
                      onChange={(e) => setEditBalanceInput(e.target.value.replace(/[^\d.]/g, ''))}
                      className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none ${
                        theme === 'dark' ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowEditBalanceModal(false)}
                    className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all ${
                      theme === 'dark' ? 'bg-[#181931] text-slate-300 hover:bg-[#1b1c34]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateBalance}
                    disabled={submittingBalance}
                    className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 active:scale-95 transition-all hover:bg-amber-600 flex items-center justify-center gap-1.5"
                  >
                    {submittingBalance ? <i className="fas fa-spinner fa-spin" /> : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal History Modal */}
          {showHistoryModal && selectedUserForHistory && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-[#131427] border-[#1b1c34] text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Withdrawal History</h3>
                    <p className="text-[10px] text-slate-400 mt-1">UID: {selectedUserForHistory.uid} | Mobile: {selectedUserForHistory.mobile}</p>
                  </div>
                  <button 
                    onClick={() => setShowHistoryModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[300px] pr-1">
                  {loadingHistory ? (
                    <div className="text-center py-10 text-xs text-slate-400 select-none">
                      <i className="fas fa-spinner fa-spin mr-2" /> Loading history...
                    </div>
                  ) : userWithdrawals.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500 font-bold uppercase tracking-wider">
                      No withdrawal records found.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className={`border-b font-bold uppercase tracking-wider ${theme === 'dark' ? 'border-[#1b1c34] text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                          <th className="py-2.5">Date</th>
                          <th className="py-2.5">Description</th>
                          <th className="py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#1b1c34]/50' : 'divide-slate-50'}`}>
                        {userWithdrawals.map(w => (
                          <tr key={w.id} className="transition-colors hover:bg-slate-50/5">
                            <td className="py-2.5 text-slate-400 font-semibold">{new Date(w.created_at).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 text-slate-300 font-semibold">{w.description}</td>
                            <td className="py-2.5 text-right font-bold text-rose-500">₹{Math.abs(w.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all ${
                      theme === 'dark' ? 'bg-[#181931] text-slate-300 hover:bg-[#1b1c34]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Sliders, Products, and Messages manager renders */}
      {!loading && activeTab === 'sliders' && (
        <SliderManager token={token} theme={theme} />
      )}

      {!loading && activeTab === 'products' && (
        <ProductManager token={token} theme={theme} />
      )}

      {!loading && activeTab === 'messages' && (
        <MessageManager token={token} theme={theme} />
      )}

      {!loading && activeTab === 'settings' && (
        <SettingsManager token={token} theme={theme} />
      )}

      {!loading && activeTab === 'disputes' && (
        <DisputeManager token={token} theme={theme} />
      )}
    </div>
  );
};

// Main Routing App Content
const AppContent = () => {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [theme, setTheme] = useState('dark');

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={!token ? <Login setToken={setToken} /> : <Navigate to="/" replace />}
      />
      <Route
        path="/"
        element={
          token ? (
            <ProtectedLayout token={token} handleLogout={handleLogout} theme={theme} setTheme={setTheme}>
              <Dashboard token={token} handleLogout={handleLogout} theme={theme} />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;

