import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import axios from 'axios';

@Injectable()
export class StellarIndicator {
  private readonly stellarHorizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  async isHealthy(): Promise<HealthIndicatorResult> {
    try {
      // Set timeout to ensure fast response as per requirements (must respond within 2 seconds)
      const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '2000', 10); // 2 seconds timeout

      // Check Stellar Horizon API availability
      const response = await axios.get(`${this.stellarHorizonUrl}/ledgers?limit=1`, {
        timeout,
      }) as any;

      if (response.status >= 200 && response.status < 300) {
        // Check if the response has the expected structure
        if (response.data && response.data._embedded && response.data._embedded.records) {
          return {
            stellar: {
              status: 'up',
              horizon_url: this.stellarHorizonUrl,
              network: this.stellarHorizonUrl.includes('testnet') ? 'testnet' : 'mainnet',
              last_ledger: response.data._embedded.records.length > 0
                ? response.data._embedded.records[0].sequence
                : 'unknown',
            },
          };
        } else {
          throw new HealthCheckError('Stellar API returned invalid response structure', {
            stellar: {
              status: 'down',
              message: 'Invalid response structure from Stellar Horizon API',
            },
          });
        }
      } else {
        throw new HealthCheckError('Stellar Horizon API returned non-success status', {
          stellar: {
            status: 'down',
            message: `API returned status ${response.status}`,
          },
        });
      }
    } catch (error) {
      throw new HealthCheckError('Stellar network check failed', {
        stellar: {
          status: 'down',
          message: error.message || 'Unknown error occurred while checking Stellar network',
        },
      });
    }
  }
}