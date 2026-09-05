import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MessageManager = ({ token, theme }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_USER_BASE = import.meta.env.VITE_API_URL || '/api';
  const API_ADMIN_BASE = `${import.meta.env.VITE_API_URL || '/api'}/admin`;

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API_USER_BASE}/messages`);
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Error fetching broadcast messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handlePublish = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !content.trim()) {
      setError('Please fill in both title and content fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_ADMIN_BASE}/messages`,
        { title: title.trim(), content: content.trim() },
        getHeaders()
      );
      if (res.data.success) {
        setSuccess('Message broadcasted successfully!');
        setTitle('');
        setContent('');
        fetchMessages();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to broadcast message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Retract/Delete this broadcast message? Users will no longer see it.')) return;
    try {
      const res = await axios.delete(`${API_ADMIN_BASE}/messages/${id}`, getHeaders());
      if (res.data.success) {
        fetchMessages();
      }
    } catch (err) {
      alert('Failed to delete broadcast message');
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Styling bindings
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-[#131427] border-[#1b1c34]/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-800';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const borderStyle = isDark ? 'border-[#1b1c34]/50' : 'border-slate-100';
  const inputBg = isDark ? 'bg-[#181931] border-[#1b1c34] text-white focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Broadcast History List */}
      <div className={`lg:col-span-2 border rounded-[1.8rem] p-6 shadow-md ${cardBg}`}>
        <div className="flex justify-between items-center pb-4 border-b border-gray-100/10 mb-6">
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wide ${textPrimary}`}>Broadcast History</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Active alerts currently visible to users
            </p>
          </div>
          <button
            onClick={fetchMessages}
            className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 ${
              isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-sync-alt" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-xs">
            <i className="fas fa-spinner fa-spin mr-2" /> Syncing Messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-bold uppercase tracking-wider text-xs border border-dashed border-slate-300/30 rounded-2xl">
            No broadcast messages published yet
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`border rounded-2xl p-5 flex items-start gap-4 shadow-sm relative transition-all ${
                  isDark ? 'bg-[#181931]/40 border-[#1b1c34]/50' : 'bg-slate-50/50 border-slate-100'
                }`}
              >
                {/* Speaker Icon Bubble */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-violet-950/40 text-violet-400' : 'bg-violet-50 text-violet-600'
                }`}>
                  <i className="fas fa-bullhorn text-sm" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <span className={`font-black text-xs uppercase tracking-wide block truncate ${textPrimary}`}>
                      {item.title}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className={`text-xs mt-2 leading-relaxed whitespace-pre-wrap ${textSecondary}`}>
                    {item.content}
                  </p>
                </div>

                {/* Retract button */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-red-500 transition-colors border active:scale-95 self-start ${
                    isDark ? 'bg-red-950/20 border-red-900/30 hover:bg-red-950/40' : 'bg-red-50 border-red-100 hover:bg-red-100'
                  }`}
                  title="Retract message"
                >
                  <i className="fas fa-trash-alt text-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Creation Form Panel */}
      <div className={`border rounded-[1.8rem] p-6 shadow-md h-fit ${cardBg}`}>
        <h3 className={`text-sm font-bold uppercase tracking-wide mb-1 ${textPrimary}`}>Publish Broadcast</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">
          Notify all users instantly
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl p-3 text-xs font-bold uppercase tracking-wide mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl p-3 text-xs font-bold uppercase tracking-wide mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block mb-2">
              Message Title
            </label>
            <input
              type="text"
              placeholder="e.g., Scheduled Maintenance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none transition-all ${inputBg}`}
              required
            />
          </div>

          <div>
            <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block mb-2">
              Message Content
            </label>
            <textarea
              placeholder="Enter message body..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="6"
              className={`w-full border rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none transition-all ${inputBg}`}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <i className="fas fa-spinner fa-spin mr-1" />
            ) : (
              <>
                <i className="fas fa-paper-plane" /> Publish Announcement
              </>
            )}
          </button>
        </form>
      </div>

    </div>
  );
};

export default MessageManager;
