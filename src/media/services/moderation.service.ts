import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly rekognition?: RekognitionClient;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.isEnabled = !!(accessKeyId && secretAccessKey);

    if (this.isEnabled) {
      this.rekognition = new RekognitionClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn(
        'AWS Rekognition not configured. Content moderation is DISABLED.',
      );
    }
  }

  async validateImageContent(buffer: Buffer): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const params: AWS.Rekognition.DetectModerationLabelsRequest = {
        Image: {
          Bytes: buffer,
        },
        MinConfidence: 80,
      };

      const response = await this.rekognition.send(
        new DetectModerationLabelsCommand(params),
      );
      const labels = response.ModerationLabels || [];

      this.logger.debug(
        `Moderation labels detected: ${JSON.stringify(labels)}`,
      );

      for (const label of labels) {
        if (
          (label.Name === 'Explicit Nudity' ||
            label.Name === 'Violence' ||
            label.Name === 'Visually Disturbing') &&
          (label.Confidence ?? 0) > 90
        ) {
          throw new BadRequestException(
            `Image rejected due to content policy violation: ${label.Name} detected with high confidence.`,
          );
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `AI Content Moderation failed: ${error.message}`,
        error.stack,
      );
      // Fail-safe: allow if moderation service itself fails (or change to reject if strict)
    }
  }
}
