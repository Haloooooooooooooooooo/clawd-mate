import type { SubTask } from '../../types/task';

interface SubtaskListProps {
  subTasks: SubTask[];
  onComplete: (subTaskId: string) => void;
  onSkip: (subTaskId: string) => void;
}

export function SubtaskList({ subTasks, onComplete, onSkip }: SubtaskListProps) {
  return (
    <div className="space-y-1.5">
      {subTasks.map((subTask) => {
        const isCurrent = subTask.status === 'active';
        const isDone = subTask.status === 'completed';
        const isSkipped = subTask.status === 'skipped';

        return (
          <div
            key={subTask.id}
            className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isDone ? 'bg-emerald-400' : isCurrent ? 'bg-blue-400' : isSkipped ? 'bg-white/25' : 'bg-white/35'
                }`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  isDone || isSkipped ? 'text-white/45 line-through' : 'text-white/85'
                }`}
              >
                {subTask.title}
              </span>
              <span className="text-[11px] text-white/45">
                {isDone ? '已完成' : isCurrent ? '进行中' : isSkipped ? '已跳过' : '待开始'}
              </span>
            </div>

            {isCurrent && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onSkip(subTask.id)}
                  className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/14"
                >
                  跳过
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(subTask.id)}
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-400"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
