import { JobNumberSettings } from "@construction/shared";

/**
 * Generate the next job number based on template and settings.
 * Supports date tokens and sequential numbering with automatic reset detection.
 *
 * Template tokens:
 * - {YYYY} - 4-digit year (2026)
 * - {YY} - 2-digit year (26)
 * - {MM} - 2-digit month (01-12)
 * - {DD} - 2-digit day (01-31)
 * - {NNN...} - Sequential number (length based on N count)
 *
 * @param settings - Job number configuration
 * @returns Object with generated job number and updated settings
 */
export function generateJobNumber(settings: JobNumberSettings): {
  jobNumber: string;
  updatedSettings: JobNumberSettings;
} {
  if (!settings.enabled) {
    throw new Error("Job numbers are not enabled");
  }

  const now = new Date();

  // Replace date tokens with current values
  let format = settings.template
    .replace(/{YYYY}/g, now.getFullYear().toString())
    .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
    .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"))
    .replace(/{DD}/g, now.getDate().toString().padStart(2, "0"));

  // Extract sequence pattern {NNN...}
  const sequenceMatch = format.match(/\{(N+)\}/);
  if (!sequenceMatch) {
    throw new Error("Template must contain at least one {N} sequence pattern");
  }

  const sequenceLength = sequenceMatch[1].length;

  // Check if format has changed (indicates reset needed)
  const formatChanged =
    settings.lastGeneratedFormat !== null &&
    settings.lastGeneratedFormat !== format.replace(/\{N+\}/, "");

  // Reset sequence if format changed (e.g., year changed from 26 to 27)
  // Uses configured startingSequenceNumber (defaults to 1 for backward compatibility)
  const sequenceNumber = formatChanged
    ? (settings.startingSequenceNumber ?? 1)
    : settings.nextSequenceNumber;

  // Pad sequence number with zeros
  const paddedSequence = sequenceNumber.toString().padStart(sequenceLength, "0");

  // Replace sequence pattern with actual number
  const jobNumber = format.replace(/\{N+\}/, paddedSequence);

  // Store the format (without {N}) for next comparison
  const currentFormat = format.replace(/\{N+\}/, "");

  return {
    jobNumber,
    updatedSettings: {
      ...settings,
      nextSequenceNumber: sequenceNumber + 1,
      lastGeneratedFormat: currentFormat,
    },
  };
}

/**
 * Parse a template to extract expected pattern for validation.
 * Used to validate manually-entered job numbers.
 */
export function parseTemplatePattern(template: string): RegExp {
  // Escape special regex characters
  let pattern = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\{YYYY\\}/g, "\\d{4}")
    .replace(/\\{YY\\}/g, "\\d{2}")
    .replace(/\\{MM\\}/g, "\\d{2}")
    .replace(/\\{DD\\}/g, "\\d{2}");

  // Match sequence pattern {NNN...}
  const sequenceMatch = template.match(/\{(N+)\}/);
  if (sequenceMatch) {
    const length = sequenceMatch[1].length;
    pattern = pattern.replace(/\\{N+\\}/, `\\d{${length}}`);
  }

  return new RegExp(`^${pattern}$`);
}

/**
 * Validate a job number matches the template format.
 * Used when manually entering/editing job numbers.
 */
export function validateJobNumberFormat(
  jobNumber: string,
  template: string
): boolean {
  const pattern = parseTemplatePattern(template);
  return pattern.test(jobNumber);
}

/**
 * Generate preview example for template.
 * Used in settings UI to show what job numbers will look like.
 */
export function previewJobNumber(
  template: string,
  sequenceNumber: number = 1
): string {
  const now = new Date();

  let preview = template
    .replace(/{YYYY}/g, now.getFullYear().toString())
    .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
    .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"))
    .replace(/{DD}/g, now.getDate().toString().padStart(2, "0"));

  const sequenceMatch = preview.match(/\{(N+)\}/);
  if (sequenceMatch) {
    const length = sequenceMatch[1].length;
    const paddedSequence = sequenceNumber.toString().padStart(length, "0");
    preview = preview.replace(/\{N+\}/, paddedSequence);
  }

  return preview;
}
