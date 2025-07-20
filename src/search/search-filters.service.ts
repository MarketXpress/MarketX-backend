// src/search/search-filters.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Listing } from '../listings/listing.entity';
import { Repository, Brackets } from 'typeorm';
import { SearchResult } from './utils/search-helpers';

@Injectable()
export class SearchFiltersService {
  constructor(
    @InjectRepository(Listing)
    private readonly repo: Repository<Listing>,
  ) {}

  async applyFilters(filters: any): Promise<SearchResult[]> {
    const qb = this.repo.createQueryBuilder('l');
    this.applyLogic(qb, filters);
    qb.andWhere('l.isActive = true');
    if (filters.distanceWithin && filters.latitude && filters.longitude) {
      qb.andWhere(
        `ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(:lng, :lat),4326), :rad)`,
        { lng: filters.longitude, lat: filters.latitude, rad: filters.distanceWithin }
      );
    }
    const rows = await qb.getMany();
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      popularity: r.views,
      distance: 0
    }));
  }

  async findByIds(ids: string[]): Promise<SearchResult[]> {
    const rows = await this.repo.findByIds(ids);
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      popularity: r.views,
      distance: 0
    }));
  }

  private applyLogic(qb, f: any): void {
    if (!f) return;
    if (f.AND) {
      f.AND.forEach(sub => qb.andWhere(new Brackets(q => this.applyLogic(q, sub))));
    } else if (f.OR) {
      qb.andWhere(new Brackets(qb2 => {
        f.OR.forEach(sub => qb2.orWhere(new Brackets(q => this.applyLogic(q, sub))));
      }));
    } else if (f.NOT) {
      qb.andWhere(new Brackets(q => {
        f.NOT.forEach(sub => q.andWhere(`NOT (${this.buildCondition(q, sub)})`));
      }));
    } else {
      qb.andWhere(this.buildCondition(qb, f));
    }
  }

  private buildCondition(qb, filter: any): string {
    const [k, v] = Object.entries(filter)[0];
    const p = `:${k}`;
    qb.setParameter(k, k === 'title' ? `%${v}%` : v);
    if (k === 'minPrice') return `l.price >= ${p}`;
    if (k === 'maxPrice') return `l.price <= ${p}`;
    if (k === 'title')   return `LOWER(l.title) LIKE LOWER(${p})`;
    return `l.${k} = ${p}`;
  }
}
