/**
 * Cleans the script to make it "HeyGen Ready" by removing all brackets,
 * special markers, and formatting instructions.
 * Returns only the natural dialogue that should be spoken.
 */
export function cleanScriptForHeyGen(script: string): string {
  let cleaned = script;

  // Remove all text in square brackets (e.g., [HOOK], [BODY], [CLOSING STATEMENT], [CTA])
  // This regex matches [ followed by any characters until ]
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

  // Remove any remaining brackets that might be standalone
  cleaned = cleaned.replace(/\[|\]/g, '');

  // Remove common section markers and labels (case-insensitive)
  // Handle both markdown bold format (**HOOK:**) and plain format (HOOK:)
  // Also handle cases where they might be at start of line or anywhere in text
  // IMPORTANT: Do this BEFORE removing markdown formatting so we can match the patterns
  const sectionMarkers = [
    // Markdown bold format: **HOOK:** or **HOOK**
    /\*\*HOOK:?\*\*\s*/gim,
    /\*\*BODY:?\*\*\s*/gim,
    /\*\*CLOSING STATEMENT:?\*\*\s*/gim,
    /\*\*CTA:?\*\*\s*/gim,
    /\*\*CLOSING:?\*\*\s*/gim,
    /\*\*STATEMENT:?\*\*\s*/gim,
    // Plain format: HOOK: or HOOK
    /^HOOK:?\s*/gim,
    /^BODY:?\s*/gim,
    /^CLOSING STATEMENT:?\s*/gim,
    /^CTA:?\s*/gim,
    /^CLOSING:?\s*/gim,
    /^STATEMENT:?\s*/gim,
  ];
  
  sectionMarkers.forEach(marker => {
    cleaned = cleaned.replace(marker, '');
  });

  // Remove any remaining markdown bold formatting (**text**)
  // This should only catch formatting that wasn't part of section markers
  cleaned = cleaned.replace(/\*\*/g, '');

  // Clean up extra whitespace - replace multiple spaces/newlines with single space
  // But preserve paragraph breaks (double newlines become single newline)
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  // Replace multiple periods, exclamation marks, or question marks with single ones
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/!{2,}/g, '!');
  cleaned = cleaned.replace(/\?{2,}/g, '?');

  return cleaned;
}

