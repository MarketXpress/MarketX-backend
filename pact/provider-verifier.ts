/**
 * Pact Provider Verification
 * 
 * Verifies that the MarketX-Backend provider meets all consumer contracts
 */

import { Verifier, VerifierOptions } from '@pact-foundation/pact';
import * as path from 'path';
import { PACT_CONFIG } from './pact.config';
import { setupStateHandlers } from './state-handlers';

/**
 * Main provider verification function
 */
export async function verifyProvider(): Promise<void> {
  console.log('🔍 Starting Pact Provider Verification...');
  console.log(`Provider: ${PACT_CONFIG.provider.name}`);
  console.log(`Base URL: ${PACT_CONFIG.verification.providerBaseUrl}`);

  const options: VerifierOptions = {
    // Provider details
    provider: PACT_CONFIG.provider.name,
    providerBaseUrl: PACT_CONFIG.verification.providerBaseUrl,
    providerVersion: PACT_CONFIG.verification.providerVersion,
    providerVersionTags: PACT_CONFIG.verification.providerVersionTags,

    // Pact sources - can be from broker or local files
    ...(PACT_CONFIG.broker.url
      ? {
          // Fetch from Pact Broker
          pactBrokerUrl: PACT_CONFIG.broker.url,
          pactBrokerToken: PACT_CONFIG.broker.token,
          pactBrokerUsername: PACT_CONFIG.broker.username,
          pactBrokerPassword: PACT_CONFIG.broker.password,
          consumerVersionSelectors: [
            { mainBranch: true }, // Latest from main branch
            { deployedOrReleased: true }, // Currently deployed versions
            { matchingBranch: true }, // Matching current branch
          ],
          enablePending: PACT_CONFIG.verification.enablePending,
          includeWipPactsSince: PACT_CONFIG.verification.includeWipPactsSince,
        }
      : {
          // Use local contract files
          pactUrls: [
            path.resolve(PACT_CONFIG.contracts.dir, PACT_CONFIG.contracts.pattern),
          ],
        }),

    // Publishing results
    publishVerificationResult: PACT_CONFIG.verification.publishVerificationResult,

    // State handlers
    stateHandlers: setupStateHandlers(),

    // Request filters for authentication
    requestFilter: (req, res, next) => {
      // Add authentication headers if needed for protected endpoints
      if (process.env.PACT_TEST_AUTH_TOKEN) {
        req.headers['Authorization'] = `Bearer ${process.env.PACT_TEST_AUTH_TOKEN}`;
      }
      next();
    },

    // Logging
    logLevel: PACT_CONFIG.logLevel,

    // Timeout
    timeout: 30000,
  };

  try {
    const output = await new Verifier(options).verifyProvider();
    console.log(' Pact Verification Complete!');
    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error(' Pact Verification Failed!');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Verify specific consumer contracts
 */
export async function verifyConsumer(consumerName: string): Promise<void> {
  console.log(` Verifying contracts for consumer: ${consumerName}`);

  const options: VerifierOptions = {
    provider: PACT_CONFIG.provider.name,
    providerBaseUrl: PACT_CONFIG.verification.providerBaseUrl,
    providerVersion: PACT_CONFIG.verification.providerVersion,

    // Specific consumer
    ...(PACT_CONFIG.broker.url
      ? {
          pactBrokerUrl: PACT_CONFIG.broker.url,
          pactBrokerToken: PACT_CONFIG.broker.token,
          consumerVersionSelectors: [
            { consumer: consumerName, latest: true },
          ],
        }
      : {
          pactUrls: [
            path.resolve(
              PACT_CONFIG.contracts.dir,
              `${consumerName}-${PACT_CONFIG.provider.name}.json`,
            ),
          ],
        }),

    publishVerificationResult: PACT_CONFIG.verification.publishVerificationResult,
    stateHandlers: setupStateHandlers(),
    logLevel: PACT_CONFIG.logLevel,
  };

  try {
    const output = await new Verifier(options).verifyProvider();
    console.log(` Verification complete for ${consumerName}`);
    console.log(output);
  } catch (error) {
    console.error(` Verification failed for ${consumerName}`);
    throw error;
  }
}

// Run verification if executed directly
if (require.main === module) {
  const consumerArg = process.argv[2];
  
  if (consumerArg) {
    verifyConsumer(consumerArg).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    verifyProvider().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
