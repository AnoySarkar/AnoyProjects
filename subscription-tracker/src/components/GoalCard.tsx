import React, { useState } from 'react';
import type { Goal, LogEntry } from '../types';
import { 
  Video, 
  Image as ImageIcon, 
  Headphones, 
  BookOpen, 
  Dumbbell, 
  Code, 
  Trophy, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  History,
  Edit2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { getGoalCycleRange, getTodayStr, hexToRgb } from '../utils/dateUtils';

interface GoalCardProps {
  goal: Goal;
  logs: LogEntry[];
  onAddLog: (goalId: string, value: number, dateStr?: string) => void;
  onDeleteLog: (logId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onEditGoal: (goal: Goal) => void;
  onDuplicateGoal: (goal: Goal) => void;
  viewMode?: 'detailed' | 'clean';
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  logs,
  onAddLog,
  onDeleteLog,
  onDeleteGoal,
  onEditGoal,
  onDuplicateGoal,
  viewMode = 'detailed'
}) => {
  const [logValue, setLogValue] = useState<number>(goal.unitType === 'duration' ? 60 : 1);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isCustomColor = goal.color.startsWith('#');
  const customAccentStyle = isCustomColor ? {
    '--accent': goal.color,
    '--accent-glow': `rgba(${hexToRgb(goal.color)}, 0.35)`,
    '--accent-dim': `rgba(${hexToRgb(goal.color)}, 0.1)`
  } as React.CSSProperties : {};

  // 1. Calculate Billing Cycle range
  const resetPeriod = goal.resetPeriod || 'monthly';
  const cycle = getGoalCycleRange(goal.month, goal.resetDay || 1, resetPeriod);
  const totalDays = cycle.totalDays;
  const remainingDays = cycle.remainingDays;
  const elapsedDays = cycle.elapsedDays;

  // 2. Aggregate logs strictly within this billing cycle range
  const goalLogs = logs.filter(
    l => l.goalId === goal.id && l.date >= cycle.startDateStr && l.date <= cycle.endDateStr
  );
  const totalLogged = goalLogs.reduce((acc, curr) => acc + curr.value, 0);

  // 3. Daily progress (logged today vs adaptiveDaily or staticDaily)
  const todayStr = getTodayStr();
  const todayLogs = goalLogs.filter(l => l.date === todayStr);
  const todayLogged = todayLogs.reduce((acc, curr) => acc + curr.value, 0);

  // 4. Targets and adaptive references
  let monthlyTarget = goal.target;
  let progressPercent = 0;
  let staticDaily = 0;
  let adaptiveDaily = 0;
  let remainingGoal = 0;

  if (resetPeriod === 'daily') {
    monthlyTarget = goal.target * totalDays; // maximum potential cumulative limit
    progressPercent = monthlyTarget > 0 ? Math.round((totalLogged / monthlyTarget) * 100) : 0;
    staticDaily = goal.target;
    remainingGoal = Math.max(0, goal.target - todayLogged); // remaining for today
    adaptiveDaily = remainingGoal;
  } else if (resetPeriod === 'weekly') {
    monthlyTarget = goal.target; // weekly target limit
    progressPercent = monthlyTarget > 0 ? Math.round((totalLogged / monthlyTarget) * 100) : 0;
    staticDaily = goal.target / 7;
    remainingGoal = Math.max(0, goal.target - totalLogged);
    adaptiveDaily = remainingGoal > 0 ? remainingGoal / remainingDays : 0;
  } else {
    monthlyTarget = goal.target; // monthly target limit
    progressPercent = monthlyTarget > 0 ? Math.round((totalLogged / monthlyTarget) * 100) : 0;
    staticDaily = goal.target / totalDays;
    remainingGoal = Math.max(0, goal.target - totalLogged);
    adaptiveDaily = remainingGoal > 0 ? remainingGoal / remainingDays : 0;
  }

  // Target daily reference (use adaptiveDaily if remaining > 0, else staticDaily)
  const dailyTargetRef = resetPeriod === 'daily' ? goal.target : (adaptiveDaily > 0 ? adaptiveDaily : staticDaily);
  const dailyProgressPercent = dailyTargetRef > 0 
    ? Math.round((todayLogged / dailyTargetRef) * 100)
    : 100;

  // Overdrive Condition: Logged today >= Daily target limit
  const overdriveActive = todayLogged >= dailyTargetRef && dailyTargetRef > 0;

  // 5. Extras (Surplus and Buffer)
  const staticTargetUpToNow = staticDaily * elapsedDays;
  const surplusDeficit = totalLogged - staticTargetUpToNow;
  const totalSurplus = Math.max(0, totalLogged - monthlyTarget);

  // Missed days helper for Daily goals
  const getMissedDaysCount = () => {
    if (resetPeriod !== 'daily') return 0;
    let missed = 0;
    const start = new Date(cycle.startDate);
    const end = new Date(cycle.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentDay = new Date(start);
    while (currentDay < today && currentDay <= end) {
      const yyyy = currentDay.getFullYear();
      const mm = (currentDay.getMonth() + 1).toString().padStart(2, '0');
      const dd = currentDay.getDate().toString().padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const daySum = goalLogs
        .filter(l => l.date === dateStr)
        .reduce((acc, curr) => acc + curr.value, 0);
        
      if (daySum < goal.target) {
        missed += 1;
      }
      
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return missed;
  };

  const missedDays = getMissedDaysCount();

  // Icon mapping
  const renderIcon = () => {
    const iconProps = { size: 22, style: { color: 'var(--accent)' } };
    switch (goal.icon) {
      case 'video': return <Video {...iconProps} />;
      case 'image': return <ImageIcon {...iconProps} />;
      case 'headphones': return <Headphones {...iconProps} />;
      case 'book': return <BookOpen {...iconProps} />;
      case 'dumbbell': return <Dumbbell {...iconProps} />;
      case 'code': return <Code {...iconProps} />;
      case 'trophy': return <Trophy {...iconProps} />;
      default: return <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{goal.icon}</span>;
    }
  };

  // Accent style mapping
  const accentClass = 
    goal.color === 'pink' ? 'pink-accent' :
    goal.color === 'blue' ? 'blue-accent' :
    goal.color === 'green' ? 'green-accent' :
    goal.color === 'purple' ? 'purple-accent' :
    'orange-accent';

  // Format quantities elegantly & round duration to whole seconds
  const formatQuantity = (val: number) => {
    const rounded = Math.round(val);
    if (goal.unitType === 'duration') {
      const hours = Math.floor(rounded / 3600);
      const mins = Math.floor((rounded % 3600) / 60);
      const secs = rounded % 60;
      if (hours > 0) return `${hours}h ${mins}m`;
      if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
      return `${secs}s`;
    }
    return `${Math.round(rounded * 10) / 10} ${goal.unitName}`;
  };

  const handleQuickAdd = (valueToAdd: number) => {
    soundManager.playLogSuccess();
    onAddLog(goal.id, valueToAdd);
  };

  const handleSliderSubmit = () => {
    soundManager.playLogSuccess();
    onAddLog(goal.id, logValue);
    setLogValue(goal.unitType === 'duration' ? 60 : 1);
  };

  const handleTrashGoal = () => {
    if (window.confirm(`Are you sure you want to delete the goal "${goal.name}"? This will clear all logged data associated with it.`)) {
      soundManager.playLogDecrease();
      onDeleteGoal(goal.id);
    }
  };

  const handleEditGoal = () => {
    soundManager.playClick();
    onEditGoal(goal);
  };

  // Custom cycle info string
  const getCycleInfoText = () => {
    if (resetPeriod === 'daily') return `🗓️ Daily Reset (Today: ${todayStr})`;
    if (resetPeriod === 'weekly') return `🗓️ Weekly Cycle: Mon to Sun`;
    return `🗓️ Cycle: ${cycle.startDateStr} to ${cycle.endDateStr}`;
  };

  if (viewMode === 'clean') {
    return (
      <div 
        className={`glass-panel glass-panel-hover animate-fade-in ${accentClass}`} 
        style={{
          padding: '14px 16px',
          borderLeft: '4px solid var(--accent)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: overdriveActive 
            ? '0 0 15px var(--accent-glow)' 
            : '0 4px 16px 0 rgba(0, 0, 0, 0.25)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          ...customAccentStyle
        }}
      >
        {/* Subtle blur background */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: overdriveActive ? 'var(--neon-green-dim)' : 'var(--accent-dim)',
          filter: 'blur(20px)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px var(--accent-glow)'
            }}>
              {renderIcon()}
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, padding: 0 }}>
                {goal.name}
                {goal.groupName && (
                  <span style={{ 
                    fontSize: '0.58rem', 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)', 
                    padding: '0px 4px', 
                    borderRadius: '4px', 
                    fontWeight: 600
                  }}>
                    {goal.groupName}
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.02em' }}>
                  {resetPeriod}
                </span>
                {overdriveActive && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--neon-green)', textShadow: '0 0 4px var(--neon-green)' }}>
                    ⚡ OVERDRIVE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions (Log + 1 or Log + 5m, plus Edit/Delete on Hover or visible in menu) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Quick Increment log button */}
            <button
              onClick={() => handleQuickAdd(goal.unitType === 'duration' ? 300 : 1)}
              onMouseEnter={() => soundManager.playTick()}
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 6px var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                transition: 'all 0.2s',
                marginRight: '4px'
              }}
              title={goal.unitType === 'duration' ? 'Add 5 minutes' : 'Add 1 count'}
            >
              <span>+</span>
              <span>{goal.unitType === 'duration' ? '5m' : '1'}</span>
            </button>

            {/* Compact edit / duplicate / delete */}
            <button 
              onClick={() => { soundManager.playCosmicSuccess(); onDuplicateGoal(goal); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Duplicate"
            >
              <Copy size={11} />
            </button>
            <button 
              onClick={handleEditGoal}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Edit"
            >
              <Edit2 size={11} />
            </button>
            <button 
              onClick={handleTrashGoal}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Clean monthly/weekly progress plus daily target */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>
              {resetPeriod === 'daily' ? 'Monthly Potential' : resetPeriod === 'weekly' ? 'Weekly Progress' : 'Monthly Progress'}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              {formatQuantity(totalLogged)} / {formatQuantity(monthlyTarget)} ({progressPercent}%)
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '5px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(100, progressPercent)}%`,
              height: '100%',
              background: overdriveActive && resetPeriod === 'daily'
                ? 'linear-gradient(90deg, #b026ff, #ff007f, #00f0ff, #39ff14)'
                : 'var(--accent)',
              borderRadius: '10px',
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', marginTop: '9px' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Daily Target
              <span style={{ color: 'var(--accent)', background: 'var(--accent-dim)', padding: '0 4px', borderRadius: '3px' }}>Today</span>
            </span>
            <span style={{
              fontSize: '0.68rem',
              color: overdriveActive ? 'var(--neon-green)' : 'var(--text-primary)',
              fontWeight: 700,
              textShadow: overdriveActive ? '0 0 5px var(--neon-green-glow)' : 'none'
            }}>
              {formatQuantity(todayLogged)} / {formatQuantity(dailyTargetRef)} ({dailyProgressPercent}%)
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '5px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(100, dailyProgressPercent)}%`,
              height: '100%',
              background: overdriveActive
                ? 'linear-gradient(90deg, #39ff14, #00f0ff, #b026ff)'
                : 'linear-gradient(to right, var(--accent-dim), var(--accent))',
              backgroundSize: overdriveActive ? '220% 220%' : 'initial',
              animation: overdriveActive ? 'overdriveRainbow 3s ease infinite' : 'none',
              borderRadius: '10px',
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`glass-panel glass-panel-hover animate-fade-in ${accentClass}`} 
      style={{
        padding: '20px',
        borderLeft: '4px solid var(--accent)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: overdriveActive 
          ? '0 0 25px var(--accent-glow), 0 0 15px rgba(57,255,20,0.1)' 
          : '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: overdriveActive ? 'cardPulse 2.5s infinite alternate' : 'none',
        ...customAccentStyle
      }}
    >
      {/* Inject custom CSS keyframes dynamically for overdrive state */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes cardPulse {
          0% {
            border-color: var(--accent);
          }
          100% {
            border-color: #39ff14;
            box-shadow: 0 0 24px var(--accent-glow), inset 0 0 12px rgba(57, 255, 20, 0.1);
          }
        }
        @keyframes overdriveRainbow {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
      `}} />

      {/* Visual glow behind individual cards */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '110px',
        height: '110px',
        borderRadius: '50%',
        background: overdriveActive ? 'var(--neon-green-dim)' : 'var(--accent-dim)',
        filter: 'blur(35px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1, marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px var(--accent-glow)'
          }}>
            {renderIcon()}
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {goal.name}
              {goal.groupName && (
                <span style={{ 
                  fontSize: '0.62rem', 
                  background: 'rgba(255,255,255,0.06)', 
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)', 
                  padding: '1px 5px', 
                  borderRadius: '6px', 
                  fontWeight: 600
                }}>
                  {goal.groupName}
                </span>
              )}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                {goal.category === 'ai' ? '🤖 AI tool' : goal.category === 'self' ? '🧠 Habit' : '💼 Project'}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {resetPeriod}
              </span>

              {overdriveActive && (
                <>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>•</span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 800, 
                    color: 'var(--neon-green)', 
                    textShadow: '0 0 5px var(--neon-green)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '2px' 
                  }}>
                    <Sparkles size={8} /> OVERDRIVE
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit, Copy and Trash controls */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            onClick={() => { soundManager.playCosmicSuccess(); onDuplicateGoal(goal); }}
            onMouseEnter={() => soundManager.playTick()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Duplicate / Clone goal"
          >
            <Copy size={13} />
          </button>
          <button 
            onClick={handleEditGoal}
            onMouseEnter={() => soundManager.playTick()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Edit goal settings"
          >
            <Edit2 size={13} />
          </button>
          <button 
            onClick={handleTrashGoal}
            onMouseEnter={() => soundManager.playTick()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Delete goal"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Cycle Date String */}
      <div style={{ 
        fontSize: '0.72rem', 
        color: 'var(--text-secondary)', 
        marginBottom: '14px', 
        background: 'rgba(0,0,0,0.15)', 
        border: '1px solid var(--glass-border)', 
        padding: '5px 10px', 
        borderRadius: '8px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        zIndex: 1, 
        position: 'relative' 
      }}>
        <span>{getCycleInfoText()}</span>
        {resetPeriod === 'monthly' && (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Reset Day {goal.resetDay || 1}</span>
        )}
        {resetPeriod === 'weekly' && (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Mon Reset</span>
        )}
        {resetPeriod === 'daily' && (
          <span style={{ color: missedDays > 0 ? 'var(--neon-pink)' : 'var(--neon-green)', fontWeight: 600 }}>
            {missedDays > 0 ? `${missedDays} Missed (per month)` : 'Perfect Month (0 Missed)'}
          </span>
        )}
      </div>

      {/* Double Progress Bars - Sleek & Premium */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: isExpanded ? '18px' : '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* 1. Limit Progress Bar (Monthly or Weekly or Daily potential) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {resetPeriod === 'daily' ? 'Monthly Potential Achieved' : resetPeriod === 'weekly' ? 'Weekly Limit Progress' : 'Monthly Limit Progress'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              {formatQuantity(totalLogged)} / {formatQuantity(monthlyTarget)} ({progressPercent}%)
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '7px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(100, progressPercent)}%`,
              height: '100%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent-glow)',
              borderRadius: '10px',
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>
        </div>

        {/* 2. Daily target Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {resetPeriod === 'daily' ? 'Daily Limit Progress' : 'Daily Progress' }
              <span style={{ fontSize: '0.62rem', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '0px 4px', borderRadius: '3px', fontWeight: 600 }}>Today</span>
            </span>
            <span style={{ 
              fontSize: '0.75rem', 
              color: overdriveActive ? 'var(--neon-green)' : 'var(--text-primary)', 
              fontWeight: 700,
              textShadow: overdriveActive ? '0 0 5px var(--neon-green-glow)' : 'none'
            }}>
              {overdriveActive ? `⚡ OVERDRIVE! (${dailyProgressPercent}%)` : `${formatQuantity(todayLogged)} / ${formatQuantity(dailyTargetRef)} (${dailyProgressPercent}%)`}
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(100, dailyProgressPercent)}%`,
              height: '100%',
              background: overdriveActive
                ? 'linear-gradient(90deg, #b026ff, #ff007f, #00f0ff, #39ff14)'
                : 'linear-gradient(to right, var(--accent-dim), var(--accent))',
              backgroundSize: overdriveActive ? '300% 300%' : 'initial',
              animation: overdriveActive ? 'overdriveRainbow 3s ease infinite' : 'none',
              boxShadow: overdriveActive ? '0 0 10px rgba(57,255,20,0.5)' : '0 0 5px var(--accent-glow)',
              borderRadius: '10px',
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>
        </div>
      </div>

      {/* Expandable slide-out panel containing all complicated sections */}
      {isExpanded && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
          
          {/* Daily targets summary panel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--glass-border)',
            padding: '10px 12px',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                {resetPeriod === 'daily' ? 'Daily Limit' : 'Static target/day'}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatQuantity(staticDaily)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {resetPeriod === 'daily' ? 'Remaining Today' : 'Adaptive target/day'} 
                {resetPeriod !== 'daily' && <TrendingUp size={10} style={{ color: 'var(--accent)' }} />}
              </div>
              <div style={{ 
                fontSize: '0.88rem', 
                fontWeight: 800, 
                color: remainingGoal <= 0 ? 'var(--neon-green)' : 'var(--accent)',
                textShadow: remainingGoal <= 0 ? '0 0 8px rgba(57, 255, 20, 0.3)' : '0 0 8px var(--accent-glow)',
                marginTop: '2px' 
              }}>
                {remainingGoal <= 0 ? 'Satisfied! 🎉' : formatQuantity(adaptiveDaily)}
              </div>
            </div>
          </div>

          {/* Quota Extras Panel */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--glass-border)',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '0.78rem'
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>
              ✨ Buffers & Cycle Analytics
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {resetPeriod !== 'daily' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Surplus Buffer vs Static:</span>
                  <span style={{ fontWeight: 700, color: surplusDeficit >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)' }}>
                    {surplusDeficit >= 0 ? `+${formatQuantity(surplusDeficit)} (Ahead)` : `${formatQuantity(surplusDeficit)} (Behind)`}
                  </span>
                </div>
              )}
              {resetPeriod === 'daily' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Days Missed this Month:</span>
                  <span style={{ fontWeight: 700, color: missedDays > 0 ? 'var(--neon-pink)' : 'var(--neon-green)' }}>
                    {missedDays} {missedDays === 1 ? 'day' : 'days'} missed
                  </span>
                </div>
              )}
              {totalSurplus > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overachieved Surplus:</span>
                  <span style={{ fontWeight: 800, color: 'var(--neon-green)', textShadow: '0 0 6px var(--neon-green)' }}>
                    +{formatQuantity(totalSurplus)} (Limit Exceeded)
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cycle Elapsed Days:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Day {elapsedDays} of {totalDays} ({Math.round(elapsedDays / totalDays * 100)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Input Loggers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-title)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ⚡ Fast Contribution Input
            </div>

            {/* Slider & manual submission with accurate text input */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {(() => {
                const maxSliderValue = goal.unitType === 'duration' 
                  ? Math.max(goal.target, 3600) 
                  : Math.max(goal.target, 50);
                return (
                  <>
                    <input
                      type="range"
                      min={goal.unitType === 'duration' ? '10' : '1'}
                      max={maxSliderValue}
                      step={goal.unitType === 'duration' ? '10' : '1'}
                      value={logValue}
                      onChange={(e) => setLogValue(parseInt(e.target.value) || 0)}
                      style={{
                        flex: 1,
                        height: '5px',
                        borderRadius: '5px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        outline: 'none',
                        cursor: 'pointer',
                        accentColor: 'var(--accent)'
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
              
              <button 
                onClick={handleSliderSubmit}
                onMouseEnter={() => soundManager.playTick()}
                className="btn-premium"
                style={{ 
                  padding: '5px 12px', 
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                Log {formatQuantity(logValue)}
              </button>
            </div>

            {/* Incremental shortcuts */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {goal.unitType === 'duration' ? (
                <>
                  <button onClick={() => handleQuickAdd(60)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+1m</button>
                  <button onClick={() => handleQuickAdd(300)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+5m</button>
                  <button onClick={() => handleQuickAdd(900)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+15m</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleQuickAdd(1)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+1</button>
                  <button onClick={() => handleQuickAdd(5)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+5</button>
                  <button onClick={() => handleQuickAdd(10)} className="btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem', borderRadius: '6px', flex: 1, justifyContent: 'center' }}>+10</button>
                </>
              )}
            </div>
          </div>

          {/* History Drawer Toggle */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
            <button
              onClick={() => { soundManager.playClick(); setShowHistory(!showHistory); }}
              onMouseEnter={() => soundManager.playTick()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}
            >
              <History size={13} style={{ color: 'var(--accent)' }} /> 
              {showHistory ? 'Hide entry history logs' : `Show log history (${goalLogs.length})`}
            </button>

            {showHistory && (
              <div className="animate-fade-in" style={{
                marginTop: '10px',
                maxHeight: '120px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '4px'
              }}>
                {goalLogs.length === 0 ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No records logged for this cycle yet.
                  </span>
                ) : (
                  goalLogs.map(log => (
                    <div key={log.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(0,0,0,0.15)',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.01)'
                    }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        📅 {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                          {formatQuantity(log.value)}
                        </span>
                        <button
                          onClick={() => {
                            soundManager.playLogDecrease();
                            onDeleteLog(log.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Remove entry"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacious Toggle Expand/Collapse Drawer Button */}
      <button
        onClick={() => { soundManager.playClick(); setIsExpanded(!isExpanded); }}
        onMouseEnter={() => soundManager.playTick()}
        className="btn-secondary"
        style={{
          width: '100%',
          marginTop: '12px',
          padding: '8px 12px',
          fontSize: '0.78rem',
          borderRadius: '10px',
          justifyContent: 'center',
          background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer'
        }}
      >
        <span>🎛️</span>
        {isExpanded ? 'Hide Mission Control & Detailed Stats' : 'Expand Mission Control & Detailed Stats'}
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Cycle Days remaining indicator badge */}
      {remainingGoal > 0 && resetPeriod !== 'daily' && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          right: '12px',
          fontSize: '0.62rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          pointerEvents: 'none'
        }}>
          <Calendar size={8} /> {remainingDays} days remaining this cycle
        </div>
      )}
    </div>
  );
};
