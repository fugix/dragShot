import { Injectable } from '@angular/core';

export interface SavedPhoto {
  id: string;
  dataUrl: string;
  savedAt: number;
}

export interface SavedFragment {
  id: string;
  dataUrl: string;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly KEY = 'dragshot_photos';
  private readonly FRAGMENTS_KEY = 'dragshot_fragments';

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

  getFragments(): SavedFragment[] {
    try {
      const data = localStorage.getItem(this.FRAGMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveFragment(dataUrl: string): SavedFragment {
    const fragment: SavedFragment = {
      id: crypto.randomUUID(),
      dataUrl,
      savedAt: Date.now(),
    };
    const fragments = this.getFragments();
    fragments.unshift(fragment);
    localStorage.setItem(this.FRAGMENTS_KEY, JSON.stringify(fragments));
    return fragment;
  }

  deleteFragment(id: string): void {
    const fragments = this.getFragments().filter((f) => f.id !== id);
    localStorage.setItem(this.FRAGMENTS_KEY, JSON.stringify(fragments));
  }
}