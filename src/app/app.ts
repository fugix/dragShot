import { Component, OnInit, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { CameraComponent } from './camera/camera.component';
import { EditorComponent } from './editor/editor.component';
import { GalleryComponent } from './gallery/gallery.component';
import { CloudGalleryService } from './services/cloud-gallery.service';

type View = 'camera' | 'editor' | 'gallery';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CameraComponent, EditorComponent, GalleryComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly cloudGallery = inject(CloudGalleryService);
  private swUpdate      = inject(SwUpdate);

  view            = signal<View>('camera');
  currentPhoto    = signal('');
  updateAvailable = signal(false);

  // Проксі до сигналів сервісу
  get photos()    { return this.cloudGallery.photos; }
  get uploading() { return this.cloudGallery.uploading; }

  async ngOnInit() {
    await this.cloudGallery.loadPhotos();
    this.cloudGallery.subscribeRealtime();
    this.watchForUpdates();
  }

  private watchForUpdates() {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
    ).subscribe(() => this.updateAvailable.set(true));
  }

  activateUpdate() {
    this.swUpdate.activateUpdate().then(() => location.reload());
  }

  onPhotoCaptured(dataUrl: string) {
    this.currentPhoto.set(dataUrl);
    this.view.set('editor');
  }

  async onPhotoSaved(dataUrl: string) {
    await this.cloudGallery.uploadPhoto(dataUrl);
  }

  onDeletePhoto(event: { id: string; storagePath: string }) {
    this.cloudGallery.deletePhoto(event.id, event.storagePath);
  }

  goToCamera() {
    this.currentPhoto.set('');
    this.view.set('camera');
  }

  goToGallery() {
    this.view.set('gallery');
    if (!this.cloudGallery.photos().length) {
      this.cloudGallery.loadPhotos();
    }
  }
}
