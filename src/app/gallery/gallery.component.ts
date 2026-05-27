import { Component, EventEmitter, Input, Output } from '@angular/core';
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
            <div class="photo-card">
              <img [src]="photo.public_url" [alt]="'Знімок від ' + photo.username" loading="lazy" />
              <div class="card-overlay">
                <div class="card-meta">
                  <span class="card-author">👤 {{ photo.username }}</span>
                  <span class="card-date">{{ formatDate(photo.created_at) }}</span>
                </div>
                <div class="card-actions">
                  <button class="card-btn" (click)="downloadPhoto(photo)" title="Завантажити">
                    ⬇️
                  </button>
                  @if (photo.user_id === currentUserId) {
                    <button
                      class="card-btn danger"
                      (click)="deletePhoto.emit({ id: photo.id, storagePath: photo.storage_path })"
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  }
                </div>
              </div>
              @if (photo.user_id === currentUserId) {
                <div class="own-badge" title="Ваше фото">Моє</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class GalleryComponent {
  @Input() photos: CloudPhoto[] = [];
  @Input() currentUserId = '';
  @Input() loading = false;

  @Output() back        = new EventEmitter<void>();
  @Output() deletePhoto = new EventEmitter<{ id: string; storagePath: string }>();

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  downloadPhoto(photo: CloudPhoto) {
    const a = document.createElement('a');
    a.href = photo.public_url;
    a.download = `dragshot-${photo.id.slice(0, 8)}.jpg`;
    a.target = '_blank';
    a.click();
  }
}
