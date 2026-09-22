import { parseSignature, validateSignature, getStoredSignature } from './signatureParser.js';
import { composeProgram } from './wrapperGenerator.js';
import { executionService } from './executionService.js';
import { generateStarterCode, composeStarterFile } from './languageTemplates.js';

const CATEGORY_VALUES = [
  'Array', 'String', 'Matrix', 'Linked List', 'Binary Tree', 'Graph', 'Stack', 'Queue', 'Heap', 'HashMap', 'Sorting', 'Searching', 'Dynamic Programming', 'Greedy', 'Backtracking', 'Bit Manipulation', 'Math', 'Custom'
];

const DIFFICULTY_MAP = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeTestCases(testCases) {
  return (Array.isArray(testCases) ? testCases : [])
    .filter((tc) => tc && (tc.input || tc.expectedOutput))
    .map((tc) => ({
      input: String(tc.input || '').trim(),
      expectedOutput: String(tc.expectedOutput || '').trim(),
      description: tc.description || '',
      isHidden: Boolean(tc.isHidden),
    }));
}

export function normalizeChallengePayload(payload) {
  const source = payload || {};
  const functionSignatures = source.functionSignatures || source.functionSignature || {};
  const referenceSolutions = source.referenceSolutions || source.referenceSolution || {};
  const starterCodes = source.starterCodes || source.starterCode || {};

  const normalized = {
    title: String(source.title || '').trim(),
    slug: slugify(source.slug || source.title || ''),
    difficulty: DIFFICULTY_MAP[String(source.difficulty || 'MEDIUM').toLowerCase()] || 'MEDIUM',
    category: CATEGORY_VALUES.includes(source.category) ? source.category : 'Custom',
    description: String(source.description || '').trim(),
    constraints: String(source.constraints || '').trim(),
    examples: Array.isArray(source.examples) ? source.examples.map((ex) => ({
      input: String(ex?.input || ''),
      output: String(ex?.output || ''),
      explanation: String(ex?.explanation || ''),
    })) : [],
    functionSignatures: Object.fromEntries(
      Object.entries(functionSignatures).filter(([, value]) => Boolean(value)).map(([lang, value]) => [lang, String(value)])
    ),
    starterCodes: Object.fromEntries(
      Object.entries(starterCodes).filter(([, value]) => Boolean(value)).map(([lang, value]) => [lang, String(value)])
    ),
    referenceSolutions: Object.fromEntries(
      Object.entries(referenceSolutions).filter(([, value]) => Boolean(value)).map(([lang, value]) => [lang, String(value)])
    ),
    visibleTestCases: normalizeTestCases(source.visibleTestCases || source.testCases || []),
    hiddenTestCases: normalizeTestCases(source.hiddenTestCases || []),
    createdBy: source.createdBy || null,
  };

  // Parse and store structured signature metadata from the first available signature.
  const sigEntries = Object.entries(normalized.functionSignatures);
  if (sigEntries.length > 0) {
    const firstSig = sigEntries[0][1];
    const sigResult = validateSignature(firstSig);
    if (sigResult.valid) {
      normalized.signature = sigResult.parsed;
    }
  } else if (source.signature && source.signature.name) {
    normalized.signature = getStoredSignature(source.signature);
  }

  if (!normalized.functionSignatures.java && !normalized.functionSignatures.python && !normalized.functionSignatures.cpp && !normalized.functionSignatures.c && !normalized.functionSignatures.javascript) {
    normalized.functionSignatures = {};
  }
  if (Object.keys(normalized.functionSignatures).length === 0 && source.functionSignature) {
    normalized.functionSignatures = { java: String(source.functionSignature) };
  }

  return normalized;
}

export function validateChallengePayload(challenge) {
  const errors = [];
  const payload = challenge || {};

  if (!payload.title || !payload.title.trim()) errors.push('Problem title is required.');
  if (!payload.description || !payload.description.trim()) errors.push('Problem description is required.');
  if (!payload.difficulty) errors.push('Difficulty is required.');
  if (!payload.category) errors.push('Category is required.');

  if (!payload.visibleTestCases || payload.visibleTestCases.length === 0) {
    errors.push('At least one visible test case is required.');
  }
  if (!payload.hiddenTestCases || payload.hiddenTestCases.length === 0) {
    errors.push('At least one hidden test case is required.');
  }

  const signatureEntries = Object.entries(payload.functionSignatures || {});
  if (signatureEntries.length === 0) {
    errors.push('At least one function signature is required.');
  } else {
    for (const [lang, signature] of signatureEntries) {
      const validation = validateSignature(signature);
      if (!validation.valid) {
        errors.push(`Invalid signature for ${lang}: ${validation.error}`);
      }
    }
  }

  if (!payload.referenceSolutions || Object.keys(payload.referenceSolutions).length === 0) {
    errors.push('A reference solution is required.');
  }

  const slug = slugify(payload.slug || payload.title || '');
  if (!slug) errors.push('A valid slug is required.');

  return { valid: errors.length === 0, errors, slug };
}

export async function previewChallengeExecution(challenge, language = 'java') {
  const payload = challenge || {};
  const signatures = payload.functionSignatures || {};
  const refSolution = (payload.referenceSolutions || {})[language] || (payload.referenceSolutions || {})[Object.keys(payload.referenceSolutions || {})[0]];
  const signature = signatures[language] || signatures[Object.keys(signatures)[0]];

  if (!signature || !refSolution) {
    throw new Error('A reference solution and function signature are required for preview.');
  }

  // Use stored structured signature if available, otherwise parse the raw string.
  const parsed = payload.signature?.name ? getStoredSignature(payload.signature) : parseSignature(signature);
  const testCases = [...(payload.visibleTestCases || []), ...(payload.hiddenTestCases || [])];
  const program = composeProgram({ signature: parsed }, refSolution, language, { isFullProgram: true, forReferenceSolution: true });
  const result = await executionService.execute(program, testCases, language, { timeLimit: 2000, memoryLimit: 65536 });
  return result;
}

/**
 * Generate fresh starter code for a challenge.
 * Uses the stored structured signature. Never persists generated code.
 */
export function generateStarterCodeForChallenge(challenge) {
  const payload = challenge || {};

  // Prefer structured signature.
  if (payload.signature && payload.signature.name) {
    const sig = getStoredSignature(payload.signature);
    const result = {};
    const languages = ['java', 'python', 'cpp', 'c'];
    for (const lang of languages) {
      result[lang] = composeStarterFile(sig, lang);
    }
    return result;
  }

  // Fallback: parse raw signatures.
  const signatures = payload.functionSignatures || {};
  const languageEntries = Object.entries(signatures);
  if (languageEntries.length === 0) {
    return {};
  }

  const starterCodes = {};
  for (const [lang, sigStr] of languageEntries) {
    const parsed = parseSignature(sigStr);
    starterCodes[lang] = generateStarterCode(parsed, lang);
  }
  return starterCodes;
}

export default {
  normalizeChallengePayload,
  validateChallengePayload,
  previewChallengeExecution,
  generateStarterCodeForChallenge,
};
