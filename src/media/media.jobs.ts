import { UploadImageDto } from './dto/upload-image.dto';

export interface QueuedImageUploadResult {
  jobId: string;
  status: 'queued';
  productId: string;
  originalName: string;
}

export interface ImageProcessingJobData {
  productId: string;
  file: {
    bufferBase64: string;
    originalname: string;
    mimetype: string;
    size: number;
  };
  dto?: UploadImageDto;
  displayOrder: number;
}
