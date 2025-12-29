/**
 * Escapes HTML entities to prevent XSS attacks
 * Use this for user-generated content that will be inserted into HTML
 */
export const escapeHtml = (text: string | undefined | null): string => {
  if (!text) return '';
  
  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
};

/**
 * Checks if a string contains HTML tags
 * Useful for rejecting potentially malicious input at form level
 */
export const containsHtmlTags = (text: string): boolean => {
  return /<[^>]*>/g.test(text);
};
