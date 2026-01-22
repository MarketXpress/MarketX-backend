/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';

@Injectable()
export class GeolocationService {
  /**
   * @param longitude - Longitude value
   * @param latitude - Latitude value
   * @returns PostGIS Point string
   */
  toPoint(longitude: number, latitude: number): string {
    return `POINT(${longitude} ${latitude})`;
  }
}
