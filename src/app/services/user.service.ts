import { Injectable } from '@angular/core';

const ADJECTIVES = [
  'Веселий', 'Хоробрий', 'Мудрий', 'Швидкий', 'Лагідний',
  'Яскравий', 'Тихий', 'Дикий', 'Вільний', 'Гордий',
  'Сміливий', 'Добрий', 'Чарівний', 'Пустотливий', 'Ніжний',
];

const NOUNS = [
  'Орел', 'Лисиця', 'Тигр', 'Дельфін', 'Вовк',
  'Єнот', 'Сова', 'Пантера', 'Лев', 'Заєць',
  'Ведмідь', 'Рись', 'Коала', 'Леопард', 'Краб',
];

@Injectable({ providedIn: 'root' })
export class UserService {
  readonly userId: string;
  readonly username: string;

  constructor() {
    this.userId = this.loadOrCreate('dragshot_user_id', () => crypto.randomUUID());
    this.username = this.loadOrCreate('dragshot_username', () => this.generateName());
  }

  private loadOrCreate(key: string, factory: () => string): string {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    const value = factory();
    localStorage.setItem(key, value);
    return value;
  }

  private generateName(): string {
    const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
  }
}
