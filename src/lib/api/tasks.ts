import type { Task, TaskSection } from "@/types/task";
import { request } from "@/lib/api/request";

export function fetchTaskSections(): Promise<TaskSection[]> {
  return request<TaskSection[]>("/task-sections");
}

export function createTaskSection(title: string): Promise<TaskSection> {
  return request<TaskSection>("/task-sections", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export type TaskSectionPatch = Partial<Pick<TaskSection, "title" | "color">>;

export function updateTaskSection(
  id: string,
  patch: TaskSectionPatch,
): Promise<TaskSection> {
  return request<TaskSection>(`/task-sections/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteTaskSection(id: string): Promise<void> {
  return request<void>(`/task-sections/${id}`, { method: "DELETE" });
}

export function fetchTasks(): Promise<Task[]> {
  return request<Task[]>("/tasks");
}

export function createTask(sectionId: string, title: string): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify({ sectionId, title }),
  });
}

export type TaskPatch = Partial<
  Pick<Task, "title" | "blocks" | "sectionId" | "completed">
>;

export function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE" });
}
