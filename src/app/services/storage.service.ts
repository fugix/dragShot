import { Injectable } from '@angular/core';

export interface SavedPhoto {
  id: string;
  dataUrl: string;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly KEY = 'dragshot_photos';

  getPhotos(): SavedPhoto[] {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  savePhoto(dataUrl: string): SavedPhoto {
    const photo: SavedPhoto = {
      id: crypto.randomUUID(),
      dataUrl,
      savedAt: Date.now(),
    };
    const photos = this.getPhotos();
    photos.unshift(photo);
    localStorage.setItem(this.KEY, JSON.stringify(photos));
    return photo;
  }

  deletePhoto(id: string): void {
    const photos = this.getPhotos().filter((p) => p.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(photos));
  }
}