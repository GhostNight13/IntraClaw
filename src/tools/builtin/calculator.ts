// src/tools/builtin/calculator.ts
// Safe math expression evaluator — no eval(), uses a simple parser
import type { ToolDefinition, ToolResult } from './types';

// ─── Tokenizer & Parser (Pratt-style, safe — no eval) ───────────────────────

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.eE\-+]/.test(expr[i])) {
        // Handle negative exponent (e.g., 1e-5)
        if ((expr[i] === '-' || expr[i] === '+') && num.length > 0 && !/[eE]/.test(num[num.length - 1])) break;
        num += expr[i++];
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if ('+-*/%^'.includes(ch)) {
      // Unary minus: prefix - treated as negative number
      if (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1].type === 'op' || (tokens[tokens.length - 1].type === 'paren' && tokens[tokens.length - 1].value === '('))) {
        let num = '-';
        i++;
        while (i < expr.length && /[0-9.eE]/.test(expr[i])) num += expr[i++];
        tokens.push({ type: 'num', value: parseFloat(num) });
        continue;
      }
      tokens.push({ type: 'op', value: ch }); i++; continue;
    }
    if ('()'.includes(ch)) { tokens.push({ type: 'paren', value: ch }); i++; continue; }
    // Math function names (sqrt, sin, cos, etc.)
    const funcMatch = expr.slice(i).match(/^(sqrt|sin|cos|tan|log|ln|abs|ceil|floor|round|pow|min|max|pi|e)\b/i);
    if (funcMatch) {
      const fname = funcMatch[1].toLowerCase();
      if (fname === 'pi') { tokens.push({ type: 'num', value: Math.PI }); }
      else if (fname === 'e') { tokens.push({ type: 'num', value: Math.E }); }
      else { tokens.push({ type: 'op', value: fname }); }
      i += funcMatch[1].length;
      continue;
    }
    throw new Error(`Unexpected character: ${ch} at position ${i}`);
  }
  return tokens;
}

function evaluate(tokens: Token[]): number {
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function consume(): Token { return tokens[pos++]; }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek()?.type === 'op' && ('*/%'.includes(String(peek()!.value)))) {
      const op = consume().value;
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') { if (right === 0) throw new Error('Division by zero'); left /= right; }
      else left %= right;
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    if (peek()?.type === 'op' && peek()!.value === '^') {
      consume();
      const exp = parsePower(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    // Handle math functions
    if (peek()?.type === 'op' && typeof peek()!.value === 'string' && /^[a-z]/.test(String(peek()!.value))) {
      const fname = consume().value;
      // Expect parenthesized arg(s)
      if (peek()?.type !== 'paren' || peek()!.value !== '(') {
        throw new Error(`Expected ( after ${fname}`);
      }
      consume(); // (
      const arg = parseExpr();
      let arg2: number | undefined;
      if (peek()?.type === 'op' && peek()!.value === ',') {
        consume(); // skip comma — not in our token set, handle as workaround
      }
      // For two-arg functions we'd need commas; keep it simple for now
      if (peek()?.type !== 'paren' || peek()!.value !== ')') {
        throw new Error(`Expected ) after ${fname}(${arg}`);
      }
      consume(); // )

      switch (fname) {
        case 'sqrt':  return Math.sqrt(arg);
        case 'sin':   return Math.sin(arg);
        case 'cos':   return Math.cos(arg);
        case 'tan':   return Math.tan(arg);
        case 'log':   return Math.log10(arg);
        case 'ln':    return Math.log(arg);
        case 'abs':   return Math.abs(arg);
        case 'ceil':  return Math.ceil(arg);
        case 'floor': return Math.floor(arg);
        case 'round': return Math.round(arg);
        case 'pow':   return Math.pow(arg, arg2 ?? 2);
        default:      throw new Error(`Unknown function: ${fname}`);
      }
    }

    return parseAtom();
  }

  function parseAtom(): number {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'num') { consume(); return t.value; }
    if (t.type === 'paren' && t.value === '(') {
      consume();
      const val = parseExpr();
      if (peek()?.type !== 'paren' || peek()!.value !== ')') throw new Error('Missing closing )');
      consume();
      return val;
    }
    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected token after expression: ${JSON.stringify(tokens[pos])}`);
  return result;
}

export const toolDefinition: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions safely. Supports +, -, *, /, %, ^, parentheses, and functions (sqrt, sin, cos, tan, log, ln, abs, ceil, floor, round, pi, e).',
  parameters: {
    expression: { type: 'string', description: 'Math expression to evaluate, e.g. "sqrt(144) + 3^2"', required: true },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const expression = params.expression as string | undefined;
    if (!expression || typeof expression !== 'string') {
      return { success: false, error: 'Missing required parameter: expression' };
    }

    try {
      const tokens = tokenize(expression);
      const result = evaluate(tokens);
      if (!isFinite(result)) {
        return { success: false, error: `Result is ${result} (not finite)` };
      }
      return { success: true, data: { expression, result } };
    } catch (err) {
      return { success: false, error: `Eval error: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};
