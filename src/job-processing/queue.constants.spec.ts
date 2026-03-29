import {
  EMAIL_JOB_SEND,
  EMAIL_QUEUE,
  IMAGE_JOB_PROCESS,
  IMAGE_PROCESSING_QUEUE,
  LEGACY_EMAIL_QUEUE,
  RECOMMENDATIONS_JOB_REFRESH,
  RECOMMENDATIONS_QUEUE,
} from './queue.constants';

describe('queue constants', () => {
  it('defines stable queue names', () => {
    expect(EMAIL_QUEUE).toBe('email-queue');
    expect(LEGACY_EMAIL_QUEUE).toBe('email');
    expect(IMAGE_PROCESSING_QUEUE).toBe('image-processing-queue');
    expect(RECOMMENDATIONS_QUEUE).toBe('recommendations-queue');
  });

  it('defines stable job names', () => {
    expect(EMAIL_JOB_SEND).toBe('send-email');
    expect(IMAGE_JOB_PROCESS).toBe('process-product-image');
    expect(RECOMMENDATIONS_JOB_REFRESH).toBe('refresh-user-recommendations');
  });
});
