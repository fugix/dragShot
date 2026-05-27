import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserService } from './user.service';

export interface CloudPhoto {
  id: string;
  user_id: string;
  username: string;
  public_url: string;
  storage_path: string;
  created_at: string;
}

const TABLE = 'photos';
const BUCKET = 'photos';

@Injectable({ providedIn: 'root' })
export class CloudGalleryService implements OnDestroy {
  private supabaseSvc = inject(SupabaseService);
  private user        = inject(UserService);

  private get db() { return this.supabaseSvc.client; }

  photos    = signal<CloudPhoto[]>([]);
  uploading = signal(false);
  loading   = signal(false);
  error     = signal('');

  private channel: ReturnType<typeof this.db.channel> | null = null;

  // ── Завантажити всі фото ──────────────────────────────────────────────────
  async loadPhotos(): Promise<void> {
    if (!this.supabaseSvc.configured) return;
    this.loading.set(true);
    this.error.set('');

    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    this.loading.set(false);
    if (error) { this.error.set('Помилка завантаження: ' + error.message); return; }
    this.photos.set(data as CloudPhoto[]);
  }

  // ── Завантажити фото в хмару ──────────────────────────────────────────────
  async uploadPhoto(dataUrl: string): Promise<void> {
    if (!this.supabaseSvc.configured) return;
    this.uploading.set(true);
    this.error.set('');

    try {
      // 1. Конвертуємо base64 → Blob
      const blob = this.dataUrlToBlob(dataUrl);
      const storagePath = `${this.user.userId}/${Date.now()}.jpg`;

      // 2. Завантажуємо файл у Storage
      const { error: uploadErr } = await this.db.storage
        .from(BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      // 3. Отримуємо публічний URL
      const { data: urlData } = this.db.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      // 4. Зберігаємо метадані в таблицю та повертаємо вставлений рядок
      const { data: inserted, error: insertErr } = await this.db
        .from(TABLE)
        .insert({
          user_id:      this.user.userId,
          username:     this.user.username,
          storage_path: storagePath,
          public_url:   urlData.publicUrl,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      // 5. Одразу оновлюємо локальний список (не чекаємо Realtime)
      if (inserted) {
        this.photos.update(list => [inserted as CloudPhoto, ...list]);
      }
    } catch (e: any) {
      this.error.set('Помилка збереження: ' + (e?.message ?? e));
    } finally {
      this.uploading.set(false);
    }
  }

  // ── Видалити фото ─────────────────────────────────────────────────────────
  async deletePhoto(id: string, storagePath: string): Promise<void> {
    if (!this.supabaseSvc.configured) return;

    // Видалити файл зі Storage
    await this.db.storage.from(BUCKET).remove([storagePath]);

    // Видалити рядок з таблиці
    await this.db.from(TABLE).delete().eq('id', id);

    // Оновити локальний список
    this.photos.update(list => list.filter(p => p.id !== id));
  }

  // ── Realtime-підписка на нові фото ────────────────────────────────────────
  subscribeRealtime(): void {
    if (!this.supabaseSvc.configured) return;

    this.channel = this.db
      .channel('photos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLE },
        (payload) => {
          const newPhoto = payload.new as CloudPhoto;
          // Уникаємо дублювань (своє фото вже є через uploadPhoto)
          this.photos.update(list =>
            list.some(p => p.id === newPhoto.id) ? list : [newPhoto, ...list]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: TABLE },
        (payload) => {
          const deletedId = (payload.old as CloudPhoto).id;
          this.photos.update(list => list.filter(p => p.id !== deletedId));
        }
      )
      .subscribe();
  }

  // ── Конвертація ───────────────────────────────────────────────────────────
  private dataUrlToBlob(dataUrl: string): Blob {
    const [, b64] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: 'image/jpeg' });
  }

  get currentUserId(): string {
    return this.user.userId;
  }

  get currentUsername(): string {
    return this.user.username;
  }

  ngOnDestroy(): void {
    if (this.channel) this.db.removeChannel(this.channel);
  }
}
