export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export const JWT_CONSTANTS = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
  accessTokenExpiration: '15m',
  refreshTokenExpiration: '7d',
};