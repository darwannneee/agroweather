import type { FarmTask } from './farm-types';

export type TaskOperationalState =
  | 'not-started'
  | 'ready'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';

export function jakartaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${value.year}-${value.month}-${value.day}`;
}

export function deriveTaskOperationalState(task: FarmTask): TaskOperationalState {
  if (task.latestEvidence?.status === 'revision_requested') {
    return 'revision-needed';
  }
  if (task.latestEvidence?.status === 'pending') {
    return 'pending-review';
  }
  if (task.status === 'selesai' || task.latestEvidence?.status === 'accepted') {
    return 'completed';
  }

  return task.status === 'sedang_dikerjakan' ? 'ready' : 'not-started';
}

const stateRank: Record<TaskOperationalState, number> = {
  'revision-needed': 0,
  'not-started': 2,
  ready: 2,
  'pending-review': 3,
  completed: 4,
};

const priorityRank = {
  high: 0,
  medium: 1,
  low: 2,
} as const;

export function sortDailyTasks(tasks: FarmTask[]): FarmTask[] {
  return [...tasks].sort((a, b) => {
    const stateDifference =
      stateRank[deriveTaskOperationalState(a)] -
      stateRank[deriveTaskOperationalState(b)];

    return (
      stateDifference ||
      priorityRank[a.priority] - priorityRank[b.priority]
    );
  });
}
