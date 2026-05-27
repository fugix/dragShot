import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

export type Tool = 'move' | 'select';

interface BaseLayer {
  id: string;
  x: number;
  y: number;
}

interface EmojiLayer extends BaseLayer {
  type: 'emoji';
  emoji: string;
  size: number;
}

interface FragmentLayer extends BaseLayer {
  type: 'fragment';
  offscreen: HTMLCanvasElement;
  width: number;
  height: number;
}

type Layer = EmojiLayer | FragmentLayer;

const EMOJIS = [
  '😀','😂','🥰','😎','🤩','🥳','😜','🤔','😱','🤯',
  '👍','👏','🙌','✌️','🤞','🫶','💪','🎉','🎊','🔥',
  '💥','⭐','🌈','❤️','💜','💚','🍕','🎸','🚀','🌸',
];

@Component({
  selector: 'app-editor',
  standalone: true,
  template: `
    <div class="editor-root">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="tool-group">
          <button
            class="tool-btn"
            [class.active]="activeTool() === 'move'"
            (click)="setTool('move')"
            title="Перемещение (M)"
          >
            <span>✋</span> Двигать
          </button>
          <button
            class="tool-btn"
            [class.active]="activeTool() === 'select'"
            (click)="setTool('select')"
            title="Выделение (S)"
          >
            <span>⬚</span> Выделить
          </button>
        </div>
        <div class="tool-sep"></div>
        <div class="tool-group">
          @if (layers().length) {
            <button class="tool-btn danger" (click)="clearLayers()" title="Очистить слои">
              🗑 Очистить
            </button>
          }
          <button class="tool-btn save" (click)="saveToGallery()" title="Сохранить">
            💾 Сохранить
          </button>
          <button class="tool-btn secondary" (click)="back.emit()" title="Назад">
            ← Назад
          </button>
        </div>
      </div>

      <div class="workspace">
        <!-- Emoji palette -->
        <div class="emoji-panel">
          <div class="panel-title">Эмодзи</div>
          <div class="emoji-grid">
            @for (e of emojis; track e) {
              <button
                class="emoji-btn"
                [class.selected]="selectedEmoji() === e"
                (click)="selectEmoji(e)"
                title="Добавить {{ e }}"
              >{{ e }}</button>
            }
          </div>
          @if (selectedEmoji()) {
            <div class="panel-hint">
              Кликните на фото чтобы разместить {{ selectedEmoji() }}
            </div>
          }
        </div>

        <!-- Canvas area -->
        <div class="canvas-wrapper" #wrapperEl>
          <canvas
            #canvasEl
            [style.cursor]="canvasCursor()"
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp($event)"
            (mouseleave)="onMouseUp($event)"
          ></canvas>
        </div>
      </div>

      @if (savedFlash()) {
        <div class="save-toast">✅ Фото сохранено в галерею!</div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; width: 100%; height: 100%; }

      .editor-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 0;
      }

      /* ── Toolbar ── */
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: #13131d;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        flex-shrink: 0;
        flex-wrap: wrap;
      }

      .tool-group {
        display: flex;
        gap: 0.4rem;
      }

      .tool-sep {
        flex: 1;
      }

      .tool-btn {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: #cbd5e1;
        font-size: 0.82rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }

      .tool-btn:hover { background: rgba(255,255,255,0.1); }
      .tool-btn.active {
        background: rgba(124,58,237,0.25);
        border-color: rgba(124,58,237,0.6);
        color: #c4b5fd;
      }

      .tool-btn.save {
        background: rgba(124,58,237,0.2);
        border-color: rgba(124,58,237,0.4);
        color: #c4b5fd;
      }
      .tool-btn.save:hover { background: rgba(124,58,237,0.35); }

      .tool-btn.danger {
        color: #fca5a5;
        border-color: rgba(239,68,68,0.3);
      }
      .tool-btn.danger:hover { background: rgba(239,68,68,0.15); }

      .tool-btn.secondary { color: #94a3b8; }

      /* ── Workspace ── */
      .workspace {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      /* ── Emoji panel ── */
      .emoji-panel {
        width: 200px;
        flex-shrink: 0;
        background: #13131d;
        border-right: 1px solid rgba(255,255,255,0.07);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
      }

      .panel-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
      }

      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
      }

      .emoji-btn {
        aspect-ratio: 1;
        border-radius: 8px;
        border: 1px solid transparent;
        background: rgba(255,255,255,0.04);
        font-size: 1.25rem;
        cursor: pointer;
        transition: all 0.12s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .emoji-btn:hover {
        background: rgba(255,255,255,0.1);
        transform: scale(1.15);
      }

      .emoji-btn.selected {
        border-color: rgba(124,58,237,0.7);
        background: rgba(124,58,237,0.2);
      }

      .panel-hint {
        font-size: 0.72rem;
        color: #64748b;
        line-height: 1.4;
        background: rgba(255,255,255,0.03);
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.06);
      }

      /* ── Canvas ── */
      .canvas-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: #0a0a10;
        overflow: auto;
        min-width: 0;
      }

      canvas {
        display: block;
        max-width: 100%;
        max-height: 100%;
        border-radius: 8px;
        box-shadow: 0 8px 48px rgba(0,0,0,0.6);
        user-select: none;
        -webkit-user-select: none;
      }

      /* ── Toast ── */
      .save-toast {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(16, 185, 129, 0.9);
        color: #fff;
        padding: 0.75rem 1.75rem;
        border-radius: 50px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        animation: fadeUp 0.3s ease, fadeOut 0.4s 2s ease forwards;
        pointer-events: none;
        z-index: 100;
      }

      @keyframes fadeUp {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      @keyframes fadeOut {
        to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
      }
    `,
  ],
})
export class EditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() photoDataUrl = '';
  @Output() back = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();

  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapperEl') wrapperRef!: ElementRef<HTMLDivElement>;

  readonly emojis = EMOJIS;

  activeTool = signal<Tool>('move');
  selectedEmoji = signal('');
  layers = signal<Layer[]>([]);
  savedFlash = signal(false);
  canvasCursor = signal('default');

  private photo: HTMLImageElement | null = null;
  private ctx!: CanvasRenderingContext2D;

  // Drag state
  private dragLayerId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Selection state
  private isSelecting = false;
  private selStartX = 0;
  private selStartY = 0;
  private selEndX = 0;
  private selEndY = 0;

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    if (this.photoDataUrl) this.loadPhoto();
  }

  ngOnChanges() {
    if (this.ctx && this.photoDataUrl) this.loadPhoto();
  }

  private loadPhoto() {
    const img = new Image();
    img.onload = () => {
      this.photo = img;
      const canvas = this.canvasRef.nativeElement;
      canvas.width = img.width;
      canvas.height = img.height;
      this.render();
    };
    img.src = this.photoDataUrl;
  }

  setTool(t: Tool) {
    this.activeTool.set(t);
    if (t !== 'move') this.selectedEmoji.set('');
    this.updateCursor();
  }

  selectEmoji(e: string) {
    this.selectedEmoji.set(this.selectedEmoji() === e ? '' : e);
    if (this.selectedEmoji()) this.activeTool.set('move');
  }

  private updateCursor() {
    const tool = this.activeTool();
    if (tool === 'select') {
      this.canvasCursor.set('crosshair');
    } else if (this.selectedEmoji()) {
      this.canvasCursor.set('copy');
    } else {
      this.canvasCursor.set('default');
    }
  }

  // ── Canvas coordinate helper ──
  private toCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const canvas = this.canvasRef.nativeElement;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // ── Hit test: returns topmost layer at (x,y) ──
  private hitTest(x: number, y: number): Layer | null {
    const list = [...this.layers()].reverse();
    for (const layer of list) {
      if (layer.type === 'emoji') {
        const half = layer.size / 2;
        if (x >= layer.x - half && x <= layer.x + half && y >= layer.y - half && y <= layer.y + half) {
          return layer;
        }
      } else {
        if (x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height) {
          return layer;
        }
      }
    }
    return null;
  }

  onMouseDown(e: MouseEvent) {
    const { x, y } = this.toCanvasCoords(e);
    const tool = this.activeTool();

    // Placing emoji (highest priority)
    if (this.selectedEmoji() && tool === 'move') {
      this.placeEmoji(x, y);
      return;
    }

    // Check if clicking an existing layer → drag it regardless of tool
    const hit = this.hitTest(x, y);
    if (hit) {
      this.dragLayerId = hit.id;
      this.dragOffsetX = x - hit.x;
      this.dragOffsetY = y - hit.y;
      this.canvasCursor.set('grabbing');
      return;
    }

    // Select tool on empty area → start selection rect
    if (tool === 'select') {
      this.isSelecting = true;
      this.selStartX = x;
      this.selStartY = y;
      this.selEndX = x;
      this.selEndY = y;
    }
  }

  onMouseMove(e: MouseEvent) {
    const { x, y } = this.toCanvasCoords(e);

    if (this.dragLayerId) {
      this.layers.update((list) =>
        list.map((l) =>
          l.id === this.dragLayerId
            ? { ...l, x: x - this.dragOffsetX, y: y - this.dragOffsetY }
            : l,
        ),
      );
      this.render();
      return;
    }

    if (this.isSelecting) {
      this.selEndX = x;
      this.selEndY = y;
      this.render();
      this.drawSelectionRect();
      return;
    }

    // Hover cursor hint
    const hit = this.hitTest(x, y);
    if (hit) {
      this.canvasCursor.set('grab');
    } else if (this.activeTool() === 'select') {
      this.canvasCursor.set('crosshair');
    } else if (this.selectedEmoji()) {
      this.canvasCursor.set('copy');
    } else {
      this.canvasCursor.set('default');
    }
  }

  onMouseUp(e: MouseEvent) {
    if (this.dragLayerId) {
      this.dragLayerId = null;
      this.updateCursor();
      return;
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      const rx = Math.min(this.selStartX, this.selEndX);
      const ry = Math.min(this.selStartY, this.selEndY);
      const rw = Math.abs(this.selEndX - this.selStartX);
      const rh = Math.abs(this.selEndY - this.selStartY);

      if (rw > 8 && rh > 8) {
        this.captureFragment(rx, ry, rw, rh);
      }
      this.render();
    }
  }

  // ── Emoji placement ──
  private placeEmoji(x: number, y: number) {
    const layer: EmojiLayer = {
      id: crypto.randomUUID(),
      type: 'emoji',
      emoji: this.selectedEmoji(),
      x: x - 24,
      y: y - 24,
      size: 48,
    };
    this.layers.update((l) => [...l, layer]);
    this.render();
  }

  // ── Fragment capture ──
  private captureFragment(x: number, y: number, w: number, h: number) {
    // Render photo + existing layers flat first (without selection rect)
    this.render();
    const srcCanvas = this.canvasRef.nativeElement;

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    off.getContext('2d')!.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);

    const layer: FragmentLayer = {
      id: crypto.randomUUID(),
      type: 'fragment',
      offscreen: off,
      x: x + 20,
      y: y + 20,
      width: w,
      height: h,
    };
    this.layers.update((l) => [...l, layer]);
    this.setTool('move');
    this.render();
  }

  // ── Render ──
  private render() {
    if (!this.ctx || !this.photo) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background photo
    this.ctx.drawImage(this.photo, 0, 0, canvas.width, canvas.height);

    // Layers
    for (const layer of this.layers()) {
      if (layer.type === 'fragment') {
        this.ctx.drawImage(layer.offscreen, layer.x, layer.y, layer.width, layer.height);
        // Border
        this.ctx.strokeStyle = 'rgba(124,58,237,0.5)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      } else {
        this.ctx.font = `${layer.size}px serif`;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(layer.emoji, layer.x, layer.y);
      }
    }
  }

  private drawSelectionRect() {
    const rx = Math.min(this.selStartX, this.selEndX);
    const ry = Math.min(this.selStartY, this.selEndY);
    const rw = Math.abs(this.selEndX - this.selStartX);
    const rh = Math.abs(this.selEndY - this.selStartY);

    this.ctx.save();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeRect(rx, ry, rw, rh);
    this.ctx.fillStyle = 'rgba(124,58,237,0.12)';
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.restore();
  }

  clearLayers() {
    this.layers.set([]);
    this.render();
  }

  saveToGallery() {
    this.render(); // flatten
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/jpeg', 0.92);
    this.saved.emit(dataUrl);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2700);
  }

  ngOnDestroy() {}
}