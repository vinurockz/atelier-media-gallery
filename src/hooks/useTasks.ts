import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskSection } from "@/types/task";
import {
  createTask,
  createTaskSection,
  deleteTask,
  deleteTaskSection,
  fetchTaskSections,
  fetchTasks,
  updateTask,
  updateTaskSection,
  type TaskPatch,
  type TaskSectionPatch,
} from "@/lib/api/tasks";

const SAVE_DEBOUNCE_MS = 600;

/** Task board (sections + tasks), backed by the Node API in `server/`. Structural changes
 * (create/delete/move) go to the server first; text edits update local state immediately
 * and save on a short per-task debounce, like Notes. */
export function useTasks() {
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, TaskPatch>>(new Map());

  useEffect(() => {
    Promise.all([fetchTaskSections(), fetchTasks()])
      .then(([s, t]) => {
        setSections(s);
        setTasks(t);
      })
      .catch(() => {
        // No backend reachable yet — the board just stays empty until it is.
      });
  }, []);

  const addSection = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const section = await createTaskSection(trimmed);
    setSections((prev) => [...prev, section]);
  }, []);

  const patchSection = useCallback(
    async (id: string, patch: TaskSectionPatch) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      await updateTaskSection(id, patch).catch(() => {});
    },
    [],
  );

  const removeSection = useCallback(async (id: string) => {
    await deleteTaskSection(id);
    setSections((prev) => prev.filter((s) => s.id !== id));
    setTasks((prev) => prev.filter((t) => t.sectionId !== id));
  }, []);

  const addTask = useCallback(async (sectionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const task = await createTask(sectionId, trimmed);
    setTasks((prev) => [...prev, task]);
    return task.id;
  }, []);

  const flushTask = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateTask(id, patch).catch(() => {});
  }, []);

  const patchTask = useCallback(
    (id: string, patch: TaskPatch) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
        ),
      );
      pendingPatches.current.set(id, {
        ...pendingPatches.current.get(id),
        ...patch,
      });
      const timer = saveTimers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      saveTimers.current.set(
        id,
        window.setTimeout(() => flushTask(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushTask],
  );

  const moveTask = useCallback(
    async (id: string, sectionId: string) => {
      flushTask(id);
      // Server moves it to the end of the target section; mirror that locally.
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (!task || task.sectionId === sectionId) return prev;
        return [...prev.filter((t) => t.id !== id), { ...task, sectionId }];
      });
      await updateTask(id, { sectionId }).catch(() => {});
    },
    [flushTask],
  );

  const removeTask = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    sections,
    tasks,
    addSection,
    patchSection,
    removeSection,
    addTask,
    patchTask,
    flushTask,
    moveTask,
    removeTask,
  };
}
