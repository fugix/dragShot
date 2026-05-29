import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-camera',
  standalone: true,
  styleUrl: './camera.component.css',
  template: `
    <div class="camera-wrapper">
      <div class="preview-area">
        <video
          #videoEl
          autoplay
          playsinline
          muted
          [style.display]="photoTaken() ? 'none' : 'block'"
        ></video>
        <canvas
          #canvasEl
          [style.display]="photoTaken() ? 'block' : 'none'"
        ></canvas>

        @if (cameras().length > 1 && !photoTaken()) {
          <button
            class="btn-switch-camera"
            [disabled]="!cameraStarted()"
            (click)="switchCamera()"
            title="Перемкнути камеру"
          >
            🔄
          </button>
        }

        @if (error()) {
          <div class="camera-error">
            <span class="error-icon">📷</span>
            <p>{{ error() }}</p>
          </div>
        }

        @if (!cameraStarted() && !error()) {
          <div class="camera-loading">
            <div class="spinner"></div>
            <p>Ініціалізація камери…</p>
          </div>
        }
      </div>

      <div class="camera-controls">
        @if (!photoTaken()) {
          <button
            class="btn btn-capture"
            [disabled]="!cameraStarted()"
            (click)="capturePhoto()"
          >
            <span class="btn-icon">📷</span>
            Зробити фото
          </button>
        } @else {
          <button class="btn btn-secondary" (click)="retake()">
            <span class="btn-icon">🔄</span>
            Перезняти
          </button>
          <button class="btn btn-primary" (click)="usePhoto()">
            <span class="btn-icon">✓</span>
            Редагувати
          </button>
        }
      </div>
    </div>
  `,
})
export class CameraComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @Output() photoCaptured = new EventEmitter<string>();

  photoTaken = signal(false);
  cameraStarted = signal(false);
  error = signal('');
  cameras = signal<MediaDeviceInfo[]>([]);

  private stream: MediaStream | null = null;
  private currentCameraIndex = 0;

  async ngAfterViewInit() {
    await this.startCamera();
  }

  async startCamera(deviceId?: string) {
    try {
      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } };

      this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      this.videoEl.nativeElement.srcObject = this.stream;
      await this.videoEl.nativeElement.play();
      this.cameraStarted.set(true);

      if (this.cameras().length === 0) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.cameras.set(devices.filter((d) => d.kind === 'videoinput'));
      }
    } catch (e: any) {
      this.error.set('Немає доступу до камери: ' + (e?.message ?? e));
    }
  }

  async switchCamera() {
    const cams = this.cameras();
    if (cams.length <= 1) return;
    this.currentCameraIndex = (this.currentCameraIndex + 1) % cams.length;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraStarted.set(false);
    await this.startCamera(cams[this.currentCameraIndex].deviceId);
  }

  capturePhoto() {
    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    this.photoTaken.set(true);
  }

  retake() {
    this.photoTaken.set(false);
  }

  usePhoto() {
    this.photoCaptured.emit(this.canvasEl.nativeElement.toDataURL('image/jpeg', 0.92));
  }

  ngOnDestroy() {
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}