/** Modelos tal como los devuelve el backend (fechas en ISO 8601). */
export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id?: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  dueAt: string | null;
  remindAt: string | null;
  done: boolean;
  checklist: ChecklistItem[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** Cambios que se envían al backend; las etiquetas viajan como ids. */
export interface NotePatch {
  title?: string;
  body?: string;
  priority?: Priority;
  dueAt?: string | null;
  remindAt?: string | null;
  done?: boolean;
  checklist?: ChecklistItem[];
  tagIds?: string[];
}
