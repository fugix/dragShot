import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SavedPhoto } from '../services/storage.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
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
  styles: [
    `
      .gallery-root {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .gallery-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        flex-shrink: 0;
      }

      h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #e2e8f0;
      }

      .btn-back {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        color: #94a3b8;
        padding: 0.4rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.15s;
      }

      .btn-back:hover { background: rgba(255,255,255,0.12); color: #cbd5e1; }

      .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: #475569;
      }

      .empty-icon { font-size: 3.5rem; opacity: 0.5; }

      .empty-state p { font-size: 1rem; margin: 0; color: #64748b; }
      .empty-state small { font-size: 0.8rem; color: #475569; }

      .grid {
        flex: 1;
        overflow-y: auto;
        padding: 1.25rem;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        align-content: start;
      }

      .photo-card {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        aspect-ratio: 4/3;
        background: #0d0d14;
        border: 1px solid rgba(255,255,255,0.06);
        transition: transform 0.2s;
      }

      .photo-card:hover { transform: scale(1.02); }
      .photo-card:hover .card-overlay { opacity: 1; }

      .photo-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .card-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%);
        opacity: 0;
        transition: opacity 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 0.6rem;
        gap: 0.3rem;
      }

      .card-date {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.6);
      }

      .card-actions {
        display: flex;
        gap: 0.4rem;
      }

      .card-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        border-radius: 6px;
        padding: 0.3rem 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background 0.15s;
        backdrop-filter: blur(4px);
      }

      .card-btn:hover { background: rgba(255,255,255,0.25); }
      .card-btn.danger:hover { background: rgba(239,68,68,0.4); }
    `,
  ],
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