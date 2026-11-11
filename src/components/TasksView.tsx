import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { Task, TaskSection } from "@/types/task";
import type { TaskPatch } from "@/lib/api/tasks";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { TaskSectionColumn } from "@/components/TaskSectionColumn";
import { TaskEditor } from "@/components/TaskEditor";
import { PlusIcon, TaskBoardIcon } from "@/components/icons";

type Props = {
  sections: TaskSection[];
  tasks: Task[];
  mediaItems: MediaItem[];
  onAddSection: (title: string) => Promise<void>;
  onPatchSection: (
    id: string,
    patch: { title?: string; color?: string },
  ) => Promise<void>;
  onRemoveSection: (id: string) => Promise<void>;
  onAddTask: (sectionId: string, title: string) => Promise<string | null>;
  onPatchTask: (id: string, patch: TaskPatch) => void;
  onFlushTask: (id: string) => void;
  onMoveTask: (id: string, sectionId: string) => Promise<void>;
  onRemoveTask: (id: string) => Promise<void>;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** Kanban-style board: sections scroll horizontally as a row, tasks scroll vertically
 * inside each section. */
export function TasksView({
  sections,
  tasks,
  mediaItems,
  onAddSection,
  onPatchSection,
  onRemoveSection,
  onAddTask,
  onPatchTask,
  onFlushTask,
  onMoveTask,
  onRemoveTask,
  onImportFiles,
}: Props) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");

  const submitSection = async () => {
    const title = sectionTitle.trim();
    setSectionTitle("");
    setAddingSection(false);
    if (title) await onAddSection(title);
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    if (openTaskId === id) setOpenTaskId(null);
    void onRemoveTask(id);
  };

  const deleteSection = (section: TaskSection, count: number) => {
    const message =
      count > 0
        ? `Delete "${section.title}" and its ${count} ${count === 1 ? "task" : "tasks"}?`
        : `Delete "${section.title}"?`;
    if (!window.confirm(message)) return;
    void onRemoveSection(section.id);
  };

  const moveByDirection = (
    taskId: string,
    fromIndex: number,
    direction: -1 | 1,
  ) => {
    const target = sections[fromIndex + direction];
    if (target) void onMoveTask(taskId, target.id);
  };

  // A discrete click, not continuous typing — flush right away instead of
  // waiting out the debounce useTasks uses for text edits.
  const toggleTaskCompleted = (taskId: string, completed: boolean) => {
    onPatchTask(taskId, { completed });
    onFlushTask(taskId);
  };

  const closeEditor = () => {
    if (openTaskId) onFlushTask(openTaskId);
    setOpenTaskId(null);
  };

  const openTask = openTaskId
    ? (tasks.find((t) => t.id === openTaskId) ?? null)
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <TaskBoardIcon className="size-4 text-stone" />
        <h1 className="text-base font-medium text-ink">Tasks</h1>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-neutral-100">
        {sections.map((section, index) => {
          const sectionTasks = tasks.filter((t) => t.sectionId === section.id);
          return (
            <TaskSectionColumn
              key={section.id}
              section={section}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              tasks={sectionTasks}
              mediaItems={mediaItems}
              onRename={(title) => void onPatchSection(section.id, { title })}
              onColorChange={(color) =>
                void onPatchSection(section.id, { color })
              }
              onDelete={() => deleteSection(section, sectionTasks.length)}
              onAddTask={(title) => onAddTask(section.id, title)}
              onOpenTask={setOpenTaskId}
              onDeleteTask={deleteTask}
              onMoveTask={(taskId, direction) =>
                moveByDirection(taskId, index, direction)
              }
              onDropTask={(taskId) => void onMoveTask(taskId, section.id)}
              onToggleTaskCompleted={toggleTaskCompleted}
            />
          );
        })}

        <div className="flex h-full w-[340px] shrink-0 flex-col bg-neutral-50">
          <div className="flex shrink-0 items-center border-b border-linen bg-white px-4 py-3.5">
            {addingSection ? (
              <input
                autoFocus
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                onBlur={() => void submitSection()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setSectionTitle("");
                    setAddingSection(false);
                  }
                }}
                placeholder="Section name"
                className="w-full rounded border border-accent px-2 py-1 text-sm outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingSection(true)}
                className="flex items-center gap-2 text-sm font-medium text-accent"
              >
                <PlusIcon className="size-4" />
                Add section
              </button>
            )}
          </div>
          {sections.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-stone">
              No sections yet. Add one to start organizing tasks.
            </p>
          )}
        </div>
      </div>

      {openTask && (
        <TaskEditor
          task={openTask}
          sections={sections}
          mediaItems={mediaItems}
          onPatch={(patch) => onPatchTask(openTask.id, patch)}
          onMove={(sectionId) => void onMoveTask(openTask.id, sectionId)}
          onClose={closeEditor}
          onDelete={() => deleteTask(openTask.id)}
          onImportFiles={onImportFiles}
        />
      )}
    </div>
  );
}
