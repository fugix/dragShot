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

        @if (error()) {
          <div class="camera-error">
            <span class="error-icon">📷</span>
            <p>{{ error() }}</p>
          </div>
        }

        @if (!cameraStarted() && !error()) {
          <div class="camera-loading">
            <div class="spinner"></div>
            <p>Запрос камеры…</p>
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
            Снять фото
          </button>
        } @else {
          <button class="btn btn-secondary" (click)="retake()">
            <span class="btn-icon">🔄</span>
            Переснять
          </button>
          <button class="btn btn-primary" (click)="usePhoto()">
            <span class="btn-icon">✓</span>
            Редактировать
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .camera-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        width: 100%;
      }

      .preview-area {
        position: relative;
        width: 100%;
        max-width: 640px;
        aspect-ratio: 4/3;
        background: #0d0d14;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      video,
      canvas {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .camera-error,
      .camera-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        color: #94a3b8;
        font-size: 0.875rem;
      }

      .error-icon {
        font-size: 3rem;
        opacity: 0.5;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(124, 58, 237, 0.3);
        border-top-color: #7c3aed;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .camera-controls {
        display: flex;
        gap: 1rem;
      }

      .btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.75rem;
        border-radius: 50px;
        border: none;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-capture {
        background: linear-gradient(135deg, #7c3aed, #ec4899);
        color: #fff;
        font-size: 1.1rem;
        padding: 0.9rem 2.5rem;
        box-shadow: 0 4px 24px rgba(124, 58, 237, 0.4);
      }

      .btn-capture:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 30px rgba(124, 58, 237, 0.55);
      }

      .btn-primary {
        background: linear-gradient(135deg, #7c3aed, #ec4899);
        color: #fff;
        box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
      }

      .btn-primary:hover {
        transform: translateY(-1px);
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.14);
      }
    `,
  ],
})
export class CameraComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @Output() photoCaptured = new EventEmitter<string>();

  photoTaken = signal(false);
  cameraStarted = signal(false);
  error = signal('');

  private stream: MediaStream | null = null;

  async ngAfterViewInit() {
    await this.startCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      this.videoEl.nativeElement.srcObject = this.stream;
      await this.videoEl.nativeElement.play();
      this.cameraStarted.set(true);
    } catch (e: any) {
      this.error.set('Нет доступа к камере: ' + (e?.message ?? e));
    }
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