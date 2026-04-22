/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import geoip from 'geoip-lite';
import NodeGeocoder = require('node-geocoder');

export type GeoPoint = { latitude: number; longitude: number };

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);

  private geocoder = NodeGeocoder({
    provider: 'openstreetmap',
    httpAdapter: 'https',
    formatter: null,
  });

  toPoint(longitude: number, latitude: number): string {
    return `POINT(${longitude} ${latitude})`;
  }

  async getLocationFromIp(ip: string): Promise<GeoPoint | null> {
    if (!ip) return null;

    const lookup = geoip.lookup(ip);
    if (!lookup || !lookup.ll) {
      this.logger.warn(`Geo lookup failed for IP: ${ip}`);
      return null;
    }

    const [latitude, longitude] = lookup.ll;
    return { latitude, longitude };
  }

  async geocodeAddress(address: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }): Promise<GeoPoint | null> {
    if (!address || !address.country || !address.city) {
      return null;
    }

    const query = `${address.street ?? ''} ${address.city} ${address.state ?? ''} ${address.postalCode ?? ''} ${address.country}`.trim();

    try {
      const results = await this.geocoder.geocode(query);
      const best = results && results[0];
      if (!best || best.latitude == null || best.longitude == null) {
        this.logger.warn(`Address geocode no result for: ${query}`);
        return null;
      }
      return { latitude: best.latitude, longitude: best.longitude };
    } catch (error) {
      this.logger.error(`Geocode failed: ${error?.message || error}`);
      return null;
    }
  }

  distanceMiles(a: GeoPoint, b: GeoPoint): number {
    const toRads = (x: number) => (x * Math.PI) / 180;
    const R = 3958.8; // Earth radius in miles

    const dLat = toRads(b.latitude - a.latitude);
    const dLon = toRads(b.longitude - a.longitude);
    const lat1 = toRads(a.latitude);
    const lat2 = toRads(b.latitude);

    const haversine =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return R * c;
  }
}
