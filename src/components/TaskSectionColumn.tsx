import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { Task, TaskSection } from "@/types/task";
import { TaskCard } from "@/components/TaskCard";
import { CustomColorSwatch } from "@/components/CustomColorSwatch";
import { PlusIcon, TrashIcon } from "@/components/icons";

type Props = {
  section: TaskSection;
  isFirst: boolean;
  isLast: boolean;
  tasks: Task[];
  mediaItems: MediaItem[];
  onRename: (title: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onAddTask: (title: string) => Promise<unknown>;
  onOpenTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onMoveTask: (taskId: string, direction: -1 | 1) => void;
  onDropTask: (taskId: string) => void;
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
};

/** One board column: a colored header, a vertically scrolling list of task cards, and an
 * always-visible "add task" footer. Accepts task cards dropped from any other column. */
export function TaskSectionColumn({
  section,
  isFirst,
  isLast,
  tasks,
  mediaItems,
  onRename,
  onColorChange,
  onDelete,
  onAddTask,
  onOpenTask,
  onDeleteTask,
  onMoveTask,
  onDropTask,
  onToggleTaskCompleted,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const submitTask = async () => {
    const title = newTitle.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    setNewTitle("");
    await onAddTask(title);
  };

  return (
    <section
      aria-label={section.title}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) onDropTask(taskId);
      }}
      className={`flex h-full w-[340px] shrink-0 flex-col transition ${dragOver ? "bg-accent/10" : "bg-neutral-100"}`}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-4 py-3.5 text-white"
        style={{ backgroundColor: section.color }}
      >
        {renaming ? (
          <input
            autoFocus
            defaultValue={section.title}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== section.title) onRename(title);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded bg-white/20 px-2 py-0.5 text-lg font-medium text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Rename section"
            className="min-w-0 flex-1 truncate text-left text-lg font-medium"
          >
            {section.title}
          </button>
        )}
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold">
          {tasks.length}
        </span>
        <CustomColorSwatch onChange={onColorChange} size="size-4" />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete section ${section.title}`}
          className="flex size-6 items-center justify-center rounded-full hover:bg-black/20"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-stone">
            No tasks yet
          </p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            mediaItems={mediaItems}
            onOpen={() => onOpenTask(task.id)}
            onMovePrev={isFirst ? null : () => onMoveTask(task.id, -1)}
            onMoveNext={isLast ? null : () => onMoveTask(task.id, 1)}
            onDelete={() => onDeleteTask(task.id)}
            onToggleCompleted={(completed) =>
              onToggleTaskCompleted(task.id, completed)
            }
          />
        ))}
      </div>

      <div className="shrink-0 p-2">
        {adding ? (
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => void submitTask().then(() => setAdding(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitTask();
              if (e.key === "Escape") {
                setNewTitle("");
                setAdding(false);
              }
            }}
            placeholder="Task title"
            className="w-full rounded-lg border border-accent bg-white px-3 py-2 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add task to ${section.title}`}
            className="mx-auto flex size-8 items-center justify-center rounded-full bg-white text-stone shadow-sm ring-1 ring-black/5 transition hover:text-accent"
          >
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>
    </section>
  );
}
