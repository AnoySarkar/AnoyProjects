import React from 'react';
import type { Goal, LogEntry } from '../types';
import { Award, Flame, Zap, Compass, CheckCircle } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface BadgesSectionProps {
  goals: Goal[];
  logs: LogEntry[];
  activeMonth: string;
}

export const BadgesSection: React.FC<BadgesSectionProps> = ({
  goals,
  logs,
  activeMonth
}) => {
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const totalDays = new Date(year, month, 0).getDate();

  // 1. Calculate max consecutive logging days (Streak)
  const calculateStreak = (): { current: number; has5DayBadge: boolean } => {
    const loggedDates = Array.from(new Set(logs.map(l => l.date))).sort();
    if (loggedDates.length === 0) return { current: 0, has5DayBadge: false };

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    // To check consecutive days properly
    const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    loggedDates.forEach(dateStr => {
      const currentDate = parseLocalDate(dateStr);
      if (!prevDate) {
        currentStreak = 1;
      } else {
        const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak += 1;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      prevDate = currentDate;
    });

    // Also calculate current streak up to today
    let currentActiveStreak = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    // Simple check if today or yesterday was logged to determine active streak
    const hasLoggedToday = loggedDates.includes(todayStr);
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
    const hasLoggedYesterday = loggedDates.includes(yesterdayStr);

    if (hasLoggedToday || hasLoggedYesterday) {
      currentActiveStreak = currentStreak; // rough approximation
    }

    return {
      current: currentActiveStreak,
      has5DayBadge: maxStreak >= 5
    };
  };

  const streakData = calculateStreak();

  // 2. Quantum Leap Check: Logged 200%+ of daily target
  const checkQuantumLeap = (): boolean => {
    let unlocked = false;
    
    // Group logs by date and goalId
    const logMap: { [key: string]: number } = {};
    logs.forEach(log => {
      const key = `${log.date}_${log.goalId}`;
      logMap[key] = (logMap[key] || 0) + log.value;
    });

    Object.entries(logMap).forEach(([key, totalValue]) => {
      const [_, goalId] = key.split('_');
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      const staticDailyTarget = goal.target / totalDays;
      if (totalValue >= staticDailyTarget * 2) {
        unlocked = true;
      }
    });

    return unlocked;
  };

  const hasQuantumLeap = checkQuantumLeap();

  // 3. Halfway Hero Check: Reached 50% on any goal
  const checkHalfwayHero = (): boolean => {
    return goals.some(goal => {
      const goalLogs = logs.filter(l => l.goalId === goal.id);
      const total = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
      return total >= goal.target * 0.5 && goal.target > 0;
    });
  };

  const hasHalfwayHero = checkHalfwayHero();

  // 4. Completion Champion Check: Reached 100%+ on any goal
  const checkCompletionChampion = (): boolean => {
    return goals.some(goal => {
      const goalLogs = logs.filter(l => l.goalId === goal.id);
      const total = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
      return total >= goal.target && goal.target > 0;
    });
  };

  const hasCompletionChampion = checkCompletionChampion();

  const mockBadges = [
    {
      id: 'steady_operator',
      name: 'Steady Operator',
      description: 'Log progress on at least 5 consecutive days.',
      icon: Flame,
      unlocked: streakData.has5DayBadge,
      color: 'orange',
      badgeClass: 'orange-accent'
    },
    {
      id: 'quantum_leap',
      name: 'Quantum Leap',
      description: 'Double your static daily target in a single day.',
      icon: Zap,
      unlocked: hasQuantumLeap,
      color: 'blue',
      badgeClass: 'blue-accent'
    },
    {
      id: 'halfway_hero',
      name: 'Halfway Hero',
      description: 'Reach 50% of the monthly target on any active goal.',
      icon: Compass,
      unlocked: hasHalfwayHero,
      color: 'pink',
      badgeClass: 'pink-accent'
    },
    {
      id: 'completion_champion',
      name: 'Completion Champion',
      description: 'Satisfy 100% of the monthly target on any goal!',
      icon: CheckCircle,
      unlocked: hasCompletionChampion,
      color: 'green',
      badgeClass: 'green-accent'
    }
  ];

  return (
    <div className="glass-panel animate-shimmer" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Award style={{ color: 'var(--neon-orange)', width: '20px', height: '20px' }} />
        <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
          Streaks & Glowing Achievements
        </h3>
      </div>

      {/* Streak display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 18px',
        background: 'rgba(255, 115, 0, 0.05)',
        border: '1px solid rgba(255, 115, 0, 0.15)',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 0 10px rgba(255, 115, 0, 0.05)'
      }}>
        <Flame style={{ color: 'var(--neon-orange)', fill: 'var(--neon-orange)', width: '28px', height: '28px', filter: 'drop-shadow(0 0 8px var(--neon-orange-glow))' }} />
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
            Current Logging Streak
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
            {streakData.current} Days {streakData.current > 0 ? '🔥' : '☄️'}
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {mockBadges.map(badge => {
          const Icon = badge.icon;
          
          return (
            <div 
              key={badge.id}
              className={`${badge.unlocked ? badge.badgeClass : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '18px 12px',
                borderRadius: '16px',
                background: badge.unlocked ? 'var(--accent-dim)' : 'rgba(255, 255, 255, 0.01)',
                border: badge.unlocked ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.03)',
                boxShadow: badge.unlocked ? '0 0 15px var(--accent-glow)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Badge Circle */}
              <div 
                onMouseEnter={() => badge.unlocked && soundManager.playTick()}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: badge.unlocked ? 'var(--accent)' : 'rgba(255, 255, 255, 0.03)',
                  border: badge.unlocked ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--glass-border)',
                  color: badge.unlocked ? '#000' : 'var(--text-muted)',
                  boxShadow: badge.unlocked ? '0 0 20px var(--accent)' : 'none',
                  marginBottom: '12px',
                  cursor: badge.unlocked ? 'pointer' : 'default',
                  transition: 'all 0.3s'
                }}
              >
                <Icon style={{ width: '26px', height: '26px' }} />
              </div>

              <h4 style={{ 
                fontSize: '0.92rem', 
                fontFamily: 'var(--font-title)', 
                fontWeight: 700, 
                color: badge.unlocked ? 'var(--text-primary)' : 'var(--text-muted)',
                marginBottom: '4px'
              }}>
                {badge.name}
              </h4>
              <p style={{ 
                fontSize: '0.78rem', 
                color: badge.unlocked ? 'var(--text-secondary)' : 'var(--text-muted)',
                lineHeight: '1.3'
              }}>
                {badge.description}
              </p>
              
              {badge.unlocked && (
                <div style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  color: 'var(--accent)',
                  marginTop: '8px',
                  letterSpacing: '0.05em'
                }}>
                  UNLOCKED ⚡
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
