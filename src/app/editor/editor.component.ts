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
          <button class="tool-btn save" (click)="saveToGallery()" title="Зберегти">
            <span class="btn-icon">💾</span> Зберегти
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
        width: 340px;
        flex-shrink: 0;
        background: #13131d;
        border-right: 1px solid rgba(255,255,255,0.07);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .panel-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
      }

      .panel-toggle {
        display: none; /* видимий тільки на мобільному */
        background: none;
        border: none;
        color: #64748b;
        font-size: 1rem;
        cursor: pointer;
        padding: 0.1rem 0.3rem;
        line-height: 1;
      }

      .emoji-search {
        width: 100%;
        padding: 0.35rem 0.6rem;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: #e2e8f0;
        font-size: 0.8rem;
        outline: none;
        flex-shrink: 0;
      }
      .emoji-search::placeholder { color: #475569; }
      .emoji-search:focus { border-color: rgba(124,58,237,0.5); }

      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 3px;
        align-content: start;
      }

      .emoji-empty {
        grid-column: 1 / -1;
        text-align: center;
        color: #475569;
        font-size: 0.75rem;
        padding: 1rem 0;
      }

      .emoji-btn {
        aspect-ratio: 1;
        border-radius: 6px;
        border: 1px solid transparent;
        background: rgba(255,255,255,0.04);
        font-size: 1.05rem;
        cursor: pointer;
        transition: all 0.12s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        padding: 0;
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
        flex-shrink: 0;
      }

      .pencil-hint {
        color: #a78bfa;
        border-color: rgba(124,58,237,0.25);
        background: rgba(124,58,237,0.06);
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
        touch-action: none; /* забороняємо браузеру перехоплювати touch для скролу */
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

      /* ── Мобільний: панель знизу ── */
      @media (max-width: 640px) {
        .workspace {
          flex-direction: column-reverse; /* canvas зверху, панель знизу */
        }

        .emoji-panel {
          width: 100%;
          border-right: none;
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 0.5rem 0.75rem;
          gap: 0.4rem;
          flex-shrink: 0;
        }

        .emoji-panel.collapsed {
          /* Показуємо тільки заголовок */
        }

        .panel-toggle {
          display: block; /* показуємо кнопку згортання */
        }

        .emoji-grid {
          /* 2 рядки, горизонтальний скрол */
          grid-template-columns: unset;
          grid-template-rows: repeat(2, 1fr);
          grid-auto-flow: column;
          grid-auto-columns: 36px;
          overflow-x: auto;
          overflow-y: hidden;
          gap: 3px;
          padding-bottom: 4px; /* місце для скролбару */
        }

        .emoji-search {
          display: none;
        }

        .back-btn {
          display: none;
        }

        .btn-icon {
          display: none;
        }

        .toolbar {
          flex-wrap: nowrap;
          justify-content: space-between;
          padding: 0.4rem 0.6rem;
        }

        .tool-sep {
          display: none;
        }

        .tool-group {
          gap: 0.3rem;
        }

        .tool-btn {
          padding: 0.4rem 0.65rem;
          font-size: 0.78rem;
        }

        .panel-hint {
          display: none; /* не показуємо підказки на мобільному */
        }

        .canvas-wrapper {
          flex: 1;
          min-height: 0;
          padding: 0.5rem;
        }
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

  // ── 8 маркерів для FragmentLayer ──
  private getHandles(l: FragmentLayer): { name: string; cx: number; cy: number; cursor: string }[] {
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

  // ── Перевірка попадання у маркер ──
  private hitHandle(x: number, y: number, layer: FragmentLayer) {
    const hs = this.handleSize() / 2;
    return this.getHandles(layer).find(
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

    // 1. Перевіряємо маркери resize виділеного фрагмента
    const selId = this.selectedLayerId();
    if (selId) {
      const selLayer = this.layers().find(l => l.id === selId);
      if (selLayer?.type === 'fragment') {
        const handle = this.hitHandle(x, y, selLayer);
        if (handle) {
          this.resizingLayerId = selId;
          this.resizeHandle = handle.name;
          this.resizeStartX = x;
          this.resizeStartY = y;
          this.resizeOrigin = { x: selLayer.x, y: selLayer.y, width: selLayer.width, height: selLayer.height };
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
      let { x: lx, y: ly, width: lw, height: lh } = o;

      const h = this.resizeHandle;
      if (h.includes('e')) lw = Math.max(MIN, o.width  + dx);
      if (h.includes('s')) lh = Math.max(MIN, o.height + dy);
      if (h.includes('w')) { lw = Math.max(MIN, o.width  - dx); lx = o.x + o.width  - lw; }
      if (h.includes('n')) { lh = Math.max(MIN, o.height - dy); ly = o.y + o.height - lh; }

      this.layers.update(list =>
        list.map(l => l.id === this.resizingLayerId
          ? { ...l, x: lx, y: ly, width: lw, height: lh }
          : l)
      );
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

    // Hover cursor
    const selId = this.selectedLayerId();
    if (selId) {
      const selLayer = this.layers().find(l => l.id === selId);
      if (selLayer?.type === 'fragment') {
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
    const size = window.innerWidth <= 640 ? 96 : 48;
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
        this.ctx.font = `${layer.size}px serif`;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(layer.emoji, layer.x, layer.y);
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