import { parse as yamlParse } from 'yaml';

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

export function validateSkillYaml(content: string): ValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yamlParse(content);
  } catch (e) {
    return { valid: false, errors: [`Invalid YAML: ${(e as Error).message}`] };
  }

  const p = parsed as Record<string, unknown>;

  if (!p.id || typeof p.id !== 'string') errors.push('Missing or invalid field: id (string)');
  if (!p.name || typeof p.name !== 'string') errors.push('Missing or invalid field: name (string)');
  if (!p.version || typeof p.version !== 'string') errors.push('Missing or invalid field: version (string)');
  if (!p.triggers || !Array.isArray(p.triggers)) errors.push('Missing or invalid field: triggers (array)');
  if (!p.steps || !Array.isArray(p.steps)) errors.push('Missing or invalid field: steps (array)');

  // Semver-like version check
  if (p.version && typeof p.version === 'string' && !/^\d+\.\d+\.\d+/.test(p.version)) {
    errors.push('version must be semver (e.g. 1.0.0)');
  }

  return { valid: errors.length === 0, errors };
}
