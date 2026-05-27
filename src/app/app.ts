import { Component, inject, signal } from '@angular/core';
import { CameraComponent } from './camera/camera.component';
import { EditorComponent } from './editor/editor.component';
import { GalleryComponent } from './gallery/gallery.component';
import { StorageService } from './services/storage.service';

type View = 'camera' | 'editor' | 'gallery';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CameraComponent, EditorComponent, GalleryComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private storage = inject(StorageService);

  view = signal<View>('camera');
  currentPhoto = signal('');
  photos = signal(this.storage.getPhotos());

  onPhotoCaptured(dataUrl: string) {
    this.currentPhoto.set(dataUrl);
    this.view.set('editor');
  }

  onPhotoSaved(dataUrl: string) {
    this.storage.savePhoto(dataUrl);
    this.photos.set(this.storage.getPhotos());
  }

  onDeletePhoto(id: string) {
    this.storage.deletePhoto(id);
    this.photos.set(this.storage.getPhotos());
  }

  goToCamera() {
    this.currentPhoto.set('');
    this.view.set('camera');
  }

  goToGallery() {
    this.view.set('gallery');
  }
}