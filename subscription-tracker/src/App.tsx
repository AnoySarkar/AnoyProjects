import { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { soundManager } from './utils/soundManager';
import type { Goal, LogEntry, GoalCategory } from './types';
import { OverallProgressRing } from './components/OverallProgressRing';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { ActivityBarChart } from './components/ActivityBarChart';
import { BadgesSection } from './components/BadgesSection';
import { QuotaExporter } from './components/QuotaExporter';
import { GoalCard } from './components/GoalCard';
import { GoalModal } from './components/GoalModal';
import { QuickLogStation } from './components/QuickLogStation';
import { 
  Plus, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  PieChart, 
  Target,
  Trophy,
  Undo2,
  Redo2,
  Menu
} from 'lucide-react';


type ThemeName = 'cosmic' | 'dark' | 'light' | 'kinetic';
type StoredThemeName = ThemeName | 'alive';

function App() {
  // 1. Core Persistent State
  const [goals, setGoals] = useLocalStorage<Goal[]>('aura_tracker_goals', []);
  const [logs, setLogs] = useLocalStorage<LogEntry[]>('aura_tracker_logs', []);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>('aura_tracker_muted', false);
  const [activeTheme, setActiveTheme] = useLocalStorage<StoredThemeName>('aura_tracker_theme', 'cosmic');
  const currentTheme: ThemeName = activeTheme === 'alive' ? 'kinetic' : activeTheme;
  const [viewMode, setViewMode] = useLocalStorage<'detailed' | 'clean'>('aura_tracker_view_mode', 'detailed');

  // 2. Undo/Redo History Engine State
  const [history, setHistory] = useState<{ goals: Goal[]; logs: LogEntry[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // 3. Local UI Filters & Mobile drawer States
  const [activeWorkspace, setActiveWorkspace] = useState<GoalCategory | 'all'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Calculate current year-month YYYY-MM
  const getCurrentMonthStr = () => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  };
  const [activeMonth, setActiveMonth] = useState<string>(getCurrentMonthStr());
  const [activeView, setActiveView] = useState<'workspaces' | 'analytics' | 'badges' | 'quota'>('workspaces');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<Goal | null>(null);
  const themeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize soundManager mute state
  useEffect(() => {
    soundManager.setMute(isMuted);
  }, [isMuted]);

  // Synchronize theme with HTML document element
  useEffect(() => {
    if (activeTheme === 'alive') {
      setActiveTheme('kinetic');
    }
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [activeTheme, currentTheme, setActiveTheme]);

  // Theme-specific motion backgrounds keep each palette feeling responsive without changing layout.
  useEffect(() => {
    const canvas = themeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resizeCanvas = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * scale);
      canvas.height = Math.floor(window.innerHeight * scale);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    type ParticleKind = 'star' | 'nucleus' | 'electron' | 'node' | 'spark' | 'bubble';

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      type: ParticleKind;
      orbitRadiusX?: number;
      orbitRadiusY?: number;
      orbitSpeed?: number;
      orbitRotation?: number;
      angle?: number;
      centerX?: number;
      centerY?: number;
      phase?: number;
    }

    const particles: Particle[] = [];
    const palette = {
      cosmic: ['rgba(0, 240, 255, 0.55)', 'rgba(176, 38, 255, 0.45)', 'rgba(255, 0, 127, 0.38)'],
      dark: ['rgba(255, 255, 255, 0.42)', 'rgba(165, 165, 170, 0.26)', 'rgba(90, 90, 96, 0.18)'],
      light: ['rgba(20, 20, 24, 0.16)', 'rgba(105, 112, 122, 0.14)', 'rgba(0, 112, 243, 0.12)'],
      kinetic: ['rgba(57, 255, 20, 0.42)', 'rgba(0, 240, 255, 0.34)', 'rgba(255, 115, 0, 0.28)']
    }[currentTheme];

    const width = () => window.innerWidth;
    const height = () => window.innerHeight;

    const makeAtoms = () => {
      for (let i = 0; i < 4; i++) {
        const cx = width() * (0.16 + i * 0.23);
        const cy = height() * (0.22 + (i % 2) * 0.42);
        particles.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          radius: 5 + Math.random() * 3,
          color: palette[i % palette.length],
          type: 'nucleus',
          phase: Math.random() * Math.PI * 2
        });

        for (let shell = 1; shell <= 3; shell++) {
          const rx = 32 + shell * 24;
          const ry = rx * (0.38 + shell * 0.07);
          particles.push({
            x: cx,
            y: cy,
            vx: 0,
            vy: 0,
            radius: 2,
            color: palette[i % palette.length],
            type: 'electron',
            orbitRadiusX: rx,
            orbitRadiusY: ry,
            orbitSpeed: 0.008 + shell * 0.003,
            orbitRotation: i * 0.62 + shell * 0.22,
            angle: Math.random() * Math.PI * 2,
            centerX: cx,
            centerY: cy
          });
        }
      }

      for (let i = 0; i < 54; i++) {
        particles.push({
          x: Math.random() * width(),
          y: Math.random() * height(),
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          radius: 1 + Math.random() * 2.4,
          color: palette[i % palette.length],
          type: i % 3 === 0 ? 'node' : 'star',
          phase: Math.random() * Math.PI * 2
        });
      }
    };

    const makeField = () => {
      const count = currentTheme === 'light' ? 42 : 62;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width(),
          y: Math.random() * height(),
          vx: (Math.random() - 0.5) * (currentTheme === 'dark' ? 0.22 : 0.36),
          vy: (Math.random() - 0.5) * (currentTheme === 'light' ? 0.18 : 0.34),
          radius: currentTheme === 'light' ? 10 + Math.random() * 30 : 1.5 + Math.random() * 4,
          color: palette[i % palette.length],
          type: currentTheme === 'light' ? 'bubble' : currentTheme === 'dark' ? 'spark' : 'node',
          phase: Math.random() * Math.PI * 2
        });
      }
    };

    if (currentTheme === 'cosmic') makeAtoms();
    else makeField();

    const wrap = (p: Particle) => {
      if (p.x < -80) p.x = width() + 80;
      if (p.x > width() + 80) p.x = -80;
      if (p.y < -80) p.y = height() + 80;
      if (p.y > height() + 80) p.y = -80;
    };

    const draw = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width(), height());

      if (currentTheme === 'kinetic') {
        for (let row = -1; row < 9; row++) {
          ctx.beginPath();
          for (let x = -40; x <= width() + 40; x += 24) {
            const y = row * 120 + Math.sin(x * 0.008 + time * 3 + row) * 24 + Math.cos(time * 2 + row) * 18;
            if (x === -40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = row % 2 ? 'rgba(0, 240, 255, 0.08)' : 'rgba(57, 255, 20, 0.08)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      particles.forEach(p => {
        if (p.type === 'nucleus') {
          p.x += p.vx + Math.sin(time + (p.phase || 0)) * 0.08;
          p.y += p.vy + Math.cos(time + (p.phase || 0)) * 0.08;
          if (p.x < 80 || p.x > width() - 80) p.vx *= -1;
          if (p.y < 80 || p.y > height() - 80) p.vy *= -1;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 16;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      particles.forEach(p => {
        if (p.type === 'electron') {
          const myNucleus = particles.find(n => n.type === 'nucleus' && n.color === p.color);
          if (myNucleus) {
            p.centerX = myNucleus.x;
            p.centerY = myNucleus.y;
          }
          
          if (
            p.angle !== undefined && 
            p.orbitSpeed !== undefined && 
            p.orbitRadiusX !== undefined && 
            p.orbitRadiusY !== undefined && 
            p.centerX !== undefined && 
            p.centerY !== undefined
          ) {
            p.angle += p.orbitSpeed;
            
            const rot = p.orbitRotation || 0;
            const cosRot = Math.cos(rot);
            const sinRot = Math.sin(rot);
            const unrotatedX = p.orbitRadiusX * Math.cos(p.angle);
            const unrotatedY = p.orbitRadiusY * Math.sin(p.angle);
            
            p.x = p.centerX + (unrotatedX * cosRot - unrotatedY * sinRot);
            p.y = p.centerY + (unrotatedX * sinRot + unrotatedY * cosRot);

            ctx.beginPath();
            ctx.ellipse(p.centerX, p.centerY, p.orbitRadiusX, p.orbitRadiusY, rot, 0, Math.PI * 2);
            ctx.strokeStyle = p.color.replace(/0\.\d+\)/, '0.11)');
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      });

      particles.forEach(p => {
        if (p.type === 'star' || p.type === 'node' || p.type === 'spark' || p.type === 'bubble') {
          const phase = p.phase || 0;
          p.x += p.vx + Math.sin(time * 2 + phase) * 0.16;
          p.y += p.vy + Math.cos(time * 1.6 + phase) * 0.12;
          wrap(p);

          ctx.beginPath();
          if (p.type === 'bubble') {
            ctx.ellipse(p.x, p.y, p.radius * 1.8, p.radius * 0.55, Math.sin(time + phase) * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
          }
        }
      });

      if (currentTheme !== 'light') {
        const connectDist = currentTheme === 'dark' ? 105 : 135;
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          if (p1.type !== 'node' && p1.type !== 'spark' && p1.type !== 'star') continue;
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            if (p2.type !== p1.type && currentTheme !== 'cosmic') continue;
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < connectDist) {
              const alpha = (1 - dist / connectDist) * (currentTheme === 'dark' ? 0.12 : 0.18);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = p1.color.replace(/0\.\d+\)/, `${alpha})`);
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      } else {
        particles.forEach(p => {
          if (p.type !== 'bubble') return;
          ctx.beginPath();
          ctx.moveTo(p.x - p.radius, p.y);
          ctx.quadraticCurveTo(p.x, p.y + Math.sin(time + (p.phase || 0)) * 16, p.x + p.radius, p.y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      if (currentTheme === 'dark') {
        for (let y = 0; y < height(); y += 42) {
          ctx.beginPath();
          ctx.moveTo(0, y + Math.sin(time * 3 + y) * 3);
          ctx.lineTo(width(), y + Math.sin(time * 3 + y) * 3);
          ctx.strokeStyle = 'rgba(255,255,255,0.018)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (currentTheme === 'light') {
        ctx.beginPath();
        ctx.arc(width() * 0.75 + Math.sin(time) * 70, height() * 0.22 + Math.cos(time * 0.7) * 45, 160, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.035)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [currentTheme]);

  // Sync state history once on initial mount/load
  useEffect(() => {
    if (history.length === 0 && (goals.length > 0 || logs.length > 0)) {
      setHistory([{ goals, logs }]);
      setHistoryIndex(0);
    }
  }, [goals, logs]);

  // Helper wrapper that saves state and advances the history timeline
  const updateStateAndPushHistory = (newGoals: Goal[], newLogs: LogEntry[]) => {
    setGoals(newGoals);
    setLogs(newLogs);

    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, { goals: newGoals, logs: newLogs }]);
    setHistoryIndex(nextHistory.length);
  };

  // Global Undo / Redo Trigger Handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      soundManager.playLogDecrease();
      const prevIdx = historyIndex - 1;
      const prevState = history[prevIdx];
      setGoals(prevState.goals);
      setLogs(prevState.logs);
      setHistoryIndex(prevIdx);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      soundManager.playClick();
      const nextIdx = historyIndex + 1;
      const nextState = history[nextIdx];
      setGoals(nextState.goals);
      setLogs(nextState.logs);
      setHistoryIndex(nextIdx);
    }
  };

  // Keyboard intercepts for quick timeline travel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, goals, logs]);

  // Initial Seed Goals (Only if user has no goals to showcase utility instantly!)
  useEffect(() => {
    if (goals.length === 0) {
      const currentMonth = getCurrentMonthStr();
      const seedGoals: Goal[] = [
        {
          id: 'seed-video',
          name: 'AI Video Outputs',
          category: 'ai',
          unitType: 'count',
          target: 500,
          unitName: 'videos',
          color: 'blue',
          icon: 'video',
          month: currentMonth,
          createdAt: new Date().toISOString()
        },
        {
          id: 'seed-midjourney',
          name: 'Midjourney Concept Renders',
          category: 'ai',
          unitType: 'count',
          target: 1000,
          unitName: 'images',
          color: 'pink',
          icon: 'image',
          month: currentMonth,
          createdAt: new Date().toISOString()
        },
        {
          id: 'seed-gym',
          name: 'Mindful Gym Sessions',
          category: 'self',
          unitType: 'count',
          target: 20,
          unitName: 'workouts',
          color: 'green',
          icon: 'dumbbell',
          month: currentMonth,
          createdAt: new Date().toISOString()
        }
      ];
      setGoals(seedGoals);

      // Create a few seed logs to demonstrate charts immediately
      const today = new Date();
      const dateStr = (dayOffset: number) => {
        const d = new Date();
        d.setDate(today.getDate() - dayOffset);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      };

      const seedLogs: LogEntry[] = [
        { id: 'l1', goalId: 'seed-video', date: dateStr(4), value: 15, createdAt: new Date().toISOString() },
        { id: 'l2', goalId: 'seed-video', date: dateStr(3), value: 20, createdAt: new Date().toISOString() },
        { id: 'l3', goalId: 'seed-video', date: dateStr(2), value: 30, createdAt: new Date().toISOString() },
        { id: 'l4', goalId: 'seed-video', date: dateStr(1), value: 45, createdAt: new Date().toISOString() },
        { id: 'l5', goalId: 'seed-midjourney', date: dateStr(3), value: 50, createdAt: new Date().toISOString() },
        { id: 'l6', goalId: 'seed-midjourney', date: dateStr(2), value: 65, createdAt: new Date().toISOString() },
        { id: 'l7', goalId: 'seed-gym', date: dateStr(4), value: 1, createdAt: new Date().toISOString() },
        { id: 'l8', goalId: 'seed-gym', date: dateStr(2), value: 1, createdAt: new Date().toISOString() }
      ];
      setLogs(seedLogs);
    }
  }, []);

  // 3. Goal Handlers
  const handleSaveGoal = (goalData: Omit<Goal, 'id' | 'createdAt'>, goalId?: string) => {
    let nextGoals: Goal[];
    if (goalId) {
      nextGoals = goals.map(g => g.id === goalId ? { ...g, ...goalData } : g);
    } else {
      const newGoal: Goal = {
        ...goalData,
        id: `goal-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      nextGoals = [...goals, newGoal];
    }
    updateStateAndPushHistory(nextGoals, logs);
    setIsAddModalOpen(false);
    setGoalToEdit(null);
  };

  const handleDeleteGoal = (goalId: string) => {
    const nextGoals = goals.filter(g => g.id !== goalId);
    const nextLogs = logs.filter(l => l.goalId !== goalId);
    updateStateAndPushHistory(nextGoals, nextLogs);
  };

  const handleDuplicateGoal = (goal: Goal) => {
    const duplicated: Goal = {
      ...goal,
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `[Copy] ${goal.name}`,
      createdAt: new Date().toISOString()
    };
    const nextGoals = [...goals, duplicated];
    updateStateAndPushHistory(nextGoals, logs);
  };

  // 4. Activity Logging Handlers
  const handleAddLog = (goalId: string, value: number, dateStr?: string) => {
    const today = new Date();
    const resolvedDate = dateStr || `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const existingLogIndex = logs.findIndex(l => l.goalId === goalId && l.date === resolvedDate);
    
    let nextLogs: LogEntry[];
    if (existingLogIndex !== -1) {
      nextLogs = logs.map((l, index) => 
        index === existingLogIndex ? { ...l, value: l.value + value } : l
      );
    } else {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random()}`,
        goalId,
        date: resolvedDate,
        value,
        createdAt: new Date().toISOString()
      };
      nextLogs = [...logs, newEntry];
    }
    updateStateAndPushHistory(goals, nextLogs);
  };

  const handleUpdateLog = (goalId: string, date: string, value: number) => {
    let nextLogs: LogEntry[];
    if (value === 0) {
      nextLogs = logs.filter(l => !(l.goalId === goalId && l.date === date));
    } else {
      const existingLogIndex = logs.findIndex(l => l.goalId === goalId && l.date === date);
      if (existingLogIndex !== -1) {
        nextLogs = logs.map((l, index) => 
          index === existingLogIndex ? { ...l, value } : l
        );
      } else {
        const newEntry: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          goalId,
          date,
          value,
          createdAt: new Date().toISOString()
        };
        nextLogs = [...logs, newEntry];
      }
    }
    updateStateAndPushHistory(goals, nextLogs);
  };

  const handleDeleteLog = (logId: string) => {
    const nextLogs = logs.filter(l => l.id !== logId);
    updateStateAndPushHistory(goals, nextLogs);
  };

  // 5. Calendar Navigation Handlers
  const navigateMonth = (direction: 'prev' | 'next') => {
    soundManager.playClick();
    const [yStr, mStr] = activeMonth.split('-');
    let year = parseInt(yStr);
    let month = parseInt(mStr);

    if (direction === 'prev') {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    } else {
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }

    setActiveMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  // Helper: Month name pretty print
  const getPrettyMonthName = (monthStrVal: string) => {
    const [y, m] = monthStrVal.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // 6. Global Stat Calculations
  // Filter active goals by month and workspace
  const monthGoals = goals.filter(g => g.month === activeMonth);
  
  const filteredGoals = monthGoals.filter(g => {
    if (activeWorkspace === 'all') return true;
    return g.category === activeWorkspace;
  });

  // Calculate overall metrics
  const totalActiveGoals = monthGoals.length;
  let achievedGoalsCount = 0;
  let overallCompletionRatioSum = 0;

  monthGoals.forEach(goal => {
    const goalLogs = logs.filter(l => l.goalId === goal.id);
    const sum = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
    if (sum >= goal.target && goal.target > 0) {
      achievedGoalsCount += 1;
    }
    const ratio = goal.target > 0 ? Math.min(1.2, sum / goal.target) : 0;
    overallCompletionRatioSum += ratio;
  });

  const globalCompletionPercentage = totalActiveGoals > 0 
    ? Math.round((overallCompletionRatioSum / totalActiveGoals) * 100)
    : 0;

  return (
    <>
      <div className="theme-atmosphere" />
      <canvas ref={themeCanvasRef} className="theme-motion-canvas" />

      {/* Mobile Drawer Sidebar Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-sidebar-backdrop"
          onClick={() => { soundManager.playClick(); setIsMobileMenuOpen(false); }}
        />
      )}

      <div className="app-container">
        {/* Sidebar Navigation Panel (Responsive blur drawer on mobile) */}
        <aside className={`sidebar-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div>
            {/* Logo Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00f0ff, #b026ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)'
              }}>
                <Sparkles size={20} style={{ color: '#03030d' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-title)', fontWeight: 800, background: 'linear-gradient(to right, #fff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  QUOTA TRACKER
                </h1>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
                  Output ROI Engine
                </span>
              </div>
            </div>

            {/* Menu Buttons */}
            <nav className="sidebar-menu">
              <button 
                onClick={() => { soundManager.playClick(); setActiveView('workspaces'); setIsMobileMenuOpen(false); }}
                className={`sidebar-menu-btn blue-accent ${activeView === 'workspaces' ? 'active' : ''}`}
              >
                <Target size={18} /> Goal Workspaces
              </button>

              <button 
                onClick={() => { soundManager.playClick(); setActiveView('analytics'); setIsMobileMenuOpen(false); }}
                className={`sidebar-menu-btn purple-accent ${activeView === 'analytics' ? 'active' : ''}`}
              >
                <PieChart size={18} /> Analytics & Charts
              </button>

              <button 
                onClick={() => { soundManager.playClick(); setActiveView('badges'); setIsMobileMenuOpen(false); }}
                className={`sidebar-menu-btn pink-accent ${activeView === 'badges' ? 'active' : ''}`}
              >
                <Trophy size={18} /> Glowing Streaks
              </button>

              <button 
                onClick={() => { soundManager.playClick(); setActiveView('quota'); setIsMobileMenuOpen(false); }}
                className={`sidebar-menu-btn orange-accent ${activeView === 'quota' ? 'active' : ''}`}
              >
                <Sparkles size={18} /> Quota Card Exporter
              </button>
            </nav>
          </div>

          {/* Sticky Bottom Actions inside Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
            
            {/* Theme Selector Widget */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                🎨 Workspace Theme
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={() => { soundManager.playClick(); setActiveTheme('cosmic'); }}
                  className={`theme-btn ${currentTheme === 'cosmic' ? 'active' : ''}`}
                  style={{
                    background: currentTheme === 'cosmic' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: currentTheme === 'cosmic' ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: currentTheme === 'cosmic' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  🚀 Cosmic
                </button>
                <button
                  onClick={() => { soundManager.playClick(); setActiveTheme('dark'); }}
                  className={`theme-btn ${currentTheme === 'dark' ? 'active' : ''}`}
                  style={{
                    background: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: currentTheme === 'dark' ? '1px solid var(--text-primary)' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: currentTheme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  🌑 Dark
                </button>
                <button
                  onClick={() => { soundManager.playClick(); setActiveTheme('light'); }}
                  className={`theme-btn ${currentTheme === 'light' ? 'active' : ''}`}
                  style={{
                    background: currentTheme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255,255,255,0.02)',
                    border: currentTheme === 'light' ? '1px solid var(--text-primary)' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: currentTheme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  ☀️ Light
                </button>
                <button
                  onClick={() => { soundManager.playClick(); setActiveTheme('kinetic'); }}
                  className={`theme-btn ${currentTheme === 'kinetic' ? 'active' : ''}`}
                  style={{
                    background: currentTheme === 'kinetic' ? 'rgba(176, 38, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: currentTheme === 'kinetic' ? '1px solid var(--neon-purple)' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: currentTheme === 'kinetic' ? 'var(--neon-purple)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  Kinetic
                </button>
              </div>
            </div>

            {/* Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '12px' }}>
              <button 
                onClick={() => navigateMonth('prev')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-title)', color: 'var(--text-primary)', textAlign: 'center' }}>
                {getPrettyMonthName(activeMonth).toUpperCase()}
              </span>
              <button 
                onClick={() => navigateMonth('next')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Mute and Create Goal */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { soundManager.playClick(); setIsMuted(!isMuted); }}
                onMouseEnter={() => soundManager.playTick()}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isMuted ? 'var(--text-muted)' : 'var(--neon-blue)',
                  boxShadow: isMuted ? 'none' : '0 0 10px var(--neon-blue-glow)',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                title={isMuted ? 'Unmute synthesized audio effects' : 'Mute audio feedback'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <button
                onClick={() => { soundManager.playClick(); setIsAddModalOpen(true); }}
                onMouseEnter={() => soundManager.playTick()}
                className="blue-accent btn-premium"
                style={{
                  flexGrow: 1,
                  padding: '10px 12px',
                  fontSize: '0.88rem',
                  height: '42px',
                  justifyContent: 'center'
                }}
              >
                <Plus size={16} /> Create Goal
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content-panel">
          {/* Top Workspace Header Bar (Undo/Redo hub + mobile toggler) */}
          <div className="workspace-header-bar" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--header-bg)',
            backdropFilter: 'blur(15px)',
            borderBottom: '1px solid var(--glass-border)',
            padding: '12px 24px',
            margin: '-40px -40px 24px -40px',
            position: 'sticky',
            top: '-40px',
            zIndex: 100
          }}>
            {/* Left Side: Mobile Menu Toggler + Breadcrumbs / Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => { soundManager.playClick(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
                className="mobile-menu-toggler"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'none'
                }}
              >
                <Menu size={20} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Workspace Session
                </span>
                <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-title)', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🛰️ Orbital Telemetry Station
                </span>
              </div>
            </div>

            {/* Right Side: Undo/Redo & sound indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }} className="keyboard-shortcuts-tip">
                Press <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+Z</kbd> / <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>Ctrl+Y</kbd>
              </span>

              <div className="glass-panel" style={{ display: 'flex', padding: '3px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', gap: '2px', border: '1px solid var(--glass-border)' }}>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  style={{
                    border: 'none',
                    color: historyIndex > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: historyIndex > 0 ? 'pointer' : 'not-allowed',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: historyIndex > 0 ? 'rgba(255,255,255,0.02)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  title="Undo last action (Ctrl+Z)"
                >
                  <Undo2 size={13} /> Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  style={{
                    border: 'none',
                    color: historyIndex < history.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: historyIndex < history.length - 1 ? 'pointer' : 'not-allowed',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: historyIndex < history.length - 1 ? 'rgba(255,255,255,0.02)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  title="Redo action (Ctrl+Y)"
                >
                  Redo <Redo2 size={13} />
                </button>
              </div>
            </div>
          </div>

          {activeView === 'workspaces' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Log Station rendered at the very top */}
              <QuickLogStation goals={monthGoals} onAddLog={handleAddLog} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target style={{ color: 'var(--neon-pink)', width: '20px', height: '20px' }} />
                  <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-title)', fontWeight: 800 }}>
                    Active Performance Workspace
                  </h2>
                </div>

                {/* Control Panel: Left separate + button, workspace category tabs, detailed/clean switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  
                  {/* 1. SEPARATE Quick-Add Plus Button on the Left */}
                  <button
                    onClick={() => { soundManager.playClick(); setIsAddModalOpen(true); }}
                    onMouseEnter={() => soundManager.playTick()}
                    style={{
                      background: 'rgba(0, 240, 255, 0.08)',
                      border: '1px solid var(--neon-blue)',
                      color: 'var(--neon-blue)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(0, 240, 255, 0.25)',
                      transition: 'all 0.25s ease',
                      fontWeight: 800,
                      flexShrink: 0
                    }}
                    title="Create New Goal"
                  >
                    <Plus size={16} strokeWidth={3} />
                  </button>

                  {/* 2. Glowing Category Select Tabs */}
                  <div className="workspace-tabs" style={{ margin: 0 }}>
                    <button 
                      onClick={() => { soundManager.playClick(); setActiveWorkspace('all'); }} 
                      className={`workspace-tab ${activeWorkspace === 'all' ? 'active' : ''}`}
                    >
                      🌐 Show All
                    </button>
                    <button 
                      onClick={() => { soundManager.playClick(); setActiveWorkspace('ai'); }} 
                      className={`workspace-tab ${activeWorkspace === 'ai' ? 'active' : ''}`}
                    >
                      🤖 AI & Tech
                    </button>
                    <button 
                      onClick={() => { soundManager.playClick(); setActiveWorkspace('self'); }} 
                      className={`workspace-tab ${activeWorkspace === 'self' ? 'active' : ''}`}
                    >
                      🧠 Habits
                    </button>
                    <button 
                      onClick={() => { soundManager.playClick(); setActiveWorkspace('projects'); }} 
                      className={`workspace-tab ${activeWorkspace === 'projects' ? 'active' : ''}`}
                    >
                      💼 Projects
                    </button>
                  </div>

                  {/* 3. Detailed / Clean View Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '10px', border: '1px solid var(--glass-border)', flexShrink: 0 }}>
                    <button
                      onClick={() => { soundManager.playClick(); setViewMode('detailed'); }}
                      style={{
                        border: '1px solid transparent',
                        background: viewMode === 'detailed' ? 'rgba(255,255,255,0.06)' : 'none',
                        color: viewMode === 'detailed' ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderColor: viewMode === 'detailed' ? 'var(--glass-border)' : 'transparent',
                        boxShadow: viewMode === 'detailed' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                      }}
                      title="Show detailed stats and full mission control panel"
                    >
                      📊 Detailed
                    </button>
                    <button
                      onClick={() => { soundManager.playClick(); setViewMode('clean'); }}
                      style={{
                        border: '1px solid transparent',
                        background: viewMode === 'clean' ? 'rgba(255,255,255,0.06)' : 'none',
                        color: viewMode === 'clean' ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderColor: viewMode === 'clean' ? 'var(--glass-border)' : 'transparent',
                        boxShadow: viewMode === 'clean' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                      }}
                      title="Show compact minimal cards"
                    >
                      ✨ Clean
                    </button>
                  </div>
                </div>
              </div>

              {/* Render active Goal Cards */}
              {filteredGoals.length === 0 ? (
                <div className="glass-panel" style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <PieChart size={36} style={{ opacity: 0.3 }} />
                  <p style={{ fontSize: '0.95rem' }}>No goals defined inside this workspace category for the selected month.</p>
                  <button
                    onClick={() => { soundManager.playClick(); setIsAddModalOpen(true); }}
                    className="pink-accent btn-premium"
                    style={{ marginTop: '10px' }}
                  >
                    + Add Your First Goal Now
                  </button>
                </div>
              ) : (
                (() => {
                  const hasCustomGroups = filteredGoals.some(g => g.groupName && g.groupName.trim() !== '');
                  if (hasCustomGroups) {
                    const groupedGoals = filteredGoals.reduce((acc, goal) => {
                      const groupKey = goal.groupName ? goal.groupName.trim() : 'General';
                      if (!acc[groupKey]) {
                        acc[groupKey] = [];
                      }
                      acc[groupKey].push(goal);
                      return acc;
                    }, {} as Record<string, Goal[]>);

                    const sortedGroupKeys = Object.keys(groupedGoals).sort((a, b) => {
                      if (a === 'General') return -1;
                      if (b === 'General') return 1;
                      return a.localeCompare(b);
                    });

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
                        {sortedGroupKeys.map(groupKey => {
                          const groupGoals = groupedGoals[groupKey];
                          return (
                            <div key={groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                borderBottom: '1px solid var(--glass-border)',
                                paddingBottom: '8px',
                                marginTop: '10px'
                              }}>
                                <span style={{ fontSize: '1.1rem', color: 'var(--neon-blue)', filter: 'drop-shadow(0 0 5px var(--neon-blue-glow))' }}>🏷️</span>
                                <h4 style={{
                                  fontSize: '0.9rem',
                                  fontFamily: 'var(--font-title)',
                                  fontWeight: 800,
                                  color: 'var(--text-primary)',
                                  letterSpacing: '0.05em',
                                  textTransform: 'uppercase'
                                }}>
                                  {groupKey}
                                </h4>
                                <span style={{
                                  fontSize: '0.68rem',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid var(--glass-border)',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 700
                                }}>
                                  {groupGoals.length} {groupGoals.length === 1 ? 'goal' : 'goals'}
                                </span>
                              </div>

                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                                gap: '20px'
                              }}>
                                {groupGoals.map(goal => (
                                  <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    logs={logs}
                                    onAddLog={handleAddLog}
                                    onDeleteLog={handleDeleteLog}
                                    onDeleteGoal={handleDeleteGoal}
                                    onEditGoal={(g) => { setGoalToEdit(g); setIsAddModalOpen(true); }}
                                    onDuplicateGoal={handleDuplicateGoal}
                                    viewMode={viewMode}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Fallback to flat layout when no custom sub-groups exist
                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: '20px',
                      width: '100%'
                    }}>
                      {filteredGoals.map(goal => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          logs={logs}
                          onAddLog={handleAddLog}
                          onDeleteLog={handleDeleteLog}
                          onDeleteGoal={handleDeleteGoal}
                          onEditGoal={(g) => { setGoalToEdit(g); setIsAddModalOpen(true); }}
                          onDuplicateGoal={handleDuplicateGoal}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {activeView === 'analytics' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <OverallProgressRing percentage={globalCompletionPercentage} />
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
              }}>
                <ActivityHeatmap 
                  goals={monthGoals} 
                  logs={logs} 
                  activeMonth={activeMonth} 
                  onUpdateLog={handleUpdateLog}
                />
                <ActivityBarChart 
                  goals={monthGoals} 
                  logs={logs} 
                  activeMonth={activeMonth}
                />
              </div>
            </div>
          )}

          {activeView === 'badges' && (
            <div className="animate-fade-in">
              <BadgesSection goals={monthGoals} logs={logs} activeMonth={activeMonth} />
            </div>
          )}

          {activeView === 'quota' && (
            <div className="animate-fade-in">
              <QuotaExporter goals={monthGoals} logs={logs} activeMonth={activeMonth} />
            </div>
          )}
        </main>
      </div>

      {/* Goal Addition Modal overlays */}
      {isAddModalOpen && (
        <GoalModal
          onClose={() => { setIsAddModalOpen(false); setGoalToEdit(null); }}
          onSave={handleSaveGoal}
          activeMonth={activeMonth}
          goalToEdit={goalToEdit}
        />
      )}
    </>
  );
}

export default App;
