export interface SentimentPrediction {
  label: string | null;
  status: 'predicted' | 'unknown_vocabulary' | 'empty_input';
  scores: number[] | null;
  scoreType: 'decision_margin' | 'log_score' | 'none';
  experimental: boolean;
}

export function createSentimentClassifier(
  model: unknown,
): (text: string) => SentimentPrediction;

