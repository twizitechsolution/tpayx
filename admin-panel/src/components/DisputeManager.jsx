import React, { useEffect, useState } from 'react';
import axios from 'axios';

const DisputeManager = ({ token, theme }) => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_URL}/admin/disputes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setDisputes(res.data.disputes);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch disputes list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [token]);

  const handleResolveDispute = async (disputeId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this dispute? This action is permanent.`)) {
      return;
    }
    setResolvingId(disputeId);
    try {
      const res = await axios.post(
        `${API_URL}/admin/disputes/${disputeId}/resolve`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert(res.data.message || 'Dispute resolved successfully!');
        fetchDisputes();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Resolution action failed');
    } finally {
      setResolvingId(null);
    }
  };

  const formatCurrency = (val) => {
    return typeof val === 'number' ? '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '₹0.00';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center select-none">
        <div>
          <h2 className={`text-xl font-extrabold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            P2P Payment Disputes Board
          </h2>
          <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Review user payment proofs vs receiver statements to settle P2P escrow transfers.
          </p>
        </div>
        <button
          onClick={fetchDisputes}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <i className="fas fa-sync-alt" /> Refresh Queue
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <i className="fas fa-circle-notch fa-spin text-3xl" />
          <span className="text-xs font-bold uppercase tracking-wider">Loading dispute details...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-2xl p-4 text-center">
          {error}
        </div>
      ) : disputes.length === 0 ? (
        <div className={`border-2 border-dashed rounded-3xl py-20 text-center select-none ${
          theme === 'dark' ? 'border-[#1b1c34] text-slate-500' : 'border-slate-200 text-slate-400'
        }`}>
          <i className="fas fa-check-circle text-4xl text-green-500 mb-3 block" />
          <span className="text-xs font-black uppercase tracking-wider">No Active Disputes Filed</span>
          <p className="text-[10px] text-slate-400 mt-1 font-semibold">Excellent! All P2P matched payments resolved correctly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div 
              key={dispute.id}
              className={`rounded-3xl border p-5 transition-all shadow-sm flex flex-col space-y-4 ${
                theme === 'dark' 
                  ? 'bg-[#131427] border-[#1b1c34] text-slate-300' 
                  : 'bg-white border-slate-100 text-slate-700'
              }`}
            >
              {/* Header Info */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      Dispute #{dispute.id} (Order: {dispute.order_id})
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full select-none ${
                      dispute.status === 'Pending' 
                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' 
                        : 'bg-green-500/10 text-green-500 border border-green-500/20'
                    }`}>
                      {dispute.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Filed on {new Date(dispute.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-rose-600">
                    {formatCurrency(dispute.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">
                    UTR: <span className="font-mono text-slate-500 select-all font-black">{dispute.utr || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Members Involved */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs select-none">
                <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-[#181931]/60' : 'bg-slate-50/50'}`}>
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mb-1">Depositor (Buyer)</span>
                  <span className="font-extrabold">{dispute.depositor_name}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5 font-bold">(UID: {dispute.depositor_uid})</span>
                </div>
                <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-[#181931]/60' : 'bg-slate-50/50'}`}>
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mb-1">Raiser (Receiver)</span>
                  <span className="font-extrabold">{dispute.receiver_name}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5 font-bold">(UID: {dispute.receiver_uid})</span>
                  <div className="text-[10px] text-rose-500 font-bold mt-1">Reason: "{dispute.reason}"</div>
                </div>
              </div>

              {/* Side-by-Side Proof Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
                {/* Depositor Screenshot */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Depositor Payment Proof</span>
                  {dispute.depositor_screenshot ? (
                    <div 
                      onClick={() => setLightboxImg(dispute.depositor_screenshot)}
                      className="border border-slate-100 rounded-2xl overflow-hidden bg-black/5 hover:brightness-95 transition-all p-1.5 flex items-center justify-center cursor-zoom-in"
                    >
                      <img 
                        src={`${API_URL}/view-image?file=${encodeURIComponent(dispute.depositor_screenshot.replace('/uploads/', ''))}`} 
                        alt="Depositor Proof" 
                        className="max-h-52 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-bold text-center border py-10 rounded-2xl">
                      No screenshot proof uploaded
                    </div>
                  )}
                </div>

                {/* Receiver Bank Statement Proof */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Receiver Bank Statement Proof</span>
                  {dispute.receiver_proof ? (
                    <div 
                      onClick={() => setLightboxImg(dispute.receiver_proof)}
                      className="border border-slate-100 rounded-2xl overflow-hidden bg-black/5 hover:brightness-95 transition-all p-1.5 flex items-center justify-center cursor-zoom-in"
                    >
                      <img 
                        src={`${API_URL}/view-image?file=${encodeURIComponent(dispute.receiver_proof.replace('/uploads/', ''))}`} 
                        alt="Receiver Proof" 
                        className="max-h-52 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-bold text-center border py-10 rounded-2xl">
                      No statement proof uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Action Resolution Buttons */}
              {dispute.status === 'Pending' && (
                <div className="flex gap-3 justify-end pt-3 select-none">
                  <button
                    onClick={() => handleResolveDispute(dispute.id, 'reject')}
                    disabled={resolvingId !== null}
                    className="bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    Reject & Refund Receiver
                  </button>
                  <button
                    onClick={() => handleResolveDispute(dispute.id, 'approve')}
                    disabled={resolvingId !== null}
                    className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md shadow-green-600/10 active:scale-[0.98]"
                  >
                    Approve & Release to Depositor
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX ZOOM MODAL */}
      {lightboxImg && (
        <div 
          className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-center p-6"
          onClick={() => setLightboxImg(null)}
        >
          <button 
            onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 text-white text-xl bg-white/10 w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
          >
            ✕
          </button>
          <img 
            src={`${API_URL}/view-image?file=${encodeURIComponent(lightboxImg.replace('/uploads/', ''))}`} 
            alt="Fullscreen Proof Comparison" 
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-white/50 text-xs font-bold uppercase tracking-wider mt-4">Click anywhere to close zoom window</span>
        </div>
      )}
    </div>
  );
};

export default DisputeManager;
