import { Injectable } from '@nestjs/common';
import { cosineSimilarity, extractImageEmbedding } from './utils/image-utils';

@Injectable()
export class ImageRecognitionService {
  private embeddings = new Map<string, number[]>();

  async addImage(itemId: string, imageBuffer: Buffer): Promise<void> {
    const emb = await extractImageEmbedding(imageBuffer);
    this.embeddings.set(itemId, emb);
  }

  async searchSimilar(imageBuffer: Buffer, topK = 5): Promise<string[]> {
    const queryEmb = await extractImageEmbedding(imageBuffer);
    const sims = Array.from(this.embeddings.entries())
      .map(([id, emb]) => ({ id, sim: cosineSimilarity(queryEmb, emb) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK)
      .map(x => x.id);
    return sims;
  }
}
