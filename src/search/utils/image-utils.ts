import * as tf from '@tensorflow/tfjs-node';

export async function extractImageEmbedding(imageBuffer: Buffer): Promise<number[]> {
  const img = tf.node.decodeImage(imageBuffer, 3)
    .resizeBilinear([224, 224])
    .expandDims(0)
    .toFloat()
    .div(tf.scalar(255));
  const model = await tf.loadGraphModel(
    'https://tfhub.dev/google/imagenet/mobilenet_v2_140_224/feature_vector/4',
    { fromTFHub: true }
  );
  const embedding = model.predict(img) as tf.Tensor;
  return Array.from(embedding.flatten().arraySync() as number[]);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (normA * normB);
}
