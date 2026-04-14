export function detectLanguage(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) return 'ar';
  const chinesePattern = /[\u4E00-\u9FFF]/;
  if (chinesePattern.test(text)) return 'zh';
  const japanesePattern = /[\u3040-\u30FF]/;
  if (japanesePattern.test(text)) return 'ja';
  return 'fr'; // default
}
