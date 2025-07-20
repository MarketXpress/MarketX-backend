
import { Injectable } from '@nestjs/common';
import { Scheduled } from '@nestjs/schedule';

interface SavedSearch { id: string; userId: string; filters: any; freq: 'daily'|'weekly'; last: Date; }

@Injectable()
export class SavedSearchesService {
  private list: SavedSearch[] = [];

  save(userId: string, filters: any, freq: 'daily'|'weekly') {
    const s = { id: crypto.randomUUID(), userId, filters, freq, last: new Date() };
    this.list.push(s);
    return s;
  }

  getFor(user: string) { return this.list.filter(x => x.userId === user); }

  @Scheduled('0 0 * * *') // run daily at midnight
  checkAll() {
    const now = new Date();
    this.list.forEach(s => {
      if (s.freq === 'daily' || (s.freq==='weekly' && now.getDay()===s.last.getDay())) {
        // trigger search & notify
        s.last = now;
      }
    });
  }
}
