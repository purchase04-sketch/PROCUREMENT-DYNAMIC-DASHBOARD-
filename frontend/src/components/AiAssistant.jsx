import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleAiPanel } from '../store';
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const quickActions = [
  'Which suppliers are risky?',
  'Show critical items',
  'Why is OTD low?',
  'Predict next month shortage',
  'Generate supplier reminder email',
  'Suggest cost saving opportunities',
  'Recommend VMI reorder quantities',
  'Which supplier needs escalation?',
];

export default function AiAssistant() {
  const dispatch = useDispatch();
  const { activeTab } = useSelector(s => s.ui);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I\'m your AI Procurement Analyst. Ask me anything about your supply chain data — risks, savings, forecasts, or email drafts. I\'m here on every tab!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai/chat`, { prompt: userMsg, tabContext: activeTab, gridData: [] });
      setMessages(prev => [...prev, { role: 'ai', text: res.data.response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'I encountered an error. Please check the backend connection and try again.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="ai-panel" style={{ width: 380, position: 'fixed', right: 0, top: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-dark-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pulse-glow" style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>AI Procurement Analyst</div>
            <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>
              <Sparkles size={10} style={{ display: 'inline', marginRight: 4 }} />Tab: {activeTab}
            </div>
          </div>
        </div>
        <button onClick={() => dispatch(toggleAiPanel())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-dark-muted)' }}><X size={20} /></button>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--color-dark-border)' }}>
        {quickActions.slice(0, 4).map((q, i) => (
          <button key={i} onClick={() => { setInput(q); }} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--color-primary-light)', cursor: 'pointer', fontWeight: 500 }}>
            {q.length > 25 ? q.substring(0, 25) + '...' : q}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'ai' ? 'ai-message fade-in' : 'user-message fade-in'} style={{ alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '90%' }}>
            <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, opacity: 0.6 }}>{m.role === 'ai' ? '🤖 AI Analyst' : '👤 You'}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="ai-message fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Analyzing your procurement data...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-dark-border)', display: 'flex', gap: 8 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about risks, savings, forecasts..." style={{ flex: 1, fontSize: 13 }} />
        <button className="btn-primary" onClick={sendMessage} style={{ padding: '8px 14px' }}><Send size={16} /></button>
      </div>
    </div>
  );
}
