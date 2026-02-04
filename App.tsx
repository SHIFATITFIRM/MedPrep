
import React, { useState, useEffect, useMemo } from 'react';
import { GraduationCap, RefreshCw, CheckCircle, Flame, Target, Sun, Moon, Download, Upload, Lightbulb, AlertCircle, Trophy, Bell, X, Quote, Sparkles, Database, Hourglass, Medal, Crown, Footprints, Stethoscope, Clock } from 'lucide-react';
import { SUBJECTS, TASKS, MOTIVATIONAL_LINES, ACHIEVEMENTS } from './constants';
import { StudyData, SubjectStats, ChapterProgress, Reminder, Achievement } from './types';
import SubjectCard from './components/SubjectCard';
import StatsDashboard from './components/StatsDashboard';
import TodayTasksPanel from './components/TodayTasksPanel';
import ReminderSettings from './components/ReminderSettings';
import AIAssistant from './components/AIAssistant';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'medprep_v2_study_tracker_data';

const DEFAULT_STATE: StudyData = {
  progress: {},
  streak: { count: 0, lastActivityDate: null },
  goals: { dailyTaskGoal: 3, targetDate: '' },
  theme: 'light',
  reminders: [],
  unlockedAchievements: []
};

const ICON_MAP: Record<string, any> = {
  Footprints, Trophy, Medal, Crown, Flame, Stethoscope
};

interface AchievementToast {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const App: React.FC = () => {
  const [data, setData] = useState<StudyData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      
      return {
        ...DEFAULT_STATE,
        ...parsed,
        streak: { ...DEFAULT_STATE.streak, ...(parsed.streak || {}) },
        goals: { ...DEFAULT_STATE.goals, ...(parsed.goals || {}) },
        reminders: parsed.reminders || DEFAULT_STATE.reminders,
        progress: parsed.progress || DEFAULT_STATE.progress,
        unlockedAchievements: parsed.unlockedAchievements || DEFAULT_STATE.unlockedAchievements,
      };
    } catch (e) {
      console.error("Failed to parse storage", e);
      return DEFAULT_STATE;
    }
  });

  const [showReminders, setShowReminders] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [toasts, setToasts] = useState<AchievementToast[]>([]);
  const [now, setNow] = useState(new Date());
  
  const [currentQuote, setCurrentQuote] = useState(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_LINES.length);
    return MOTIVATIONAL_LINES[randomIndex];
  });

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [data.theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const timeLeft = useMemo<TimeLeft | null>(() => {
    if (!data.goals?.targetDate) return null;
    const target = new Date(data.goals.targetDate);
    target.setHours(0, 0, 0, 0); // Assuming start of the day for the exam
    
    const diff = target.getTime() - now.getTime();
    
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      total: diff
    };
  }, [data.goals?.targetDate, now]);

  const subjectStats = useMemo<SubjectStats[]>(() => {
    return SUBJECTS.map((sub) => {
      const subProg = (data.progress && data.progress[sub.id]) || {};
      const totalTasks = (sub.chapters || []).length * TASKS.length;
      let completed = 0;
      let totalTime = 0;
      (sub.chapters || []).forEach((ch) => {
        const chProg = subProg[ch.id];
        if (chProg) {
          completed += Object.values(chProg.tasks || {}).filter(Boolean).length;
          totalTime += chProg.meta?.timeSpent || 0;
        }
      });
      return {
        subjectId: sub.id,
        name: sub.name,
        color: sub.color,
        percentage: totalTasks > 0 ? (completed / totalTasks) * 100 : 0,
        totalTime
      };
    });
  }, [data.progress]);

  const overallProgress = useMemo(() => {
    if (subjectStats.length === 0) return 0;
    return subjectStats.reduce((acc, curr) => acc + curr.percentage, 0) / subjectStats.length;
  }, [subjectStats]);

  // Achievement Unlock Logic
  useEffect(() => {
    const toUnlock: string[] = [];

    // First Step
    const hasAnyTask = Object.values(data.progress).some(sub => 
      Object.values(sub).some(ch => Object.values(ch.tasks).some(t => t))
    );
    if (hasAnyTask) toUnlock.push('first_step');

    // First Chapter
    const hasAnyChapter = Object.values(data.progress).some(sub => 
      Object.values(sub).some(ch => Object.values(ch.tasks).filter(Boolean).length === TASKS.length)
    );
    if (hasAnyChapter) toUnlock.push('first_chapter');

    // Halfway
    if (overallProgress >= 50) toUnlock.push('halfway_hero');

    // Subject Master
    const hasSubjectMaster = subjectStats.some(s => s.percentage >= 100);
    if (hasSubjectMaster) toUnlock.push('subject_master');

    // Weekly Warrior
    if ((data.streak?.count || 0) >= 7) toUnlock.push('weekly_warrior');

    // MAT Ready
    if (overallProgress >= 100) toUnlock.push('mat_ready');

    const newUnlocks = toUnlock.filter(id => !data.unlockedAchievements.includes(id));
    
    if (newUnlocks.length > 0) {
      setData(prev => ({
        ...prev,
        unlockedAchievements: [...prev.unlockedAchievements, ...newUnlocks]
      }));

      newUnlocks.forEach(id => {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
          const Icon = ICON_MAP[ach.icon] || Trophy;
          addToast(ach.title, ach.description, <Icon className="w-5 h-5" style={{ color: ach.color }} />);
          if (id === 'mat_ready' || id === 'halfway_hero') triggerMilestoneConfetti();
        }
      });
    }
  }, [data.progress, data.streak.count, overallProgress, subjectStats, data.unlockedAchievements]);

  const addToast = (title: string, description: string, icon: React.ReactNode) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, description, icon }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const triggerMilestoneConfetti = () => {
    const end = Date.now() + (3 * 1000);
    const colors = ['#10b981', '#3b82f6', '#8b5cf6'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const refreshQuote = () => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_LINES.length);
    setCurrentQuote(MOTIVATIONAL_LINES[randomIndex]);
  };

  const handleToggleTask = (subjectId: string, chapterId: string, taskId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    setData((prev) => {
      const subProg = prev.progress[subjectId] || {};
      const chProg = subProg[chapterId] || { 
        tasks: {}, 
        meta: { priority: 'medium', difficulty: 'medium', timeSpent: 0, scheduledDate: null } 
      };
      
      const isChecking = !chProg.tasks[taskId];
      let newStreak = prev.streak;
      if (isChecking && prev.streak.lastActivityDate !== today) {
        if (prev.streak.lastActivityDate === yesterday) {
          newStreak = { count: prev.streak.count + 1, lastActivityDate: today };
        } else {
          newStreak = { count: 1, lastActivityDate: today };
        }
      }

      return {
        ...prev,
        streak: newStreak,
        progress: {
          ...prev.progress,
          [subjectId]: {
            ...subProg,
            [chapterId]: {
              ...chProg,
              tasks: { ...chProg.tasks, [taskId]: isChecking }
            }
          }
        }
      };
    });
  };

  const handleUpdateMeta = (subjectId: string, chapterId: string, metaUpdate: Partial<ChapterProgress['meta']>) => {
    setData(prev => {
      const subProg = prev.progress[subjectId] || {};
      const chProg = subProg[chapterId] || { 
        tasks: {}, 
        meta: { priority: 'medium', difficulty: 'medium', timeSpent: 0, scheduledDate: null } 
      };
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [subjectId]: {
            ...subProg,
            [chapterId]: {
              ...chProg,
              meta: { ...chProg.meta, ...metaUpdate }
            }
          }
        }
      };
    });
  };

  const weakAreas = useMemo(() => {
    return [...subjectStats]
      .filter(s => s.percentage < 40 && s.percentage > 0)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);
  }, [subjectStats]);

  const smartSuggestion = useMemo(() => {
    for (const sub of SUBJECTS) {
      for (const ch of (sub.chapters || [])) {
        const prog = (data.progress && data.progress[sub.id]) ? data.progress[sub.id][ch.id] : null;
        if (prog?.meta?.priority === 'high' && Object.values(prog.tasks || {}).filter(Boolean).length < TASKS.length) {
          return { subName: sub.name, chName: ch.name };
        }
      }
    }
    return null;
  }, [data]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medprep-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("ব্যাকআপ সফল", "আপনার ফাইল ডাউনলোড করা হয়েছে।", <Download className="w-5 h-5 text-emerald-500" />);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (parsed && typeof parsed === 'object') {
            setData(prev => ({
              ...DEFAULT_STATE,
              ...parsed,
              streak: { ...DEFAULT_STATE.streak, ...(parsed.streak || {}) },
              goals: { ...DEFAULT_STATE.goals, ...(parsed.goals || {}) },
              reminders: parsed.reminders || DEFAULT_STATE.reminders,
              progress: parsed.progress || DEFAULT_STATE.progress,
              unlockedAchievements: parsed.unlockedAchievements || DEFAULT_STATE.unlockedAchievements,
            }));
            addToast("ডেটা ইম্পোর্ট সফল", "আপনার অগ্রগতি ফিরিয়ে আনা হয়েছে।", <RefreshCw className="w-5 h-5 text-emerald-500" />);
          }
        } catch (e) {
          addToast("ভুল ফাইল", "সঠিক JSON ফাইল সিলেক্ট করুন।", <AlertCircle className="w-5 h-5 text-red-500" />);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      <AIAssistant data={data} isOpen={showAI} onClose={() => setShowAI(false)} />

      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex items-center gap-3 w-80 animate-pop relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl group-hover:scale-110 transition-transform">
              {toast.icon}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{toast.title}</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{toast.description}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="p-1 text-slate-300 hover:text-slate-600 dark:hover:text-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showReminders && (
        <ReminderSettings 
          reminders={data.reminders || []} 
          onUpdate={reminders => setData(prev => ({ ...prev, reminders }))} 
          onClose={() => setShowReminders(false)} 
        />
      )}

      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:rotate-6 transition-transform cursor-pointer">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-800 dark:text-white">MedPrep <span className="text-emerald-600">HSC</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setShowAI(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition-all">
              <Sparkles className="w-4 h-4" /> AI GURU
            </button>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
              <button onClick={() => setData(p => ({ ...p, theme: 'light' }))} className={`p-1.5 rounded-full transition-all ${data.theme === 'light' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}>
                <Sun className="w-4 h-4" />
              </button>
              <button onClick={() => setData(p => ({ ...p, theme: 'dark' }))} className={`p-1.5 rounded-full transition-all ${data.theme === 'dark' ? 'bg-slate-700 shadow-sm text-indigo-400' : 'text-slate-500'}`}>
                <Moon className="w-4 h-4" />
              </button>
            </div>

            <button onClick={() => setShowReminders(true)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 relative active:scale-90 hidden sm:block">
              <Bell className="w-5 h-5" />
              {(data.reminders || []).some(r => r.enabled) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              )}
            </button>
            
            <button onClick={handleExport} title="Export Data" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 active:scale-90 transition-transform hidden sm:block">
              <Download className="w-5 h-5" />
            </button>
            
            <button onClick={() => window.confirm('সব অগ্রগতি মুছে ফেলতে চান?') && setData(DEFAULT_STATE)} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="mb-8 animate-slideUp">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Quote className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug">{currentQuote.bn}</h2>
                <p className="text-slate-400 dark:text-slate-500 font-medium italic mt-1 text-sm sm:text-base">&ldquo;{currentQuote.en}&rdquo;</p>
              </div>
              <button onClick={refreshQuote} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 transition-all active:rotate-180 duration-500">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-xl hover:-translate-y-1 transition-transform">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/20 p-2 rounded-xl"><Flame className="w-6 h-6 animate-bounce" /></div>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-widest">Active Streak</span>
            </div>
            <p className="text-4xl font-black mb-1">{(data.streak && data.streak.count) || 0} Days</p>
            <p className="text-emerald-100 text-sm">Consistency is your superpower.</p>
          </div>

          <div className={`p-6 rounded-3xl text-white shadow-xl hover:-translate-y-1 transition-transform relative overflow-hidden ${timeLeft && timeLeft.total <= (15 * 24 * 60 * 60 * 1000) ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-blue-600'}`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="bg-white/20 p-2 rounded-xl"><Hourglass className="w-6 h-6" /></div>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> Live Countdown
              </span>
            </div>
            
            {!timeLeft || timeLeft.total === 0 ? (
              <div className="relative z-10 h-12 flex items-center">
                <p className="text-2xl font-black">{!data.goals?.targetDate ? 'Not Set' : 'Exam Time!'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1 relative z-10">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black leading-none">{timeLeft.days}</span>
                  <span className="text-[10px] font-bold uppercase opacity-70">Day</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black leading-none">{timeLeft.hours}</span>
                  <span className="text-[10px] font-bold uppercase opacity-70">Hr</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black leading-none">{timeLeft.minutes}</span>
                  <span className="text-[10px] font-bold uppercase opacity-70">Min</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black leading-none animate-pulse">{timeLeft.seconds}</span>
                  <span className="text-[10px] font-bold uppercase opacity-70">Sec</span>
                </div>
              </div>
            )}
            
            <p className="text-white/80 text-[10px] mt-3 font-medium relative z-10">
              {!data.goals?.targetDate ? 'Set target date below to track.' : (timeLeft && timeLeft.total > 0 ? 'Remaining until medical dream starts.' : 'Exam has passed!')}
            </p>
            
            {/* Background Decorative Element */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Target className="w-4 h-4 text-emerald-500" /> Daily Goals</h3>
              <span className="text-xs font-bold text-slate-400">{(data.goals && data.goals.dailyTaskGoal) || 3} Tasks/day</span>
            </div>
            <input type="date" value={(data.goals && data.goals.targetDate) || ''} onChange={(e) => setData(prev => ({ ...prev, goals: { ...(prev.goals || {}), targetDate: e.target.value } as any }))} className="bg-slate-50 dark:bg-slate-800 text-sm p-2 rounded-xl outline-none text-slate-600 dark:text-slate-300 border border-slate-100 transition-colors" />
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => document.getElementById('trophy-room')?.scrollIntoView({ behavior: 'smooth' })}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Trophy Room</h3>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{data.unlockedAchievements.length}/{ACHIEVEMENTS.length}</span>
            </div>
            <div className="flex -space-x-2 overflow-hidden">
              {ACHIEVEMENTS.map(ach => {
                const Icon = ICON_MAP[ach.icon];
                const isUnlocked = data.unlockedAchievements.includes(ach.id);
                return (
                  <div key={ach.id} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center transition-all ${isUnlocked ? 'z-10 bg-slate-100' : 'bg-slate-50 grayscale opacity-40'}`}>
                    <Icon className="w-4 h-4" style={{ color: isUnlocked ? ach.color : '#94a3b8' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* New Dedicated Achievements Section */}
        <section id="trophy-room" className="mb-12 animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" /> আপনার অর্জন ও লক্ষ্য
            </h3>
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-1.5 text-slate-500"><CheckCircle className="w-4 h-4" /> {Math.round(overallProgress)}% Done</div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-emerald-600">Level {Math.floor(overallProgress / 10) + 1} Candidate</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {ACHIEVEMENTS.map((ach) => {
              const Icon = ICON_MAP[ach.icon];
              const isUnlocked = data.unlockedAchievements.includes(ach.id);
              return (
                <div key={ach.id} className={`group relative bg-white dark:bg-slate-900 rounded-[2rem] p-5 border-2 transition-all duration-500 flex flex-col items-center text-center ${isUnlocked ? 'border-emerald-100 dark:border-emerald-900/30 shadow-xl shadow-emerald-50 dark:shadow-none' : 'border-slate-100 dark:border-slate-800 opacity-60 grayscale'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300 ${isUnlocked ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/50'}`}>
                    <Icon className="w-7 h-7" style={{ color: isUnlocked ? ach.color : '#cbd5e1' }} />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">{ach.title}</p>
                  <p className="text-[9px] font-medium text-slate-400 leading-tight">{ach.description}</p>
                  
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-slate-50/10 backdrop-blur-[1px] rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg">লক করা</div>
                    </div>
                  )}
                  
                  {isUnlocked && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <TodayTasksPanel data={data} />

        <div className="mb-8 p-6 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-200 dark:shadow-none animate-slideUp">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black">AI প্রস্তুতির সাহায্য নিন</h3>
              <p className="text-emerald-100 text-sm">আপনার অগ্রগতির ভিত্তিতে সেরা স্টাডি টিপস এবং বিশ্লেষণ পান।</p>
            </div>
          </div>
          <button onClick={() => setShowAI(true)} className="bg-white text-emerald-700 px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"> গুরুকে জিজ্ঞাসা করুন </button>
        </div>

        {smartSuggestion && (
          <div className="mb-8 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 p-5 rounded-3xl flex items-center gap-4 hover:shadow-lg transition-all animate-slideUp">
            <div className="bg-emerald-500 p-3 rounded-2xl text-white shadow-lg shadow-emerald-200 dark:shadow-none"><Lightbulb className="w-6 h-6 animate-pulse" /></div>
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Study Strategy Recommendation</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Focus on completing: <span className="font-bold underline decoration-2">{smartSuggestion.chName}</span> ({smartSuggestion.subName})</p>
            </div>
          </div>
        )}

        <StatsDashboard stats={subjectStats} overallProgress={overallProgress} />

        {weakAreas.length > 0 && (
          <div className="mb-8 animate-slideUp">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Focus Areas (Low Completion)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {weakAreas.map(area => (
                <div key={area.subjectId} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex justify-between items-center group hover:border-red-500 hover:shadow-xl transition-all text-left">
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 truncate">{area.name}</p>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">{Math.round(area.percentage)}%</span>
                  </div>
                  <button className="bg-red-50 dark:bg-red-900/20 text-red-600 p-2 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-all shrink-0"><RefreshCw className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUBJECTS.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              tasks={TASKS}
              progress={(data.progress && data.progress[subject.id]) || {}}
              onToggleTask={(chapterId, taskId) => handleToggleTask(subject.id, chapterId, taskId)}
              onUpdateMeta={(chapterId, meta) => handleUpdateMeta(subject.id, chapterId, meta)}
            />
          ))}
        </div>

        <div className="mt-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm animate-slideUp">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400"><Database className="w-8 h-8" /></div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">অগ্রগতি ব্যবস্থাপনা (Backup)</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">আপনার পড়াশোনার অগ্রগতির ব্যাকআপ ফাইল হিসেবে ডাউনলোড বা আপলোড করুন।</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button onClick={handleExport} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 dark:bg-slate-700 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-lg active:scale-95">
                <Download className="w-5 h-5" /> ব্যাকআপ ডাউনলোড (JSON)
              </button>
              <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg cursor-pointer active:scale-95">
                <Upload className="w-5 h-5" /> ব্যাকআপ আপলোড (JSON)
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
              </label>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-20 py-10 text-center border-t border-slate-200 dark:border-slate-800">
        <p className="text-slate-400 text-sm font-medium">Keep striving for excellence. Your medical career begins here. 🩺</p>
        <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-2">© 2025 MedPrep Tracker - All data stored locally on your device.</p>
      </footer>
    </div>
  );
};

export default App;
