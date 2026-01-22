import Anthropic from '@anthropic-ai/sdk';
import type { AIAnalysisResult, ConfidenceLevel } from '@/types';

const FOOD_ANALYSIS_PROMPT = `You are a nutrition expert analyzing food images and descriptions to estimate protein content.

For the given food, provide:
1. A clear food name/description
2. Estimated protein content in grams
3. Confidence level (high/medium/low)
4. Brief reasoning for your estimate

Guidelines:
- Use standard serving sizes unless specified otherwise
- For packaged foods with visible labels, extract the exact protein value
- For home-cooked or restaurant meals, estimate based on visible portions
- Common protein estimates:
  - Chicken breast (100g cooked): ~31g protein
  - Eggs (1 large): ~6g protein
  - Greek yogurt (150g): ~15g protein
  - Salmon (100g): ~25g protein
  - Beef (100g): ~26g protein
  - Tofu (100g): ~8g protein
  - Protein shake (typical): ~20-30g protein

Respond in JSON format only:
{
  "foodName": "string",
  "protein": number,
  "confidence": "high" | "medium" | "low",
  "reasoning": "string"
}`;

export async function analyzeFood(
  apiKey: string,
  input: { text?: string; imageBase64?: string }
): Promise<AIAnalysisResult> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const content: Anthropic.MessageParam['content'] = [];

  if (input.imageBase64) {
    // Extract base64 data from data URL if present
    const base64Data = input.imageBase64.includes('base64,')
      ? input.imageBase64.split('base64,')[1]
      : input.imageBase64;

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: base64Data,
      },
    });
  }

  if (input.text) {
    content.push({
      type: 'text',
      text: `Analyze this food: ${input.text}`,
    });
  } else if (input.imageBase64) {
    content.push({
      type: 'text',
      text: 'Analyze the food in this image and estimate its protein content.',
    });
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: FOOD_ANALYSIS_PROMPT,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    foodName: parsed.foodName || 'Unknown food',
    protein: Math.round(parsed.protein) || 0,
    confidence: (parsed.confidence as ConfidenceLevel) || 'low',
    reasoning: parsed.reasoning,
  };
}

export async function parseTextEntry(
  apiKey: string,
  text: string
): Promise<AIAnalysisResult> {
  return analyzeFood(apiKey, { text });
}

export async function analyzeImage(
  apiKey: string,
  imageBase64: string
): Promise<AIAnalysisResult> {
  return analyzeFood(apiKey, { imageBase64 });
}
