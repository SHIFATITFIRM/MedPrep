
export interface Task {
  id: string;
  label: string;
}

export interface Chapter {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  chapters: Chapter[];
}

export type Priority = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ChapterMeta {
  priority: Priority;
  difficulty: Difficulty;
  timeSpent: number; // in seconds
  scheduledDate: string | null; // ISO date string "YYYY-MM-DD"
}

export type TaskStatus = {
  [taskId: string]: boolean;
};

export type ChapterProgress = {
  tasks: TaskStatus;
  meta: ChapterMeta;
};

export type SubjectProgress = {
  [chapterId: string]: ChapterProgress;
};

export interface UserGoals {
  dailyTaskGoal: number;
  targetDate: string;
}

export interface Reminder {
  id: string;
  subjectId?: string;
  time: string; // "HH:mm"
  enabled: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  color: string;
}

export interface StudyData {
  progress: { [subjectId: string]: SubjectProgress };
  streak: {
    count: number;
    lastActivityDate: string | null;
  };
  goals: UserGoals;
  theme: 'light' | 'dark';
  reminders: Reminder[];
  unlockedAchievements: string[]; // List of IDs
}

export interface SubjectStats {
  subjectId: string;
  name: string;
  percentage: number;
  color: string;
  totalTime: number;
}
