import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/admin`;

const ProductManager = ({ token, theme }) => {
  const [subTab, setSubTab] = useState('products'); // 'products' or 'ranges'
  const [products, setProducts] = useState([]);
  const [priceRanges, setPriceRanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Product Form states
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [income, setIncome] = useState('');
  const [quota, setQuota] = useState('');
  const [color, setColor] = useState('blue');
  const [type, setType] = useState('Bank');
  const [percent, setPercent] = useState('2.5%+6');

  // Range Form states
  const [rangeLabel, setRangeLabel] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api';
      const prodRes = await axios.get(`${BASE}/products`);
      const rangeRes = await axios.get(`${BASE}/price-ranges`);
      if (prodRes.data.success) setProducts(prodRes.data.products);
      if (rangeRes.data.success) setPriceRanges(rangeRes.data.priceRanges);
    } catch (err) {
      console.error('Error fetching dynamic metadata:', err);
      setError('Failed to fetch products or price range settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerAlert = (msg, isSuccess = true) => {
    if (isSuccess) {
      setMessage(msg);
      setTimeout(() => setMessage(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Auto-calculate expected quota on amount & income change
  useEffect(() => {
    const amt = Number(amount) || 0;
    const inc = Number(income) || 0;
    setQuota(amt + inc);
  }, [amount, income]);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !amount) {
      triggerAlert('Product title and amount are required.', false);
      return;
    }

    try {
      const payload = {
        name,
        amount: Number(amount),
        income: Number(income || 0),
        quota: Number(quota || amount),
        color,
        type,
        percent
      };

      if (editingId) {
        const res = await axios.put(`${API_BASE}/products/${editingId}`, payload, getAuthHeaders());
        if (res.data.success) {
          triggerAlert('Product updated successfully!');
          resetProductForm();
          fetchData();
        }
      } else {
        const res = await axios.post(`${API_BASE}/products`, payload, getAuthHeaders());
        if (res.data.success) {
          triggerAlert('Product created successfully!');
          resetProductForm();
          fetchData();
        }
      }
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Failed to save product.', false);
    }
  };

  const handleEditClick = (p) => {
    setEditingId(p.id);
    setName(p.name);
    setAmount(p.amount);
    setIncome(p.income);
    setQuota(p.quota);
    setColor(p.color);
    setType(p.type);
    setPercent(p.percent);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this investment plan? Mobile users will no longer see it.')) return;
    try {
      const res = await axios.delete(`${API_BASE}/products/${id}`, getAuthHeaders());
      if (res.data.success) {
        triggerAlert('Product deleted successfully.');
        fetchData();
      }
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Failed to delete product.', false);
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setIncome('');
    setQuota('');
    setColor('blue');
    setType('Bank');
    setPercent('2.5%+6');
  };

  const handleAddRange = async (e) => {
    e.preventDefault();
    if (!rangeLabel || rangeMin === '' || rangeMax === '') {
      triggerAlert('All range bounds fields are required.', false);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/price-ranges`,
        {
          label: rangeLabel,
          min_val: Number(rangeMin),
          max_val: Number(rangeMax)
        },
        getAuthHeaders()
      );
      if (res.data.success) {
        triggerAlert('New filter price range added!');
        setRangeLabel('');
        setRangeMin('');
        setRangeMax('');
        fetchData();
      }
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Failed to add price range.', false);
    }
  };

  const handleDeleteRange = async (id) => {
    if (!window.confirm('Delete this filter range button?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/price-ranges/${id}`, getAuthHeaders());
      if (res.data.success) {
        triggerAlert('Filter range deleted successfully.');
        fetchData();
      }
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Failed to delete range.', false);
    }
  };

  const formatCurrency = (val) => {
    return typeof val === 'number' ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  };

  // Styled classes based on active theme
  const cardStyle = theme === 'dark'
    ? 'bg-[#131427] border-[#1b1c34]/50'
    : 'bg-white border-slate-200';

  const innerCardStyle = theme === 'dark'
    ? 'bg-[#181931]/60 border-[#1b1c34]/40 hover:border-slate-700'
    : 'bg-slate-50 border-slate-200 hover:border-slate-350';

  const tableHeadStyle = theme === 'dark'
    ? 'bg-[#181931] border-[#1b1c34]/60 text-slate-400'
    : 'bg-slate-50 border-slate-200 text-slate-600';

  const inputStyle = theme === 'dark'
    ? 'bg-[#0d0d1a] border-[#1b1c34] text-white placeholder-slate-600 focus:border-violet-500 font-semibold'
    : 'bg-slate-50 border-slate-200 text-slate-855 placeholder-slate-400 focus:border-violet-400 font-semibold';

  const titleColor = theme === 'dark' ? 'text-white' : 'text-slate-800';
  const subtitleColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  const selectBg = theme === 'dark' ? 'bg-[#0d0d1a] text-white border-[#1b1c34]' : 'bg-slate-50 text-slate-800 border-slate-200';

  return (
    <div className="space-y-6 select-none">
      {/* Toast Alert */}
      {message && (
        <div className="fixed top-6 right-6 z-50 bg-[#131427] border border-[#1b1c34] text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-slide-in">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <i className="fas fa-check-circle text-xs" />
          </div>
          <span className="text-xs font-semibold pr-2">{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-xs text-red-500 flex gap-2 items-center">
          <i className="fas fa-exclamation-circle text-sm shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Sub Tabs Toggle */}
      <div className={`flex border-b gap-6 select-none ${theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-200'}`}>
        <button
          onClick={() => setSubTab('products')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider transition-all relative ${
            subTab === 'products' ? 'text-violet-500' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          Manage Investment Plans
          {subTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
        </button>
        <button
          onClick={() => setSubTab('ranges')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider transition-all relative ${
            subTab === 'ranges' ? 'text-violet-500' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          Manage Price Filters
          {subTab === 'ranges' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
        </button>
      </div>

      {loading && (
        <div className={`text-center py-12 border ${cardStyle}`}>
          <i className="fas fa-spinner fa-spin text-2xl text-violet-500 mb-2" />
          <div className="text-[10px] font-bold uppercase tracking-widest">Loading catalog...</div>
        </div>
      )}

      {!loading && subTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Plan Listing Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor} mb-4`}>Investment Plans Directory ({products.length})</h3>
              
              {products.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold uppercase tracking-wider text-xs">
                  No products configured in database yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {products.map((p) => (
                    <div key={p.id} className={`border rounded-2xl p-5 transition-all flex flex-col justify-between relative ${innerCardStyle}`}>
                      
                      <div className="absolute top-4 right-4 flex gap-2">
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black border ${
                          p.color === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {p.color.toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black border ${
                          theme === 'dark' ? 'bg-[#0d0d1a] text-slate-300 border-[#1b1c34]' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                          {p.type}
                        </span>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-500 font-black tracking-widest uppercase">Plan Name / Label</div>
                        <div className={`text-sm font-black mt-1 ${titleColor}`}>{p.name}</div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5 select-text">
                          <div>
                            <span className="text-[9px] text-slate-500 font-black tracking-widest uppercase block">Amount</span>
                            <span className={`text-xs font-black mt-1 block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>₹{formatCurrency(p.amount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-black tracking-widest uppercase block">Income</span>
                            <span className="text-xs font-black text-emerald-500 mt-1 block">₹{formatCurrency(p.income)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-black tracking-widest uppercase block">Quota</span>
                            <span className="text-xs font-black text-blue-500 mt-1 block">₹{formatCurrency(p.quota)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={`flex justify-between items-center gap-4 mt-6 pt-4 border-t ${theme === 'dark' ? 'border-[#1b1c34]/40' : 'border-slate-200/60'}`}>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          Commission: {p.percent || 'N/A'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditClick(p)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 ${
                              theme === 'dark' ? 'bg-[#0d0d1a] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-white border-slate-250 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <i className="fas fa-edit" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-red-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <i className="fas fa-trash-alt" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Editor Card */}
          <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
            <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor} mb-6`}>
              {editingId ? 'Edit Product Plan' : 'Create New Plan'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Plan Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, SBI Bank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Income Reward (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="250"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Expected Quota</label>
                  <input
                    type="number"
                    disabled
                    value={quota}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs font-black select-none cursor-not-allowed ${
                      theme === 'dark' ? 'bg-[#0d0d1a] border-[#1b1c34] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Visual Theme</label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors font-bold ${selectBg}`}
                  >
                    <option value="blue">Blue Outline Style</option>
                    <option value="red">Red Outline Style</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Asset Class</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors font-bold ${selectBg}`}
                  >
                    <option value="Bank">Bank Deposit (INR)</option>
                    <option value="USDT">USDT Deposit (USDT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Commission Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2.5%+6"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl text-[10px] tracking-wider uppercase shadow-md active:scale-95 transition-all"
                >
                  {editingId ? 'Save Changes' : 'Create Product'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 ${
                      theme === 'dark' ? 'bg-[#0d0d1a] border-[#1b1c34] text-slate-400' : 'bg-slate-100 border-slate-205 text-slate-500'
                    }`}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && subTab === 'ranges' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Ranges List Table */}
          <div className={`border rounded-[1.8rem] overflow-hidden shadow-md lg:col-span-2 ${cardStyle}`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-[#1b1c34]/50' : 'border-slate-100'}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Price Filter Buttons Directory</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Filters that map categories in client Buy Tab</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className={`border-b font-black uppercase tracking-wider ${tableHeadStyle}`}>
                    <th className="px-6 py-4">Filter Label / Tab Button</th>
                    <th className="px-6 py-4">Minimum Bound</th>
                    <th className="px-6 py-4">Maximum Bound</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1c34]/40 select-text">
                  {priceRanges.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                        No custom filter bounds configured.
                      </td>
                    </tr>
                  ) : (
                    priceRanges.map((range) => (
                      <tr key={range.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4 font-bold text-slate-200">
                          <span className="bg-violet-600/10 text-violet-400 border border-violet-500/20 px-3.5 py-1 rounded-full font-black uppercase tracking-wide">
                            {range.label}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>₹{formatCurrency(range.min_val)}</td>
                        <td className={`px-6 py-4 font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>₹{formatCurrency(range.max_val)}</td>
                        <td className="px-6 py-4 text-right select-none">
                          <button
                            onClick={() => handleDeleteRange(range.id)}
                            className="bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-red-500 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <i className="fas fa-trash-alt" /> Delete Tab
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Range Form Card */}
          <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
            <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor} mb-6`}>Create Filter Button</h3>
            
            <form onSubmit={handleAddRange} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Button Text</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500-1500, 10000+"
                  value={rangeLabel}
                  onChange={(e) => setRangeLabel(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Minimum Bound (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-black tracking-widest uppercase mb-2">Maximum Bound (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="5000"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 transition-colors ${inputStyle}`}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl text-[10px] tracking-wider uppercase shadow-md active:scale-95 transition-all pt-2"
              >
                Create Filter Button
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
};

export default ProductManager;
