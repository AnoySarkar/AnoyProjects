import React, { useState } from 'react';
import type { Goal, LogEntry } from '../types';
import { Plus, Minus, Calendar, X } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface ActivityHeatmapProps {
  goals: Goal[];
  logs: LogEntry[];
  activeMonth: string; // YYYY-MM
  onUpdateLog: (goalId: string, date: string, value: number) => void;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  goals,
  logs,
  activeMonth,
  onUpdateLog
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr); // 1-indexed

  // Total days in the month
  const totalDays = new Date(year, month, 0).getDate();
  // Day of the week of the 1st of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  // Adjust so Monday is 0 and Sunday is 6
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Days in month array
  const dayCells: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dStr = d.toString().padStart(2, '0');
    dayCells.push(`${activeMonth}-${dStr}`);
  }

  // Get total logged volume of a specific day across all goals
  const getDayProgressColorClass = (dateStr: string) => {
    const dayLogs = logs.filter(l => l.date === dateStr);
    if (dayLogs.length === 0) return '';
    
    // Calculate total progress percentage on this day
    let totalTargetDaily = 0;
    let totalLoggedDaily = 0;

    goals.forEach(goal => {
      // Static daily target: total / days in month
      const staticDaily = goal.target / totalDays;
      totalTargetDaily += staticDaily;
      
      const goalLogs = dayLogs.filter(l => l.goalId === goal.id);
      const val = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
      totalLoggedDaily += val;
    });

    if (totalTargetDaily === 0) return '';
    const ratio = totalLoggedDaily / totalTargetDaily;

    if (ratio >= 1.5) return 'green-accent glow-border'; // Outstanding
    if (ratio >= 0.9) return 'blue-accent'; // Achieved target
    if (ratio >= 0.4) return 'purple-accent'; // Partial activity
    return 'pink-accent'; // Very low activity
  };

  // Helper to format Date nicely
  const formatDatePretty = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const handleCellClick = (dateStr: string) => {
    soundManager.playClick();
    setSelectedDate(dateStr);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar style={{ color: 'var(--neon-blue)', width: '20px', height: '20px' }} />
          <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
            Interactive Activity Heatmap
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}></span> Empty
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-pink)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--neon-pink-dim)', border: '1px solid var(--neon-pink)' }}></span> Low
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-purple)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--neon-purple-dim)', border: '1px solid var(--neon-purple)' }}></span> Mid
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-blue)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--neon-blue-dim)', border: '1px solid var(--neon-blue)' }}></span> Target
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-green)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--neon-green-dim)', border: '1px solid var(--neon-green)' }}></span> Max
          </span>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        ⚡ **Fast Logger Calendar**: Click on any date box below to instantly add or review logs for that specific day.
      </p>

      {/* Week Headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '0.78rem',
        fontFamily: 'var(--font-title)',
        color: 'var(--text-muted)',
        marginBottom: '8px'
      }}>
        <div>MON</div>
        <div>TUE</div>
        <div>WED</div>
        <div>THU</div>
        <div>FRI</div>
        <div>SAT</div>
        <div>SUN</div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px'
      }}>
        {/* Padding for start offset */}
        {Array.from({ length: startOffset }).map((_, idx) => (
          <div key={`offset-${idx}`} style={{
            aspectRatio: '1',
            borderRadius: '8px',
            background: 'transparent'
          }}></div>
        ))}

        {/* Days of Month */}
        {dayCells.map((dateStr, idx) => {
          const dayNum = idx + 1;
          const accentClass = getDayProgressColorClass(dateStr);
          const hasLogs = accentClass !== '';
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => handleCellClick(dateStr)}
              onMouseEnter={() => soundManager.playTick()}
              className={`${accentClass} ${isSelected ? 'glow-border' : ''}`}
              style={{
                aspectRatio: '1',
                borderRadius: '10px',
                background: hasLogs ? 'var(--accent-dim)' : 'rgba(255, 255, 255, 0.02)',
                border: hasLogs ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                color: isSelected ? 'var(--text-primary)' : hasLogs ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: hasLogs || isSelected ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isSelected ? '0 0 15px rgba(255, 255, 255, 0.15)' : 'none',
                position: 'relative'
              }}
            >
              {dayNum}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--text-primary)'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Fast Logger Popup drawer (Glassmorphic) */}
      {selectedDate && (
        <div className="animate-fade-in" style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          position: 'relative'
        }}>
          <button 
            onClick={() => { soundManager.playClick(); setSelectedDate(null); }}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <X size={16} />
          </button>
          
          <h4 style={{ 
            fontSize: '0.95rem', 
            fontFamily: 'var(--font-title)', 
            fontWeight: 700, 
            color: 'var(--neon-blue)',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>📅</span> Logs for {formatDatePretty(selectedDate)}
          </h4>

          {goals.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active goals configured for this month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {goals.map(goal => {
                const goalLogs = logs.filter(l => l.goalId === goal.id && l.date === selectedDate);
                const currentVal = goalLogs.reduce((acc, curr) => acc + curr.value, 0);

                // Helper to format values elegantly (e.g. Minutes for duration)
                const formatGoalValue = (val: number) => {
                  if (goal.unitType === 'duration') {
                    const mins = Math.floor(val / 60);
                    const secs = val % 60;
                    return `${mins}m ${secs}s`;
                  }
                  return `${val} ${goal.unitName}`;
                };

                const accentClass = 
                  goal.color === 'pink' ? 'pink-accent' :
                  goal.color === 'blue' ? 'blue-accent' :
                  goal.color === 'green' ? 'green-accent' :
                  goal.color === 'purple' ? 'purple-accent' :
                  'orange-accent';

                const adjustLog = (increment: boolean) => {
                  let step = 1;
                  if (goal.unitType === 'duration') {
                    step = 60; // 1 minute increment for fast logger duration
                  }
                  
                  const newVal = Math.max(0, increment ? currentVal + step : currentVal - step);
                  
                  if (increment) {
                    soundManager.playLogSuccess();
                  } else {
                    soundManager.playLogDecrease();
                  }
                  
                  onUpdateLog(goal.id, selectedDate, newVal);
                };

                return (
                  <div 
                    key={goal.id} 
                    className={accentClass}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '10px',
                      borderLeft: '3px solid var(--accent)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{goal.name}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>
                        {formatGoalValue(currentVal)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => adjustLog(false)}
                        disabled={currentVal <= 0}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          cursor: currentVal <= 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: currentVal <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <button 
                        onClick={() => adjustLog(true)}
                        style={{
                          background: 'var(--accent-dim)',
                          border: '1px solid var(--accent)',
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
