import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/admin`;

const SliderManager = ({ token, theme }) => {
  const [sliders, setSliders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchSliders = async () => {
    setLoading(true);
    setError('');
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api';
      const res = await axios.get(`${BASE}/sliders`);
      if (res.data.success) {
        setSliders(res.data.sliders);
      }
    } catch (err) {
      console.error('Error fetching sliders:', err);
      setError('Failed to load sliders list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSliders();
  }, []);

  const triggerAlert = (msg, type = 'success') => {
    if (type === 'success') {
      setMessage(msg);
      setTimeout(() => setMessage(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerAlert('Please select a valid image file (PNG/JPG).', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      triggerAlert('File is too large. Max size is 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setUploading(true);
    reader.onerror = () => {
      setUploading(false);
      triggerAlert('Error reading file.', 'error');
    };
    reader.onload = async () => {
      const base64Data = reader.result;
      try {
        const res = await axios.post(`${API_BASE}/sliders`, { image_data: base64Data }, getAuthHeaders());
        if (res.data.success) {
          triggerAlert('New banner uploaded successfully!');
          fetchSliders();
        }
      } catch (err) {
        triggerAlert(err.response?.data?.error || 'Failed to upload banner.', 'error');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/sliders/${id}`, getAuthHeaders());
      if (res.data.success) {
        triggerAlert('Banner deleted successfully.');
        fetchSliders();
      }
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Failed to delete banner.', 'error');
    }
  };

  // Styled classes based on active theme
  const cardStyle = theme === 'dark'
    ? 'bg-[#131427] border-[#1b1c34]/50'
    : 'bg-white border-slate-200';

  const innerCardStyle = theme === 'dark'
    ? 'bg-[#181931]/60 border-[#1b1c34]/40 hover:border-slate-700'
    : 'bg-slate-50 border-slate-200 hover:border-slate-300';

  const titleColor = theme === 'dark' ? 'text-white' : 'text-slate-800';
  const subtitleColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  const buttonStyle = theme === 'dark'
    ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white'
    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900';

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

      {/* Upload Banner Section */}
      <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
        <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Upload New Home Banner</h3>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1 mb-6`}>
          Supported formats: PNG, JPG, or WEBP carousel graphics (Max 2MB).
        </p>

        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all select-none ${
            theme === 'dark' ? 'border-[#1b1c34] hover:bg-[#181931]/30 hover:border-slate-700' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-350'
          }`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <>
                  <i className="fas fa-spinner fa-spin text-2xl text-violet-500 mb-3" />
                  <p className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>Processing Upload...</p>
                </>
              ) : (
                <>
                  <i className={`fas fa-cloud-upload-alt text-2xl mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <p className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>Select Carousel Banner</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Image ratios will automatically scale</p>
                </>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              disabled={uploading} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* Active Sliders List */}
      <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>Active Home Banners</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Active banners currently in rotation</p>
          </div>
          <button
            onClick={fetchSliders}
            disabled={loading}
            className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 ${buttonStyle}`}
          >
            <i className="fas fa-sync-alt" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">
            <i className="fas fa-spinner fa-spin text-2xl text-violet-500 mb-2" />
            <div className="text-[10px] font-bold uppercase tracking-widest">Syncing banners...</div>
          </div>
        ) : sliders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold uppercase tracking-wider text-xs">
            No active banners. Mobile app will fall back to static image assets.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sliders.map((slide) => (
              <div 
                key={slide.id} 
                className={`border rounded-2xl overflow-hidden relative group transition-all flex flex-col justify-between ${innerCardStyle}`}
              >
                <div className="aspect-video relative overflow-hidden bg-[#0d0d1a]">
                  <img
                    src={slide.image_data}
                    alt={`Slider Banner ${slide.id}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-[#0d0d1a]/80 backdrop-blur border border-[#1b1c34] text-slate-300 text-[9px] font-mono px-2 py-0.5 rounded-full select-none">
                    ID: {slide.id}
                  </div>
                </div>

                <div className={`p-4 flex items-center justify-between gap-4 border-t ${theme === 'dark' ? 'border-[#1b1c34]/40' : 'border-slate-200/60'}`}>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">
                    Seeded: {new Date(slide.created_at).toLocaleDateString('en-IN')}
                  </div>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    className="bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-red-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <i className="fas fa-trash-alt" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SliderManager;
