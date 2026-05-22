import React, { useState } from 'react';
import type { Goal } from '../types';
import { ChevronLeft, ChevronRight, Zap, Play } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface QuickLogStationProps {
  goals: Goal[];
  onAddLog: (goalId: string, value: number, dateStr?: string) => void;
}

export const QuickLogStation: React.FC<QuickLogStationProps> = ({ goals, onAddLog }) => {
  const [selectedGoalId, setSelectedGoalId] = useState<string>(goals[0]?.id || '');
  const [logValue, setLogValue] = useState<number>(1);
  
  // Custom date switching state
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  const activeGoal = goals.find(g => g.id === selectedGoalId) || goals[0];

  // Auto-sync initial select goal ID if goals list changes
  React.useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id);
      const isDuration = goals[0].unitType === 'duration';
      setLogValue(isDuration ? 60 : 1);
    }
  }, [goals, selectedGoalId]);

  if (goals.length === 0) return null;

  const handleGoalChange = (id: string) => {
    soundManager.playClick();
    setSelectedGoalId(id);
    const targetGoal = goals.find(g => g.id === id);
    if (targetGoal) {
      const isDuration = targetGoal.unitType === 'duration';
      setLogValue(isDuration ? 60 : 1);
    }
  };

  const toDateStr = (d: Date) => {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const handleDayShift = (days: number) => {
    soundManager.playClick();
    const newDate = new Date(targetDate);
    newDate.setDate(targetDate.getDate() + days);
    setTargetDate(newDate);
  };

  const handleSetToday = () => {
    soundManager.playClick();
    setTargetDate(new Date());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId) return;

    soundManager.playLogSuccess();
    const formattedDate = toDateStr(targetDate);
    onAddLog(selectedGoalId, logValue, formattedDate);
  };

  const isDuration = activeGoal?.unitType === 'duration';
  
  const formatQuantity = (val: number) => {
    if (isDuration) {
      const hours = Math.floor(val / 3600);
      const mins = Math.floor((val % 3600) / 60);
      const secs = val % 60;
      if (hours > 0) return `${hours}h ${mins}m`;
      if (mins > 0) return `${mins}m ${secs}s`;
      return `${secs}s`;
    }
    return `${val} ${activeGoal?.unitName || 'units'}`;
  };

  const prettyDateLabel = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dStr = toDateStr(targetDate);
    const todayStr = toDateStr(today);
    const yesterdayStr = toDateStr(yesterday);

    if (dStr === todayStr) return 'Today ☄️';
    if (dStr === yesterdayStr) return 'Yesterday 🗓️';
    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Color theme variables based on selected goal
  const accentClass = 
    activeGoal?.color === 'pink' ? 'pink-accent' :
    activeGoal?.color === 'blue' ? 'blue-accent' :
    activeGoal?.color === 'green' ? 'green-accent' :
    activeGoal?.color === 'purple' ? 'purple-accent' :
    'orange-accent';

  return (
    <div className={`glass-panel animate-shimmer ${accentClass}`} style={{
      padding: '20px 24px',
      borderLeft: '4px solid var(--accent)',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3), 0 0 10px var(--accent-dim)'
    }}>
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'var(--accent-dim)',
        filter: 'blur(30px)',
        pointerEvents: 'none'
      }} />

      <h3 style={{ 
        fontSize: '1.05rem', 
        fontFamily: 'var(--font-title)', 
        fontWeight: 700, 
        color: 'var(--text-primary)',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Zap size={16} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 5px var(--accent))' }} />
        Mission Control: Quick Log Station
      </h3>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'flex-end'
      }}>
        {/* Goal Selector */}
        <div style={{ flex: '1 1 200px' }}>
          <label className="form-label" style={{ fontSize: '0.72rem' }}>Select Target Goal</label>
          <select 
            value={selectedGoalId} 
            onChange={(e) => handleGoalChange(e.target.value)}
            className="form-input"
            style={{
              padding: '10px 12px',
              fontSize: '0.85rem',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              height: '42px',
              color: 'var(--text-primary)'
            }}
          >
            {goals.map(g => (
              <option key={g.id} value={g.id} style={{ background: '#08081a' }}>
                {g.name} ({g.category.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Date Selector / Switcher */}
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 0 }}>Target Logging Day</label>
            <span 
              onClick={handleSetToday} 
              style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}
              title="Reset to today"
            >
              Today
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            height: '42px'
          }}>
            <button 
              type="button" 
              onClick={() => handleDayShift(-1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                padding: '0 12px',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {prettyDateLabel()}
            </span>
            <button 
              type="button" 
              onClick={() => handleDayShift(1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                padding: '0 12px',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Contribution Value Slider/Input */}
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 0 }}>Contribution</label>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 800 }}>
              {formatQuantity(logValue)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '42px' }}>
            {(() => {
              const maxSliderValue = activeGoal?.unitType === 'duration' 
                ? Math.max(activeGoal.target, 3600) 
                : Math.max(activeGoal.target, 50);
              return (
                <>
                  <input 
                    type="range"
                    min={isDuration ? 10 : 1}
                    max={maxSliderValue}
                    step={isDuration ? 10 : 1}
                    value={logValue}
                    onChange={(e) => setLogValue(parseInt(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      height: '6px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '4px',
                      accentColor: 'var(--accent)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    value={logValue}
                    onChange={(e) => setLogValue(parseInt(e.target.value) || 0)}
                    style={{
                      width: '68px',
                      padding: '5px 8px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                </>
              );
            })()}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ flex: '1 1 120px' }}>
          <button 
            type="submit" 
            className="btn-premium"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '0.85rem',
              justifyContent: 'center',
              borderRadius: '10px',
              height: '42px'
            }}
          >
            <Play size={12} fill="currentColor" style={{ marginRight: '4px' }} /> Log
          </button>
        </div>
      </form>
    </div>
  );
};
