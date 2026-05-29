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
  computed,
  signal,
} from '@angular/core';

export type Tool = 'move' | 'pencil';

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
  // Окуляри
  '🕶️','👓','🥽','😎','🤓','🥸',
  // Обличчя
  '😀','😁','😂','🤣','🥰','😍','🤩','😎','🥳','😜',
  '😝','🤪','😱','🤯','🥺','😭','😤','🤬','😈','🤡',
  '🥸','🤓','😏','😒','🙄','😬','🤐','🤫','🤭','😶',
  // Жести та люди
  '👍','👎','👏','🙌','🤝','🫶','✌️','🤞','🤙','💪',
  '🫵','👆','👇','👈','👉','🙏','💅','🫠','🤷','🤦',
  // Серця та символи
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
  '💞','💓','💗','💖','💝','✨','⭐','🌟','💫','🔥',
  '💥','🎉','🎊','🎈','🎁','🏆','🥇','🎯','💯','❗',
  // Природа
  '🌸','🌺','🌻','🌹','🌷','🍀','🌿','🌴','🌊','⛅',
  '🌈','☀️','🌙','⭐','❄️','🌸','🦋','🐝','🦄','🐶',
  '🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐸','🦋','🐙',
  // Їжа
  '🍕','🍔','🍟','🌮','🍜','🍣','🍩','🎂','🍰','🧁',
  '🍦','🍭','🍫','🍿','🥤','☕','🧃','🍷','🥂','🍺',
  // Активності та предмети
  '🚀','✈️','🚗','🏎️','🛸','⚽','🏀','🎸','🎮','🎲',
  '📸','📱','💻','🎬','🎵','🎤','🎧','🕹️','🔮','💎',
];

@Component({
  selector: 'app-editor',
  standalone: true,
  styleUrl: './editor.component.css',
  template: `
    <div class="editor-root">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="tool-group">
          <button
            class="tool-btn"
            [class.active]="activeTool() === 'move'"
            (click)="setTool('move')"
            title="Переміщення (M)"
          >
            <span class="btn-icon">✋</span> Рухати
          </button>
          <button
            class="tool-btn"
            [class.active]="activeTool() === 'pencil'"
            (click)="setTool('pencil')"
            title="Виділення олівцем"
          >
            <span class="btn-icon">✏️</span> Олівець
          </button>
        </div>
        <div class="tool-sep"></div>
        <div class="tool-group">
          @if (layers().length) {
            <button class="tool-btn danger" (click)="clearLayers()" title="Очистити шари">
              <span class="btn-icon">🗑</span> Очистити
            </button>
          }
          <button
            class="tool-btn save"
            [class.saving]="saving"
            [disabled]="saving"
            (click)="saveToGallery()"
            title="Зберегти"
          >
            @if (saving) {
              <span class="btn-icon save-spinner">⏳</span> Збереження…
            } @else {
              <span class="btn-icon">💾</span> Зберегти
            }
          </button>
          <button class="tool-btn secondary back-btn" (click)="back.emit()" title="Назад">
            ← Назад
          </button>
        </div>
      </div>

      <div class="workspace">
        <!-- Emoji palette -->
        <div class="emoji-panel" [class.collapsed]="!emojiPanelOpen()">
          <div class="panel-header">
            <span class="panel-title">Емодзі</span>
            <button class="panel-toggle" (click)="emojiPanelOpen.set(!emojiPanelOpen())">
              {{ emojiPanelOpen() ? '▾' : '▸' }}
            </button>
          </div>
          @if (emojiPanelOpen()) {
            <input
              class="emoji-search"
              type="text"
              placeholder="Пошук…"
              [value]="emojiSearch()"
              (input)="onEmojiSearch($event)"
            />
            <div class="emoji-grid">
              @for (e of filteredEmojis(); track e) {
                <button
                  class="emoji-btn"
                  [class.selected]="selectedEmoji() === e"
                  (click)="selectEmoji(e)"
                  title="Додати {{ e }}"
                >{{ e }}</button>
              }
              @if (!filteredEmojis().length) {
                <div class="emoji-empty">Нічого не знайдено</div>
              }
            </div>
            @if (selectedEmoji()) {
              <div class="panel-hint">
                Клацніть на фото, щоб розмістити {{ selectedEmoji() }}
              </div>
            }
            @if (activeTool() === 'pencil') {
              <div class="panel-hint pencil-hint">
                ✏️ Намалюйте контур — виділена область стане окремим шаром
              </div>
            }
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
            (mouseleave)="onMouseLeave($event)"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onTouchEnd($event)"
          ></canvas>
        </div>
      </div>

      @if (savedFlash()) {
        <div class="save-toast">✅ Фото збережено до галереї!</div>
      }
    </div>
  `,
})
export class EditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() photoDataUrl = '';
  @Input() saving = false;
  @Output() back = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();

  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapperEl') wrapperRef!: ElementRef<HTMLDivElement>;

  readonly emojis = EMOJIS;

  activeTool = signal<Tool>('move');
  selectedEmoji = signal('');
  emojiSearch = signal('');
  emojiPanelOpen = signal(true);
  filteredEmojis = computed(() => {
    const q = this.emojiSearch().trim();
    return q ? EMOJIS.filter(e => e.includes(q)) : EMOJIS;
  });
  layers = signal<Layer[]>([]);
  selectedLayerId = signal<string | null>(null);
  savedFlash = signal(false);
  canvasCursor = signal('default');

  private photo: HTMLImageElement | null = null;
  private ctx!: CanvasRenderingContext2D;

  // Drag state
  private dragLayerId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Resize state
  private resizingLayerId: string | null = null;
  private resizeHandle = '';
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeOrigin: { x: number; y: number; width: number; height: number } | null = null;

  // Pencil (freehand) selection state
  private isDrawing = false;
  private pencilPoints: { x: number; y: number }[] = [];

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

  onEmojiSearch(event: Event) {
    this.emojiSearch.set((event.target as HTMLInputElement).value);
  }

  private updateCursor() {
    const tool = this.activeTool();
    if (tool === 'pencil') {
      this.canvasCursor.set('crosshair');
    } else if (this.selectedEmoji()) {
      this.canvasCursor.set('copy');
    } else {
      this.canvasCursor.set('default');
    }
  }

  // ── Canvas coordinate helper ──
  private toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const canvas = this.canvasRef.nativeElement;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ── Touch event handlers ──
  onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const t = e.touches[0];
    if (t) this.handlePointerDown(t.clientX, t.clientY);
  }

  onTouchMove(e: TouchEvent) {
    e.preventDefault();
    const t = e.touches[0];
    if (t) this.handlePointerMove(t.clientX, t.clientY);
  }

  onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.handlePointerUp();
  }

  // ── Розмір маркера в координатах canvas (залежить від масштабу) ──
  private handleSize(): number {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const scale = this.canvasRef.nativeElement.width / rect.width;
    return Math.max(10, 10 * scale); // ~10px на екрані
  }

  // ── 8 маркерів для будь-якого прямокутника ──
  private getHandles(l: { x: number; y: number; width: number; height: number }): { name: string; cx: number; cy: number; cursor: string }[] {
    const { x, y, width: w, height: h } = l;
    return [
      { name: 'nw', cx: x,         cy: y,         cursor: 'nwse-resize' },
      { name: 'n',  cx: x + w / 2, cy: y,         cursor: 'ns-resize'   },
      { name: 'ne', cx: x + w,     cy: y,         cursor: 'nesw-resize' },
      { name: 'e',  cx: x + w,     cy: y + h / 2, cursor: 'ew-resize'   },
      { name: 'se', cx: x + w,     cy: y + h,     cursor: 'nwse-resize' },
      { name: 's',  cx: x + w / 2, cy: y + h,     cursor: 'ns-resize'   },
      { name: 'sw', cx: x,         cy: y + h,     cursor: 'nesw-resize' },
      { name: 'w',  cx: x,         cy: y + h / 2, cursor: 'ew-resize'   },
    ];
  }

  // ── Отримати bounds шару (уніфіковано для emoji та fragment) ──
  private layerBounds(layer: Layer): { x: number; y: number; width: number; height: number } {
    if (layer.type === 'emoji') {
      return { x: layer.x, y: layer.y, width: layer.size, height: layer.size };
    }
    return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  }

  // ── Перевірка попадання у маркер (працює для будь-якого шару) ──
  private hitHandle(x: number, y: number, layer: Layer) {
    const hs = this.handleSize() / 2;
    return this.getHandles(this.layerBounds(layer)).find(
      h => Math.abs(x - h.cx) <= hs && Math.abs(y - h.cy) <= hs
    ) ?? null;
  }

  // ── Hit test: returns topmost layer at (x,y) ──
  private hitTest(x: number, y: number): Layer | null {
    const list = [...this.layers()].reverse();
    for (const layer of list) {
      if (layer.type === 'emoji') {
        // Emoji малюється від (layer.x, layer.y) як top-left з розміром layer.size
        if (x >= layer.x && x <= layer.x + layer.size && y >= layer.y && y <= layer.y + layer.size) {
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

  onMouseDown(e: MouseEvent) { this.handlePointerDown(e.clientX, e.clientY); }
  onMouseMove(e: MouseEvent) { this.handlePointerMove(e.clientX, e.clientY); }
  onMouseUp(_e: MouseEvent)  { this.handlePointerUp(); }

  private handlePointerDown(clientX: number, clientY: number) {
    const { x, y } = this.toCanvasCoords(clientX, clientY);
    const tool = this.activeTool();

    // 1. Перевіряємо маркери resize виділеного шару (fragment або emoji)
    const selId = this.selectedLayerId();
    if (selId) {
      const selLayer = this.layers().find(l => l.id === selId);
      if (selLayer) {
        const handle = this.hitHandle(x, y, selLayer);
        if (handle) {
          this.resizingLayerId = selId;
          this.resizeHandle = handle.name;
          this.resizeStartX = x;
          this.resizeStartY = y;
          this.resizeOrigin = this.layerBounds(selLayer);
          this.canvasCursor.set(handle.cursor);
          return;
        }
      }
    }

    // 2. Перевіряємо попадання у шар → перетягування + виділення
    const hit = this.hitTest(x, y);
    if (hit) {
      this.selectedLayerId.set(hit.id);
      this.dragLayerId = hit.id;
      this.dragOffsetX = x - hit.x;
      this.dragOffsetY = y - hit.y;
      this.canvasCursor.set('grabbing');
      this.render();
      return;
    }

    // 3. Клік на порожньому місці — знімаємо виділення
    this.selectedLayerId.set(null);

    // 4. Розміщення емодзі
    if (this.selectedEmoji() && tool === 'move') {
      this.placeEmoji(x, y);
      return;
    }

    // 5. Олівець → старт вільного малювання
    if (tool === 'pencil') {
      this.isDrawing = true;
      this.pencilPoints = [{ x, y }];
    }
  }

  private handlePointerMove(clientX: number, clientY: number) {
    const { x, y } = this.toCanvasCoords(clientX, clientY);

    // Resize
    if (this.resizingLayerId && this.resizeOrigin) {
      const dx = x - this.resizeStartX;
      const dy = y - this.resizeStartY;
      const o = this.resizeOrigin;
      const MIN = 20;
      const h = this.resizeHandle;

      const resizingLayer = this.layers().find(l => l.id === this.resizingLayerId);

      if (resizingLayer?.type === 'emoji') {
        // Пропорційне масштабування emoji від центру
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        let delta: number;
        if (h.length === 2) {
          // Кутовий маркер: беремо максимальний delta по обох осях
          const dx2 = h.includes('e') ? dx : -dx;
          const dy2 = h.includes('s') ? dy : -dy;
          delta = Math.max(dx2, dy2);
        } else {
          // Боковий маркер: масштабуємо по одній осі
          if (h === 'e') delta = dx;
          else if (h === 'w') delta = -dx;
          else if (h === 's') delta = dy;
          else delta = -dy; // 'n'
        }
        const newSize = Math.max(MIN, o.width + delta);
        const half = newSize / 2;
        this.layers.update(list =>
          list.map(l => l.id === this.resizingLayerId
            ? { ...l, x: cx - half, y: cy - half, size: newSize }
            : l)
        );
      } else {
        // Resize фрагмента — незалежне масштабування по осях
        let { x: lx, y: ly, width: lw, height: lh } = o;
        if (h.includes('e')) lw = Math.max(MIN, o.width  + dx);
        if (h.includes('s')) lh = Math.max(MIN, o.height + dy);
        if (h.includes('w')) { lw = Math.max(MIN, o.width  - dx); lx = o.x + o.width  - lw; }
        if (h.includes('n')) { lh = Math.max(MIN, o.height - dy); ly = o.y + o.height - lh; }
        this.layers.update(list =>
          list.map(l => l.id === this.resizingLayerId
            ? { ...l, x: lx, y: ly, width: lw, height: lh }
            : l)
        );
      }

      this.render();
      return;
    }

    // Drag
    if (this.dragLayerId) {
      this.layers.update(list =>
        list.map(l => l.id === this.dragLayerId
          ? { ...l, x: x - this.dragOffsetX, y: y - this.dragOffsetY }
          : l)
      );
      this.render();
      return;
    }

    // Pencil drawing
    if (this.isDrawing) {
      this.pencilPoints.push({ x, y });
      this.render();
      this.drawPencilPath();
      return;
    }

    // Hover cursor — маркери resize для виділеного шару (emoji або fragment)
    const selId = this.selectedLayerId();
    if (selId) {
      const selLayer = this.layers().find(l => l.id === selId);
      if (selLayer) {
        const handle = this.hitHandle(x, y, selLayer);
        if (handle) { this.canvasCursor.set(handle.cursor); return; }
      }
    }
    const hit = this.hitTest(x, y);
    if (hit) {
      this.canvasCursor.set('grab');
    } else if (this.activeTool() === 'pencil') {
      this.canvasCursor.set('crosshair');
    } else if (this.selectedEmoji()) {
      this.canvasCursor.set('copy');
    } else {
      this.canvasCursor.set('default');
    }
  }

  private handlePointerUp() {
    if (this.resizingLayerId) {
      this.resizingLayerId = null;
      this.resizeOrigin = null;
      this.updateCursor();
      return;
    }

    if (this.dragLayerId) {
      this.dragLayerId = null;
      this.updateCursor();
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.pencilPoints.length > 5) {
        this.captureFreehandFragment();
      } else {
        this.render();
      }
      this.pencilPoints = [];
    }
  }

  // mouseleave — зупиняємо drag/resize, але НЕ завершуємо малювання олівцем
  onMouseLeave(_e: MouseEvent) {
    if (this.resizingLayerId) { this.resizingLayerId = null; this.resizeOrigin = null; this.updateCursor(); return; }
    if (this.dragLayerId)     { this.dragLayerId = null; this.updateCursor(); return; }
    // isDrawing навмисно не зупиняємо — продовжиться коли мишка повернеться
  }

  // ── Emoji placement ──
  private placeEmoji(x: number, y: number) {
    const size = window.innerWidth <= 640 ? 173 : 86;
    const half = size / 2;
    const layer: EmojiLayer = {
      id: crypto.randomUUID(),
      type: 'emoji',
      emoji: this.selectedEmoji(),
      x: x - half,
      y: y - half,
      size,
    };
    this.layers.update((l) => [...l, layer]);
    this.selectedEmoji.set('');
    this.render();
  }

  // ── Freehand fragment capture ──
  private captureFreehandFragment() {
    const pts = this.pencilPoints;

    // Bounding box навколо намальованого контуру
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 8 || h < 8) return;

    // Плоский рендер поточного стану (без контуру олівця)
    this.render();
    const srcCanvas = this.canvasRef.nativeElement;

    // Offscreen canvas розміром bounding box
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d')!;

    // Clip за вільним контуром (зсунутим до координат offscreen)
    offCtx.beginPath();
    offCtx.moveTo(pts[0].x - minX, pts[0].y - minY);
    for (let i = 1; i < pts.length; i++) {
      offCtx.lineTo(pts[i].x - minX, pts[i].y - minY);
    }
    offCtx.closePath();
    offCtx.clip();

    // Малюємо фото+шари з основного canvas, обрізане контуром
    offCtx.drawImage(srcCanvas, -minX, -minY);

    const layer: FragmentLayer = {
      id: crypto.randomUUID(),
      type: 'fragment',
      offscreen: off,
      x: minX + 20,
      y: minY + 20,
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

    const selId = this.selectedLayerId();

    // Layers
    for (const layer of this.layers()) {
      if (layer.type === 'fragment') {
        this.ctx.drawImage(layer.offscreen, layer.x, layer.y, layer.width, layer.height);

        const isSelected = layer.id === selId;
        // Рамка: яскравіша якщо виділено
        this.ctx.strokeStyle = isSelected ? 'rgba(167,139,250,0.9)' : 'rgba(124,58,237,0.45)';
        this.ctx.lineWidth = isSelected ? 2 : 1.5;
        this.ctx.setLineDash(isSelected ? [6, 3] : []);
        this.ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
        this.ctx.setLineDash([]);

        // Маркери resize — тільки для виділеного
        if (isSelected) {
          const hs = this.handleSize() / 2;
          this.ctx.fillStyle = '#fff';
          this.ctx.strokeStyle = 'rgba(124,58,237,0.9)';
          this.ctx.lineWidth = 1.5;
          for (const handle of this.getHandles(layer)) {
            this.ctx.beginPath();
            this.ctx.rect(handle.cx - hs, handle.cy - hs, hs * 2, hs * 2);
            this.ctx.fill();
            this.ctx.stroke();
          }
        }
      } else {
        const isSelected = layer.id === selId;
        this.ctx.font = `${layer.size}px serif`;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(layer.emoji, layer.x, layer.y);

        // Рамка виділення + маркери resize для виділеного emoji
        if (isSelected) {
          this.ctx.strokeStyle = 'rgba(167,139,250,0.9)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([6, 3]);
          this.ctx.strokeRect(layer.x, layer.y, layer.size, layer.size);
          this.ctx.setLineDash([]);

          const hs = this.handleSize() / 2;
          this.ctx.fillStyle = '#fff';
          this.ctx.strokeStyle = 'rgba(124,58,237,0.9)';
          this.ctx.lineWidth = 1.5;
          for (const handle of this.getHandles({ x: layer.x, y: layer.y, width: layer.size, height: layer.size })) {
            this.ctx.beginPath();
            this.ctx.rect(handle.cx - hs, handle.cy - hs, hs * 2, hs * 2);
            this.ctx.fill();
            this.ctx.stroke();
          }
        }
      }
    }
  }

  // ── Малювання контуру олівця поверх canvas ──
  private drawPencilPath() {
    const pts = this.pencilPoints;
    if (pts.length < 2) return;

    this.ctx.save();

    // Заливка
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i].x, pts[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(124,58,237,0.15)';
    this.ctx.fill();

    // Контурна лінія
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i].x, pts[i].y);
    }
    this.ctx.strokeStyle = 'rgba(167,139,250,0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.setLineDash([]);
    this.ctx.stroke();

    this.ctx.restore();
  }

  clearLayers() {
    this.layers.set([]);
    this.render();
  }

  saveToGallery() {
    this.selectedLayerId.set(null); // знімаємо виділення — маркери не потрапляють на фото
    this.render();
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/jpeg', 0.92);
    this.saved.emit(dataUrl);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2700);
  }

  ngOnDestroy() {}
}