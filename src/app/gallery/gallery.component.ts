import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CloudPhoto } from '../services/cloud-gallery.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  styleUrl: './gallery.component.css',
  template: `
    <div class="gallery-root">
      <div class="gallery-header">
        <h2>Галерея</h2>
        <button class="btn-back" (click)="back.emit()">← Назад</button>
      </div>

      @if (loading) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Завантаження фото…</p>
        </div>
      } @else if (!photos.length) {
        <div class="empty-state">
          <span class="empty-icon">🖼️</span>
          <p>Поки що немає фото</p>
          <small>Зробіть фото та збережіть — воно з'явиться тут для всіх</small>
        </div>
      } @else {
        <div class="grid">
          @for (photo of photos; track photo.id) {
            <div class="photo-card" (click)="openPhoto(photo)">
              <img
                [src]="photo.thumbnail_url || photo.public_url"
                [alt]="'Знімок від ' + photo.username"
                loading="lazy"
              />
              <div class="card-overlay">
                <div class="card-meta">
                  <span class="card-author">👤 {{ photo.username }}</span>
                  <span class="card-date">{{ getFormattedDate(photo.created_at) }}</span>
                </div>
                @if (photo.user_id === currentUserId) {
                  <div class="card-actions">
                    <button
                      class="card-btn danger"
                      (click)="onDelete($event, photo)"
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (hasMore) {
          <div class="load-more-row">
            <button class="btn-load-more" (click)="loadMore.emit()">Завантажити ще</button>
          </div>
        }
      }
    </div>

    <!-- Лайтбокс -->
    @if (lightboxPhoto()) {
      <div class="lightbox-backdrop" (click)="closePhoto()">
        <div class="lightbox-box" (click)="$event.stopPropagation()">
          <button class="lightbox-close" (click)="closePhoto()">✕</button>
          <img
            class="lightbox-img"
            [src]="lightboxPhoto()!.public_url"
            [alt]="'Знімок від ' + lightboxPhoto()!.username"
          />
          <div class="lightbox-footer">
            <span class="lightbox-meta">
              👤 {{ lightboxPhoto()!.username }} · {{ getFormattedDate(lightboxPhoto()!.created_at) }}
            </span>
            <div class="lightbox-actions">
              <button class="lightbox-btn" (click)="downloadPhoto(lightboxPhoto()!)">⬇️ Зберегти</button>
              @if (lightboxPhoto()!.user_id === currentUserId) {
                <button class="lightbox-btn danger" (click)="onDeleteFromLightbox(lightboxPhoto()!)">🗑️</button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class GalleryComponent {
  @Input() photos: CloudPhoto[] = [];
  @Input() currentUserId = '';
  @Input() loading = false;
  @Input() hasMore = false;

  @Output() back        = new EventEmitter<void>();
  @Output() deletePhoto = new EventEmitter<{ id: string; storagePath: string }>();
  @Output() loadMore    = new EventEmitter<void>();

  lightboxPhoto = signal<CloudPhoto | null>(null);

  private dateCache = new Map<string, string>();

  openPhoto(photo: CloudPhoto) {
    this.lightboxPhoto.set(photo);
  }

  closePhoto() {
    this.lightboxPhoto.set(null);
  }

  onDelete(event: Event, photo: CloudPhoto) {
    event.stopPropagation();
    this.deletePhoto.emit({ id: photo.id, storagePath: photo.storage_path });
  }

  onDeleteFromLightbox(photo: CloudPhoto) {
    this.deletePhoto.emit({ id: photo.id, storagePath: photo.storage_path });
    this.closePhoto();
  }

  getFormattedDate(iso: string): string {
    let formatted = this.dateCache.get(iso);
    if (!formatted) {
      formatted = new Date(iso).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      this.dateCache.set(iso, formatted);
    }
    return formatted;
  }

  downloadPhoto(photo: CloudPhoto) {
    const a = document.createElement('a');
    a.href = photo.public_url;
    a.download = `dragshot-${photo.id.slice(0, 8)}.jpg`;
    a.target = '_blank';
    a.click();
  }
}
