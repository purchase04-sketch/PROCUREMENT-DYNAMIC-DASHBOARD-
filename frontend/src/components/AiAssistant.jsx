import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleAiPanel } from '../store';
import { Bot, Send, X, Sparkles, Loader2, Save } from 'lucide-react';
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
  const filters = useSelector(s => s.filters);
  const dataStore = useSelector(s => s.data);
  
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I\'m your Intelligent OEM Procurement Analyst. I can see all your data, read your filters, and even help you create dynamic formulas. Ask me anything!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const getActiveData = () => {
    // Map active tab to collection
    const map = {
      'schedule': 'schedules',
      'cost': 'costsavings',
      'inventory': 'inventory',
      'vmi-planning': 'vmiplanning',
      'vmi-tracking': 'vmitracking'
    };
    const key = map[activeTab] || 'schedules';
    return dataStore[key] || [];
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const activeData = getActiveData();
      const res = await axios.post(`${API}/ai/chat`, { 
        prompt: userMsg, 
        tabContext: activeTab, 
        gridData: activeData,
        filters
      });
      setMessages(prev => [...prev, { role: 'ai', text: res.data.response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'I encountered an error connecting to the intelligence engine. Ensure backend is running.' }]);
    }
    setLoading(false);
  };

  // Helper to detect if AI response contains a formula block that could be applied
  const renderMessageText = (text) => {
    if (text.includes('```javascript') && text.includes('expression')) {
      return (
        <div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
          <button className="btn-accent" style={{ marginTop: 10, fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={12} /> Apply Custom Formula
          </button>
        </div>
      );
    }
    return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
  };

  return (
    <div className="ai-panel" style={{ width: 420, position: 'fixed', right: 0, top: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 60, boxShadow: '-5px 0 25px rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-dark-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15,23,42,0.95)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="pulse-glow" style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg, #a5b4fc, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Intelligent OEM Analyst</div>
            <div style={{ fontSize: 10, color: 'var(--color-dark-muted)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6 }}>
              <span><Sparkles size={10} style={{ display: 'inline', color: '#10b981' }} /> Context: {activeTab.toUpperCase()}</span>
              {filters.buyer && <span>| Buyer: {filters.buyer}</span>}
            </div>
          </div>
        </div>
        <button onClick={() => dispatch(toggleAiPanel())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-dark-muted)', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='var(--color-dark-muted)'}><X size={20} /></button>
      </div>

      {/* Quick Actions Grid */}
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(30,41,59,0.3)' }}>
        {quickActions.map((q, i) => (
          <button key={i} onClick={() => { setInput(q); }} style={{ fontSize: 9.5, padding: '6px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', cursor: 'pointer', fontWeight: 500, textAlign: 'left', transition: 'all 0.2s' }} onMouseOver={e=>{e.currentTarget.style.background='rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.5)'}} onMouseOut={e=>{e.currentTarget.style.background='rgba(99,102,241,0.05)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.2)'}}>
            {q}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(15,23,42,0.98)' }}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'ai' ? 'fade-in' : 'fade-in'} style={{ alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '85%', background: m.role === 'ai' ? 'rgba(30,41,59,0.8)' : 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '12px 16px', borderRadius: m.role === 'ai' ? '12px 12px 12px 2px' : '12px 12px 2px 12px', border: m.role === 'ai' ? '1px solid rgba(255,255,255,0.05)' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 6, color: m.role === 'ai' ? '#8b5cf6' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.role === 'ai' ? 'OEM Analyst' : 'You'}</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: m.role === 'ai' ? '#e2e8f0' : '#fff' }}>
              {renderMessageText(m.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="fade-in" style={{ alignSelf: 'flex-start', background: 'rgba(30,41,59,0.5)', padding: '10px 16px', borderRadius: '12px 12px 12px 2px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Analyzing dataset & executing logic...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.95)' }}>
        <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about risks, savings, custom formulas..." style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', padding: '10px 12px', outline: 'none', color: '#fff' }} />
          <button onClick={sendMessage} disabled={!input.trim()} style={{ background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'not-allowed', color: input.trim() ? '#fff' : 'rgba(255,255,255,0.2)', transition: '0.2s' }}>
            <Send size={18} />
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 9, color: 'var(--color-dark-muted)' }}>
          AI processes current filters & grid data for context-aware intelligence.
        </div>
      </div>
    </div>
  );
}
