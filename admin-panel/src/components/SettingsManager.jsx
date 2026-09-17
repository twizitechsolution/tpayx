import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SettingsManager = ({ token, theme }) => {
  const [level1, setLevel1] = useState(10);
  const [level2, setLevel2] = useState(5);
  const [level3, setLevel3] = useState(2);
  const [minPlanAmount, setMinPlanAmount] = useState(200);
  const [maxPlanAmount, setMaxPlanAmount] = useState(100000);
  const [telegramLink, setTelegramLink] = useState('https://t.me/TpayX');
  const [winpeyApiKey, setWinpeyApiKey] = useState('488b923c-2b03-465e-b9df-55d018124e0c');
  const [winpeyApiSecret, setWinpeyApiSecret] = useState('fc4a56a2439f47c19213c747ee5693c6');
  const [paymentMode, setPaymentMode] = useState('gateway');
  const [upiIds, setUpiIds] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Commission Slabs State
  const [slabs, setSlabs] = useState([]);
  const [slabLoading, setSlabLoading] = useState(false);
  const [slabMsg, setSlabMsg] = useState('');
  const [slabErr, setSlabErr] = useState('');

  // Add Slab Form State
  const [newMin, setNewMin] = useState('');
  const [newMax, setNewMax] = useState('');
  const [newPct, setNewPct] = useState('');
  const [newFlat, setNewFlat] = useState('');
  const [addingSlab, setAddingSlab] = useState(false);

  // Edit Slab Form State
  const [editingSlabId, setEditingSlabId] = useState(null);
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const [editPct, setEditPct] = useState('');
  const [editFlat, setEditFlat] = useState('');

  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [rotationInterval, setRotationInterval] = useState(2);
  const [rotationMin, setRotationMin] = useState(35);
  const [rotationMax, setRotationMax] = useState(50);
  const [rotationSaving, setRotationSaving] = useState(false);
  const [rotationMsg, setRotationMsg] = useState('');

  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL || '/api';
  const API_ADMIN_BASE = `${API_BASE}/admin`;

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_ADMIN_BASE}/settings`, getHeaders());
      if (res.data.success && res.data.settings) {
        const s = res.data.settings;
        setLevel1(s.level1_commission);
        setLevel2(s.level2_commission);
        setLevel3(s.level3_commission);
        if (s.min_plan_amount !== undefined) setMinPlanAmount(s.min_plan_amount);
        if (s.max_plan_amount !== undefined) setMaxPlanAmount(s.max_plan_amount);
        if (s.telegram_link) setTelegramLink(s.telegram_link);
        if (s.winpey_api_key) setWinpeyApiKey(s.winpey_api_key);
        if (s.winpey_api_secret) setWinpeyApiSecret(s.winpey_api_secret);
        setPaymentMode(s.payment_mode || 'gateway');
        setUpiIds(s.upi_ids ? s.upi_ids.split(',').join('\n') : '');
      }
    } catch { setError('Failed to load settings.'); }
    finally { setLoading(false); }

    try {
      const rRes = await axios.get(`${API_ADMIN_BASE}/rotation-config`, getHeaders());
      if (rRes.data.success) {
        const c = rRes.data.config;
        setRotationEnabled(c.enabled);
        setRotationInterval(c.intervalMinutes);
        setRotationMin(c.minTotal);
        setRotationMax(c.maxTotal);
      }
    } catch {}
  };

  const fetchSlabs = async () => {
    setSlabLoading(true);
    try {
      const res = await axios.get(`${API_ADMIN_BASE}/commission-slabs`, getHeaders());
      if (res.data.success) {
        setSlabs(res.data.slabs || []);
      }
    } catch (e) {
      console.error('Failed to load commission slabs:', e);
    } finally {
      setSlabLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSlabs();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const l1 = Number(level1), l2 = Number(level2), l3 = Number(level3);
    const minP = Number(minPlanAmount), maxP = Number(maxPlanAmount);
    if (isNaN(l1)||isNaN(l2)||isNaN(l3)) { setError('Please enter valid numeric commission values'); return; }
    if (isNaN(minP)||isNaN(maxP)||minP < 0||maxP <= minP) { setError('Please enter valid Minimum and Maximum Plan Amounts'); return; }
    if ([l1,l2,l3].some(v => v < 0 || v > 100)) { setError('Percentages must be 0–100'); return; }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_ADMIN_BASE}/settings`,
        { 
          level1_commission: l1, 
          level2_commission: l2, 
          level3_commission: l3, 
          min_plan_amount: minP,
          max_plan_amount: maxP,
          telegram_link: telegramLink,
          winpey_api_key: winpeyApiKey,
          winpey_api_secret: winpeyApiSecret,
          payment_mode: paymentMode,
          upi_ids: upiIds.split('\n').map(s => s.trim()).filter(Boolean).join(',')
        },
        getHeaders()
      );
      if (res.data.success) { setSuccess('Settings updated successfully!'); fetchSettings(); setTimeout(() => setSuccess(''), 4500); }
    } catch (err) { setError(err.response?.data?.error || 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const handleAddSlab = async (e) => {
    e.preventDefault();
    setSlabMsg(''); setSlabErr('');
    if (!newMin || !newMax || !newPct) {
      setSlabErr('Please enter Min Amount, Max Amount, and Bonus Percentage.');
      return;
    }
    setAddingSlab(true);
    try {
      const res = await axios.post(`${API_ADMIN_BASE}/commission-slabs`, {
        min_amount: Number(newMin),
        max_amount: Number(newMax),
        commission_percent: Number(newPct),
        flat_bonus: Number(newFlat || 0)
      }, getHeaders());
      if (res.data.success) {
        setSlabMsg(res.data.message || 'Commission slab added successfully!');
        setNewMin(''); setNewMax(''); setNewPct(''); setNewFlat('');
        fetchSlabs();
        setTimeout(() => setSlabMsg(''), 4500);
      }
    } catch (err) {
      setSlabErr(err.response?.data?.error || 'Failed to add commission slab');
    } finally {
      setAddingSlab(false);
    }
  };

  const handleStartEditSlab = (slab) => {
    setEditingSlabId(slab.id);
    setEditMin(String(slab.min_amount));
    setEditMax(String(slab.max_amount));
    setEditPct(String(slab.commission_percent));
    setEditFlat(String(slab.flat_bonus || 0));
  };

  const handleSaveEditSlab = async (id) => {
    setSlabMsg(''); setSlabErr('');
    try {
      const res = await axios.put(`${API_ADMIN_BASE}/commission-slabs/${id}`, {
        min_amount: Number(editMin),
        max_amount: Number(editMax),
        commission_percent: Number(editPct),
        flat_bonus: Number(editFlat || 0)
      }, getHeaders());
      if (res.data.success) {
        setSlabMsg('Slab updated successfully!');
        setEditingSlabId(null);
        fetchSlabs();
        setTimeout(() => setSlabMsg(''), 4500);
      }
    } catch (err) {
      setSlabErr(err.response?.data?.error || 'Failed to update slab');
    }
  };

  const handleDeleteSlab = async (id) => {
    if (!window.confirm('Are you sure you want to delete this commission slab?')) return;
    setSlabMsg(''); setSlabErr('');
    try {
      const res = await axios.delete(`${API_ADMIN_BASE}/commission-slabs/${id}`, getHeaders());
      if (res.data.success) {
        setSlabMsg('Slab deleted successfully!');
        fetchSlabs();
        setTimeout(() => setSlabMsg(''), 4500);
      }
    } catch (err) {
      setSlabErr(err.response?.data?.error || 'Failed to delete slab');
    }
  };

  const handleSaveRotation = async () => {
    setRotationSaving(true);
    try {
      const res = await axios.post(`${API_ADMIN_BASE}/rotation-config`, {
        enabled: rotationEnabled, intervalMinutes: Number(rotationInterval),
        minTotal: Number(rotationMin), maxTotal: Number(rotationMax),
      }, getHeaders());
      if (res.data.success) { setRotationMsg('Rotation config saved!'); setTimeout(() => setRotationMsg(''), 4000); }
    } catch { setRotationMsg('Failed to save.'); }
    finally { setRotationSaving(false); }
  };

  const handleAdminPasswordChange = async (e) => {
    e.preventDefault();
    setPassErr(''); setPassMsg('');
    if (!currPass || !newPass || !confirmPass) { setPassErr('Please fill all password fields'); return; }
    if (newPass !== confirmPass) { setPassErr('New password & confirmation do not match'); return; }
    if (newPass.length < 5) { setPassErr('New password must be at least 5 characters'); return; }

    setPassSubmitting(true);
    try {
      const res = await axios.post(`${API_ADMIN_BASE}/change-password`, {
        currentPassword: currPass,
        newPassword: newPass,
        confirmPassword: confirmPass
      }, getHeaders());
      if (res.data.success) {
        setPassMsg(res.data.message || 'Password updated successfully!');
        setCurrPass(''); setNewPass(''); setConfirmPass('');
        setTimeout(() => setPassMsg(''), 4500);
      }
    } catch (err) {
      setPassErr(err.response?.data?.error || 'Failed to update password');
    } finally {
      setPassSubmitting(false);
    }
  };

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-[#131427] border-[#1b1c34]/50' : 'bg-white border-slate-200';
  const text1  = isDark ? 'text-white' : 'text-slate-800';
  const text2  = isDark ? 'text-slate-400' : 'text-slate-500';
  const inp    = isDark ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400';
  const row    = isDark ? 'bg-[#181931]/30 border-[#1b1c34]/50' : 'bg-slate-50/50 border-slate-100';

  const levelBadge = (label) => {
    const map = {
      L1: isDark ? 'bg-blue-600/20 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100',
      L2: isDark ? 'bg-amber-600/20 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100',
      L3: isDark ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };
    return <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${map[label]}`}>{label}</div>;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* 1. DYNAMIC COMMISSION SETUP CARD (Amount Range Bonus Slabs) */}
      <div className={`border rounded-[1.8rem] p-6 md:p-8 shadow-md ${cardBg}`}>
        <div className="border-b border-gray-100/10 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-base font-bold uppercase tracking-wide flex items-center gap-2 ${text1}`}>
                <i className="fas fa-calculator text-violet-500" /> Dynamic Commission Setup (Bonus Slabs)
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Configure bonus % and extra +₹ rewards based on deposit amount ranges
              </p>
            </div>
            <span className="text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-1 rounded-full font-mono font-bold uppercase">
              {slabs.length} Active Slabs
            </span>
          </div>
        </div>

        {slabMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl p-3 text-xs font-bold mb-4"><i className="fas fa-check-circle mr-1" />{slabMsg}</div>}
        {slabErr && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl p-3 text-xs font-bold mb-4"><i className="fas fa-exclamation-triangle mr-1" />{slabErr}</div>}

        {/* Existing Slabs List Table */}
        <div className="space-y-3 mb-6">
          {slabLoading ? (
            <div className="text-center py-6 text-slate-500 text-xs font-bold uppercase"><i className="fas fa-spinner fa-spin mr-2" /> Loading bonus slabs...</div>
          ) : slabs.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs font-bold uppercase">No commission slabs configured yet. Add your first slab below.</div>
          ) : (
            slabs.map((slab, index) => (
              <div key={slab.id || index} className={`border rounded-2xl p-4 transition-all ${row}`}>
                {editingSlabId === slab.id ? (
                  /* Edit Slab Form Inline */
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Min Amount (₹)</label>
                      <input type="number" value={editMin} onChange={e => setEditMin(e.target.value)} className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold ${inp}`} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Max Amount (₹)</label>
                      <input type="number" value={editMax} onChange={e => setEditMax(e.target.value)} className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold ${inp}`} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Bonus %</label>
                      <input type="number" step="0.1" value={editPct} onChange={e => setEditPct(e.target.value)} className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold ${inp}`} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Extra +₹</label>
                      <input type="number" step="1" value={editFlat} onChange={e => setEditFlat(e.target.value)} className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold ${inp}`} />
                    </div>
                    <div className="flex gap-2 justify-end sm:mt-4">
                      <button onClick={() => handleSaveEditSlab(slab.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase active:scale-95 transition-all">Save</button>
                      <button onClick={() => setEditingSlabId(null)} className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase active:scale-95 transition-all">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* Slab Display Row */
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/20">
                        #{index + 1}
                      </div>
                      <div>
                        <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>
                          ₹{Number(slab.min_amount).toLocaleString('en-IN')} – ₹{Number(slab.max_amount).toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                          Amount Range Limit
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-extrabold text-sm text-emerald-400 block">
                          {slab.commission_percent}% {Number(slab.flat_bonus) > 0 ? `+ ₹${slab.flat_bonus}` : ''}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">
                          Calculated Reward
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleStartEditSlab(slab)} className="w-8 h-8 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs active:scale-95 transition-all" title="Edit Slab">
                          <i className="fas fa-edit" />
                        </button>
                        <button onClick={() => handleDeleteSlab(slab.id)} className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs active:scale-95 transition-all" title="Delete Slab">
                          <i className="fas fa-trash-alt" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add New Slab Form */}
        <form onSubmit={handleAddSlab} className={`border rounded-2xl p-5 space-y-4 ${row}`}>
          <h4 className={`text-xs font-black uppercase tracking-wider ${text1}`}>+ Add New Commission Slab</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${text2}`}>Min Amount (₹)</label>
              <input type="number" min="0" placeholder="e.g. 500" value={newMin} onChange={e => setNewMin(e.target.value)} className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${inp}`} required />
            </div>
            <div>
              <label className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${text2}`}>Max Amount (₹)</label>
              <input type="number" min="0" placeholder="e.g. 10000" value={newMax} onChange={e => setNewMax(e.target.value)} className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${inp}`} required />
            </div>
            <div>
              <label className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${text2}`}>Bonus %</label>
              <input type="number" step="0.1" min="0" max="100" placeholder="e.g. 2.5" value={newPct} onChange={e => setNewPct(e.target.value)} className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${inp}`} required />
            </div>
            <div>
              <label className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${text2}`}>Extra +₹ (Flat)</label>
              <input type="number" step="1" min="0" placeholder="e.g. 6" value={newFlat} onChange={e => setNewFlat(e.target.value)} className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${inp}`} />
            </div>
          </div>
          <button type="submit" disabled={addingSlab} className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
            {addingSlab ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-plus-circle" /> Add Slab Rule</>}
          </button>
        </form>
      </div>

      {/* 2. REFERRAL & PLAN LIMITS SETTINGS CARD */}
      <div className={`border rounded-[1.8rem] p-6 md:p-8 shadow-md ${cardBg}`}>
        <div className="border-b border-gray-100/10 pb-4 mb-6">
          <h3 className={`text-base font-bold uppercase tracking-wide ${text1}`}>Referral &amp; Plan Limits Setup</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configure multi-level sponsorship commissions and plan display bounds</p>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500 font-bold uppercase tracking-wider text-xs">
            <i className="fas fa-spinner fa-spin mr-2" /> Syncing configuration settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl p-4 text-xs font-bold uppercase tracking-wide"><i className="fas fa-exclamation-triangle mr-2" />{error}</div>}
            {success && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl p-4 text-xs font-bold uppercase tracking-wide"><i className="fas fa-check-circle mr-2" />{success}</div>}

            {/* Plan Display Range Limits (Min & Max Plan Amount) */}
            <div className={`border rounded-2xl p-5 space-y-3.5 ${row}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${isDark ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                  <i className="fas fa-sliders-h text-base" />
                </div>
                <div>
                  <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>Plan Display Bounds (Min &amp; Max Plan)</span>
                  <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">
                    Only plans within this range will be displayed to users in the app (e.g. Max ₹1,00,000)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Minimum Plan Amount (₹)</label>
                  <input type="number" min="0" value={minPlanAmount} onChange={e => setMinPlanAmount(e.target.value)} className={`w-full border rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none ${inp}`} required />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Maximum Plan Amount (₹)</label>
                  <input type="number" min="1" value={maxPlanAmount} onChange={e => setMaxPlanAmount(e.target.value)} className={`w-full border rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none ${inp}`} required />
                </div>
              </div>
            </div>

            {/* Sponsorship Level Commissions */}
            {[
              { label: 'L1', title: 'Level 1 (Direct sponsor)', sub: 'Rewarded to immediate parent', val: level1, set: setLevel1 },
              { label: 'L2', title: 'Level 2 (Grandparent sponsor)', sub: "Rewarded to sponsor's parent", val: level2, set: setLevel2 },
              { label: 'L3', title: 'Level 3 (Great-grandparent sponsor)', sub: "Rewarded to L2 sponsor's parent", val: level3, set: setLevel3 },
            ].map(({ label, title, sub, val, set }) => (
              <div key={label} className={`border rounded-2xl p-5 flex items-center justify-between gap-4 ${row}`}>
                <div className="flex items-center gap-3.5">
                  {levelBadge(label)}
                  <div>
                    <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>{title}</span>
                    <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">{sub}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 max-w-[120px] shrink-0">
                  <input type="number" step="0.1" min="0" max="100" value={val} onChange={e => set(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-extrabold text-center focus:outline-none ${inp}`} required />
                  <span className={`text-xs font-extrabold ${text2}`}>%</span>
                </div>
              </div>
            ))}

            {/* Telegram */}
            <div className={`border rounded-2xl p-5 flex flex-col gap-3.5 ${row}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${isDark ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  <i className="fab fa-telegram-plane text-base" />
                </div>
                <div>
                  <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>Telegram Support URL</span>
                  <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">Opens when users click Customer Support inside app</span>
                </div>
              </div>
              <input type="url" placeholder="https://t.me/your_channel" value={telegramLink} onChange={e => setTelegramLink(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none ${inp}`} required />
            </div>

            {/* Recharge & Payment Settings */}
            <div className={`border rounded-2xl p-5 space-y-4 ${row}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${isDark ? 'bg-violet-600/20 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-100'}`}>
                  <i className="fas fa-credit-card text-base" />
                </div>
                <div>
                  <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>Recharge &amp; Payment Options</span>
                  <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">Configure recharge modes and direct UPI accounts</span>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${text2}`}>Active Recharge Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('gateway')}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                      paymentMode === 'gateway'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                        : isDark ? 'bg-[#0d0d1a] border border-[#1b1c34] text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Payment Gateway
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('manual')}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                      paymentMode === 'manual'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                        : isDark ? 'bg-[#0d0d1a] border border-[#1b1c34] text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Manual UPI
                  </button>
                </div>
              </div>

              {paymentMode === 'manual' && (
                <div className="space-y-2">
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${text2}`}>Manual UPI IDs (One per line)</label>
                  <textarea
                    rows="4"
                    placeholder="Enter UPI IDs, e.g.:&#10;tpayx1@upi&#10;tpayx2@upi"
                    value={upiIds}
                    onChange={(e) => setUpiIds(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-xs font-mono font-semibold focus:outline-none focus:border-violet-500 ${inp}`}
                    required={paymentMode === 'manual'}
                  />
                  <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    Enter each UPI ID on a separate line. The app will cycle randomly through these IDs to balance deposit load.
                  </span>
                </div>
              )}
            </div>

            {/* Winpey Payment Gateway API Key & Secret */}
            <div className={`border rounded-2xl p-5 space-y-4 ${row}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${isDark ? 'bg-amber-600/20 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                  <i className="fas fa-key text-base" />
                </div>
                <div>
                  <span className={`font-black text-xs uppercase tracking-wide block ${text1}`}>Payment Gateway API Credentials</span>
                  <span className="block text-[8px] text-slate-500 font-black tracking-[0.1em] uppercase mt-1">Winpey Merchant API Key and Secret Signature</span>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Winpey API Key (X-Api-Key)</label>
                <input type="text" placeholder="Enter Winpey API Key" value={winpeyApiKey} onChange={e => setWinpeyApiKey(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-xs font-mono font-semibold focus:outline-none ${inp}`} required />
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Winpey API Secret (X-Api-Secret)</label>
                <input type="text" placeholder="Enter Winpey API Secret" value={winpeyApiSecret} onChange={e => setWinpeyApiSecret(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-xs font-mono font-semibold focus:outline-none ${inp}`} required />
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-60">
              {submitting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-save mr-1" />Save Global Settings</>}
            </button>
          </form>
        )}
      </div>

      {/* 3. AUTO PLAN ROTATION CARD */}
      <div className={`border rounded-[1.8rem] p-6 md:p-8 shadow-md ${cardBg}`}>
        <div className="border-b border-gray-100/10 pb-4 mb-6">
          <h3 className={`text-base font-bold uppercase tracking-wide ${text1}`}>
            <i className="fas fa-sync-alt mr-2 text-violet-500" />Auto Plan Rotation
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Backend auto-creates &amp; deletes plans every interval to keep the platform feeling live
          </p>
        </div>

        {rotationMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl p-3 text-xs font-bold mb-4">
            <i className="fas fa-check-circle mr-1" />{rotationMsg}
          </div>
        )}

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className={`border rounded-2xl p-5 flex items-center justify-between ${row}`}>
            <div>
              <span className={`font-black text-xs uppercase tracking-wide ${text1}`}>Enable Auto Rotation</span>
              <span className="block text-[9px] text-slate-500 mt-1">Automatically creates &amp; removes plans on schedule</span>
            </div>
            <button onClick={() => setRotationEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rotationEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rotationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Interval */}
          <div className={`border rounded-2xl p-5 flex items-center justify-between gap-4 ${row}`}>
            <div>
              <span className={`font-black text-xs uppercase tracking-wide ${text1}`}>Rotation Interval</span>
              <span className="block text-[9px] text-slate-500 mt-1">How often new plans are created/deleted</span>
            </div>
            <div className="flex items-center gap-2 max-w-[140px] shrink-0">
              <input type="number" min="1" max="60" value={rotationInterval} onChange={e => setRotationInterval(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs font-extrabold text-center focus:outline-none ${inp}`} />
              <span className={`text-xs font-extrabold whitespace-nowrap ${text2}`}>min</span>
            </div>
          </div>

          {/* Plan count range */}
          <div className={`border rounded-2xl p-5 flex items-center justify-between gap-4 ${row}`}>
            <div>
              <span className={`font-black text-xs uppercase tracking-wide ${text1}`}>Plan Count Range</span>
              <span className="block text-[9px] text-slate-500 mt-1">Keep total active plans within this limit</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" min="5" value={rotationMin} onChange={e => setRotationMin(e.target.value)}
                className={`w-16 border rounded-xl px-2 py-2 text-xs font-extrabold text-center focus:outline-none ${inp}`} />
              <span className={`text-xs ${text2}`}>–</span>
              <input type="number" min="5" value={rotationMax} onChange={e => setRotationMax(e.target.value)}
                className={`w-16 border rounded-xl px-2 py-2 text-xs font-extrabold text-center focus:outline-none ${inp}`} />
            </div>
          </div>
        </div>

        <button onClick={handleSaveRotation} disabled={rotationSaving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-60 mt-6">
          {rotationSaving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-save mr-1" />Save Rotation Config</>}
        </button>
      </div>

      {/* 4. ADMIN PASSWORD CHANGE CARD */}
      <div className={`border rounded-[1.8rem] p-6 md:p-8 shadow-md ${cardBg}`}>
        <div className="border-b border-gray-100/10 pb-4 mb-6">
          <h3 className={`text-base font-bold uppercase tracking-wide ${text1}`}>
            <i className="fas fa-shield-alt mr-2 text-violet-500" />Admin Security &amp; Password
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Update your administrator credentials for accessing the control panel
          </p>
        </div>

        {passMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl p-3 text-xs font-bold mb-4">
            <i className="fas fa-check-circle mr-1" />{passMsg}
          </div>
        )}
        {passErr && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl p-3 text-xs font-bold mb-4">
            <i className="fas fa-exclamation-triangle mr-1" />{passErr}
          </div>
        )}

        <form onSubmit={handleAdminPasswordChange} className="space-y-4">
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Current Admin Password</label>
            <input type="password" required placeholder="Enter current password..." value={currPass} onChange={e => setCurrPass(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none ${inp}`} />
          </div>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>New Admin Password</label>
            <input type="password" required placeholder="Enter new password (min 5 chars)..." value={newPass} onChange={e => setNewPass(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none ${inp}`} />
          </div>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${text2}`}>Confirm New Admin Password</label>
            <input type="password" required placeholder="Re-enter new password..." value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none ${inp}`} />
          </div>

          <button type="submit" disabled={passSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-60 mt-6">
            {passSubmitting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-lock mr-1" />Update Admin Password</>}
          </button>
        </form>
      </div>

    </div>
  );
};

export default SettingsManager;
