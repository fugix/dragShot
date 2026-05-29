import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserService } from './user.service';

export interface CloudPhoto {
  id: string;
  user_id: string;
  username: string;
  public_url: string;
  thumbnail_url?: string;
  storage_path: string;
  created_at: string;
}

export type RealtimeStatus = 'connecting' | 'live' | 'error';

const TABLE = 'photos';
const BUCKET = 'photos';
const PAGE_SIZE = 12;
const POLL_INTERVAL    = 5_000;
const MAX_RECONNECT_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class CloudGalleryService implements OnDestroy {
  private supabaseSvc = inject(SupabaseService);
  private user        = inject(UserService);

  private get db() { return this.supabaseSvc.client; }

  photos         = signal<CloudPhoto[]>([]);
  uploading      = signal(false);
  loading        = signal(false);
  hasMore        = signal(false);
  error          = signal('');
  realtimeStatus = signal<RealtimeStatus>('connecting');

  private offset         = 0;
  private channel:        ReturnType<typeof this.db.channel> | null = null;
  private reconnectDelay = 3_000;
  private reconnectTimer: ReturnType<typeof setTimeout>  | null = null;
  private pollTimer:      ReturnType<typeof setInterval> | null = null;

  // ── Завантажити першу сторінку ────────────────────────────────────────────
  async loadPhotos(): Promise<void> {
    if (!this.supabaseSvc.configured) return;
    this.loading.set(true);
    this.error.set('');
    this.offset = 0;

    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    this.loading.set(false);
    if (error) { this.error.set('Помилка завантаження: ' + error.message); return; }
    const list = (data ?? []) as CloudPhoto[];
    this.photos.set(list);
    this.hasMore.set(list.length === PAGE_SIZE);
  }

  // ── Дозавантажити наступну сторінку ───────────────────────────────────────
  async loadMore(): Promise<void> {
    if (!this.supabaseSvc.configured || !this.hasMore()) return;
    this.offset += PAGE_SIZE;

    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .range(this.offset, this.offset + PAGE_SIZE - 1);

    if (error || !data) return;
    const next = data as CloudPhoto[];
    this.photos.update(list => [...list, ...next]);
    this.hasMore.set(next.length === PAGE_SIZE);
  }

  // ── Завантажити фото в хмару ──────────────────────────────────────────────
  async uploadPhoto(dataUrl: string): Promise<void> {
    if (!this.supabaseSvc.configured) return;
    this.uploading.set(true);
    this.error.set('');

    try {
      const blob = this.dataUrlToBlob(dataUrl);
      const timestamp = Date.now();
      const storagePath = `${this.user.userId}/${timestamp}.jpg`;

      const { error: uploadErr } = await this.db.storage
        .from(BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = this.db.storage.from(BUCKET).getPublicUrl(storagePath);

      // Генеруємо мініатюру (необов'язково — не блокує збереження при помилці)
      let thumbnailUrl: string | null = null;
      try {
        const thumbBlob = await this.createThumbnail(dataUrl);
        const thumbPath = `${this.user.userId}/${timestamp}-thumb.jpg`;
        const { error: thumbErr } = await this.db.storage
          .from(BUCKET)
          .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: false });
        if (!thumbErr) {
          const { data: thumbUrlData } = this.db.storage.from(BUCKET).getPublicUrl(thumbPath);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      } catch { /* thumbnail is optional */ }

      const { data: inserted, error: insertErr } = await this.db
        .from(TABLE)
        .insert({
          user_id:       this.user.userId,
          username:      this.user.username,
          storage_path:  storagePath,
          public_url:    urlData.publicUrl,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

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

    // Видаляємо оригінал і мініатюру зі Storage
    const thumbPath = storagePath.replace(/\.jpg$/, '-thumb.jpg');
    await this.db.storage.from(BUCKET).remove([storagePath, thumbPath]);

    await this.db.from(TABLE).delete().eq('id', id);

    this.photos.update(list => list.filter(p => p.id !== id));
  }

  // ── Realtime-підписка на нові фото ────────────────────────────────────────
  subscribeRealtime(): void {
    if (!this.supabaseSvc.configured) return;

    this.realtimeStatus.set('connecting');
    this.startPolling();

    this.channel = this.db
      .channel('photos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLE },
        (payload) => {
          const newPhoto = payload.new as CloudPhoto;
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.realtimeStatus.set('live');
          this.reconnectDelay = 3_000;
          this.fetchMissedPhotos();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.realtimeStatus.set('error');
          this.scheduleReconnect();
        }
      });
  }

  // ── Підтягнути фото, що могли з'явитись під час розриву ──────────────────
  private async fetchMissedPhotos(): Promise<void> {
    const latest = this.photos()[0];
    if (!latest) return;
    const { data } = await this.db
      .from(TABLE)
      .select('*')
      .gt('created_at', latest.created_at)
      .order('created_at', { ascending: false });
    if (!data?.length) return;
    const missed = (data as CloudPhoto[]).filter(p => !this.photos().some(e => e.id === p.id));
    if (missed.length) this.photos.update(list => [...missed, ...list]);
  }

  // ── Синхронізувати видалення: прибрати локальні фото яких більше нема в БД ─
  private async syncDeletions(): Promise<void> {
    const current = this.photos();
    if (!current.length) return;
    const { data } = await this.db
      .from(TABLE)
      .select('id')
      .in('id', current.map(p => p.id));
    if (!data) return;
    const existingIds = new Set((data as { id: string }[]).map(p => p.id));
    if (current.some(p => !existingIds.has(p.id))) {
      this.photos.update(list => list.filter(p => existingIds.has(p.id)));
    }
  }

  // ── Exponential backoff reconnect ─────────────────────────────────────────
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.channel) { this.db.removeChannel(this.channel); this.channel = null; }
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
      this.subscribeRealtime();
    }, this.reconnectDelay);
  }

  // ── Polling-fallback (завжди, як страховка від пропущених подій) ─────────
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.fetchMissedPhotos();
      this.syncDeletions();
    }, POLL_INTERVAL);
  }

  private stopPolling(): void {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // ── Генерація мініатюри ───────────────────────────────────────────────────
  private createThumbnail(dataUrl: string, maxW = 320, quality = 0.65): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error('toBlob failed')),
          'image/jpeg',
          quality,
        );
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPolling();
  }
}
