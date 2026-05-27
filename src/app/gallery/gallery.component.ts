import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SavedPhoto } from '../services/storage.service';

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

      @if (!photos.length) {
        <div class="empty-state">
          <span class="empty-icon">🖼️</span>
          <p>Немає збережених фото</p>
          <small>Зробіть фото та збережіть його з редактора</small>
        </div>
      } @else {
        <div class="grid">
          @for (photo of photos; track photo.id) {
            <div class="photo-card">
              <img [src]="photo.dataUrl" [alt]="'Знімок ' + photo.id" loading="lazy" />
              <div class="card-overlay">
                <span class="card-date">{{ formatDate(photo.savedAt) }}</span>
                <div class="card-actions">
                  <button class="card-btn" (click)="downloadPhoto(photo)" title="Завантажити">
                    ⬇️
                  </button>
                  <button class="card-btn danger" (click)="deletePhoto.emit(photo.id)" title="Видалити">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class GalleryComponent {
  @Input() photos: SavedPhoto[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() deletePhoto = new EventEmitter<string>();

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  downloadPhoto(photo: SavedPhoto) {
    const a = document.createElement('a');
    a.href = photo.dataUrl;
    a.download = `dragshot-${photo.id.slice(0, 8)}.jpg`;
    a.click();
  }
}