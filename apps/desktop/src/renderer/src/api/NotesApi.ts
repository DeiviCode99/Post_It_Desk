import type { BackendConfig } from '../../../shared/contracts';
import type { ChecklistItem, Note, NotePatch, Tag } from '../types';

/** Error HTTP con el mensaje que envía NestJS, para mostrarlo tal cual. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Cliente tipado del backend. Una instancia por sesión, creada con el token de Electron. */
export class NotesApi {
  constructor(private readonly config: BackendConfig) {}

  listNotes(): Promise<Note[]> {
    return this.request('GET', '/notes');
  }

  createNote(patch: NotePatch & { title: string }): Promise<Note> {
    return this.request('POST', '/notes', NotesApi.toPayload(patch));
  }

  updateNote(id: string, patch: NotePatch): Promise<Note> {
    return this.request('PATCH', `/notes/${id}`, NotesApi.toPayload(patch));
  }

  deleteNote(id: string): Promise<void> {
    return this.request('DELETE', `/notes/${id}`);
  }

  listTags(): Promise<Tag[]> {
    return this.request('GET', '/tags');
  }

  createTag(name: string, color: string): Promise<Tag> {
    return this.request('POST', '/tags', { name, color });
  }

  /**
   * Deja en cada subtarea solo los campos que acepta la API. Las subtareas
   * que devuelve el servidor traen además createdAt, updatedAt y position, y
   * el backend rechaza cualquier campo desconocido.
   */
  private static toPayload<T extends NotePatch>(patch: T): T {
    if (!patch.checklist) return patch;
    const checklist = patch.checklist.map(
      ({ id, text, done }): ChecklistItem => (id ? { id, text, done } : { text, done }),
    );
    return { ...patch, checklist };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-token': this.config.token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = Array.isArray(payload.message) ? payload.message.join('. ') : payload.message;
      throw new ApiError(response.status, message ?? `Error ${response.status}`);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}
