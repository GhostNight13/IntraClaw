/**
 * MODULE 1 — Computer Use
 * Contrôle macOS natif : screenshot, clic, frappe, AppleScript, apps.
 *
 * Dépendances macOS natives (toujours présentes) :
 *   screencapture  — capture écran
 *   osascript      — AppleScript / JXA
 *
 * Dépendance optionnelle (brew install cliclick) :
 *   cliclick       — clic souris précis par coordonnées pixel
 *
 * Règles :
 *   - Jamais de Keychain, mots de passe, ou System Preferences sensibles
 *   - Jamais d'accès à des fichiers hors du projet sans approbation
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenshotResult {
  success: boolean;
  path?: string;       // absolute path of the saved PNG
  base64?: string;     // base64-encoded PNG (if returnBase64 = true)
  error?: string;
}

export interface ClickResult {
  success: boolean;
  error?: string;
}

export interface TypeResult {
  success: boolean;
  error?: string;
}

export interface AppResult {
  success: boolean;
  error?: string;
}

export interface ScriptResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ScreenBounds {
  width: number;
  height: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'data', 'screenshots');

function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

/**
 * Capture the entire screen (or a specific window).
 * @param returnBase64  If true, also return the image as base64.
 * @param filename      Optional filename override (defaults to timestamp).
 */
export async function takeScreenshot(
  returnBase64 = false,
  filename?: string
): Promise<ScreenshotResult> {
  ensureScreenshotDir();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const name = filename ?? `screenshot-${ts}.png`;
  const dest = path.join(SCREENSHOT_DIR, name);

  try {
    // -x: no sound, -t 0: no delay
    await execAsync(`/usr/sbin/screencapture -x -t png "${dest}"`);

    logger.info('ComputerUse', `Screenshot saved: ${dest}`);

    if (returnBase64) {
      const buf = fs.readFileSync(dest);
      return { success: true, path: dest, base64: buf.toString('base64') };
    }

    return { success: true, path: dest };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'takeScreenshot failed', error);
    return { success: false, error };
  }
}

/**
 * Capture a region of the screen.
 * @param x, y       Top-left corner in pixels
 * @param w, h       Width and height in pixels
 */
export async function takeRegionScreenshot(
  x: number, y: number, w: number, h: number,
  returnBase64 = false,
  filename?: string
): Promise<ScreenshotResult> {
  ensureScreenshotDir();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const name = filename ?? `region-${ts}.png`;
  const dest = path.join(SCREENSHOT_DIR, name);

  try {
    await execAsync(`/usr/sbin/screencapture -x -t png -R ${x},${y},${w},${h} "${dest}"`);
    logger.info('ComputerUse', `Region screenshot saved: ${dest} [${x},${y} ${w}x${h}]`);

    if (returnBase64) {
      const buf = fs.readFileSync(dest);
      return { success: true, path: dest, base64: buf.toString('base64') };
    }

    return { success: true, path: dest };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'takeRegionScreenshot failed', error);
    return { success: false, error };
  }
}

// ─── Mouse clicks ─────────────────────────────────────────────────────────────

/**
 * Click at pixel coordinates using cliclick (brew install cliclick).
 * Falls back to osascript click if cliclick is not installed.
 */
export async function clickAt(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<ClickResult> {
  try {
    // Try cliclick first
    const cmd = button === 'right'
      ? `cliclick rc:${x},${y}`
      : `cliclick c:${x},${y}`;
    await execAsync(cmd);
    logger.info('ComputerUse', `Click at (${x}, ${y}) [${button}] via cliclick`);
    return { success: true };
  } catch {
    // Fallback: osascript
    try {
      const btnNum = button === 'right' ? 2 : 1;
      const script = `
        tell application "System Events"
          click at {${x}, ${y}} buttons {${btnNum}}
        end tell
      `;
      await runAppleScript(script);
      logger.info('ComputerUse', `Click at (${x}, ${y}) [${button}] via osascript`);
      return { success: true };
    } catch (err2) {
      const error = err2 instanceof Error ? err2.message : String(err2);
      logger.error('ComputerUse', 'clickAt failed', error);
      return { success: false, error };
    }
  }
}

/**
 * Double-click at pixel coordinates.
 */
export async function doubleClickAt(x: number, y: number): Promise<ClickResult> {
  try {
    await execAsync(`cliclick dc:${x},${y}`);
    logger.info('ComputerUse', `Double-click at (${x}, ${y})`);
    return { success: true };
  } catch {
    try {
      const script = `
        tell application "System Events"
          double click at {${x}, ${y}}
        end tell
      `;
      await runAppleScript(script);
      return { success: true };
    } catch (err2) {
      const error = err2 instanceof Error ? err2.message : String(err2);
      return { success: false, error };
    }
  }
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

/**
 * Type text into the currently focused element.
 */
export async function typeText(text: string): Promise<TypeResult> {
  try {
    // Escape for AppleScript: backslash and double-quote
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
      tell application "System Events"
        keystroke "${escaped}"
      end tell
    `;
    await runAppleScript(script);
    logger.info('ComputerUse', `Typed ${text.length} characters`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'typeText failed', error);
    return { success: false, error };
  }
}

/**
 * Press a key combination (e.g. "command down, c, command up" for ⌘C).
 * Uses AppleScript keystroke syntax.
 * @param key       e.g. 'c', 'return', 'tab', 'escape'
 * @param modifiers e.g. ['command'], ['command', 'shift']
 */
export async function pressKey(key: string, modifiers: string[] = []): Promise<TypeResult> {
  try {
    const mods = modifiers.length > 0
      ? ` using {${modifiers.map(m => `${m} down`).join(', ')}}`
      : '';

    const isSpecial = ['return', 'tab', 'escape', 'space', 'delete', 'up arrow', 'down arrow', 'left arrow', 'right arrow', 'home', 'end', 'page up', 'page down'].includes(key.toLowerCase());

    const script = isSpecial
      ? `tell application "System Events" to key code (${keyNameToCode(key)})${mods}`
      : `tell application "System Events" to keystroke "${key}"${mods}`;

    await runAppleScript(script);
    logger.info('ComputerUse', `Key press: ${modifiers.join('+')}+${key}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'pressKey failed', error);
    return { success: false, error };
  }
}

// AppleScript key codes for special keys
function keyNameToCode(name: string): number {
  const codes: Record<string, number> = {
    'return': 36, 'tab': 48, 'space': 49, 'delete': 51, 'escape': 53,
    'up arrow': 126, 'down arrow': 125, 'left arrow': 123, 'right arrow': 124,
    'home': 115, 'end': 119, 'page up': 116, 'page down': 121,
  };
  return codes[name.toLowerCase()] ?? 0;
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

/**
 * Open an application by name.
 */
export async function openApp(appName: string): Promise<AppResult> {
  try {
    await execAsync(`open -a "${appName}"`);
    logger.info('ComputerUse', `Opened app: ${appName}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', `openApp failed: ${appName}`, error);
    return { success: false, error };
  }
}

/**
 * Quit an application by name.
 */
export async function closeApp(appName: string): Promise<AppResult> {
  try {
    await execAsync(`osascript -e 'quit app "${appName}"'`);
    logger.info('ComputerUse', `Closed app: ${appName}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', `closeApp failed: ${appName}`, error);
    return { success: false, error };
  }
}

/**
 * Bring an application to the foreground.
 */
export async function focusApp(appName: string): Promise<AppResult> {
  try {
    const script = `tell application "${appName}" to activate`;
    await runAppleScript(script);
    logger.info('ComputerUse', `Focused app: ${appName}`);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Get a list of running application names.
 */
export async function getRunningApps(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`
    );
    return stdout.trim().split(', ').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── AppleScript / JXA ───────────────────────────────────────────────────────

/**
 * Run arbitrary AppleScript code.
 * Returns stdout output (trimmed).
 */
export async function runAppleScript(script: string): Promise<ScriptResult> {
  try {
    const { stdout, stderr } = await execAsync(
      `osascript -e '${script.replace(/'/g, "'\\''")}'`
    );
    if (stderr && stderr.trim()) {
      logger.warn('ComputerUse', 'AppleScript stderr', stderr.trim());
    }
    return { success: true, output: stdout.trim() };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'runAppleScript failed', error);
    return { success: false, error };
  }
}

/**
 * Run AppleScript from a multi-line string (uses temp file to avoid quoting issues).
 */
export async function runAppleScriptFile(script: string): Promise<ScriptResult> {
  const tmpPath = path.join(SCREENSHOT_DIR, `__tmp_${Date.now()}.applescript`);
  ensureScreenshotDir();
  try {
    fs.writeFileSync(tmpPath, script, 'utf8');
    const { stdout, stderr } = await execAsync(`osascript "${tmpPath}"`);
    if (stderr && stderr.trim()) {
      logger.warn('ComputerUse', 'AppleScript stderr', stderr.trim());
    }
    return { success: true, output: stdout.trim() };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('ComputerUse', 'runAppleScriptFile failed', error);
    return { success: false, error };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* cleanup */ }
  }
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

/**
 * Get current clipboard text content.
 */
export async function getClipboard(): Promise<string> {
  try {
    const { stdout } = await execAsync('pbpaste');
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Set clipboard to given text.
 */
export async function setClipboard(text: string): Promise<void> {
  try {
    await execAsync(`echo ${JSON.stringify(text)} | pbcopy`);
  } catch (err) {
    logger.warn('ComputerUse', 'setClipboard failed', err instanceof Error ? err.message : err);
  }
}

// ─── Screen info ──────────────────────────────────────────────────────────────

/**
 * Get the primary screen resolution.
 */
export async function getScreenBounds(): Promise<ScreenBounds> {
  try {
    const script = `
      tell application "Finder"
        get bounds of window of desktop
      end tell
    `;
    const result = await runAppleScriptFile(script);
    if (result.output) {
      const parts = result.output.split(',').map(s => parseInt(s.trim(), 10));
      if (parts.length === 4) {
        return { width: parts[2]!, height: parts[3]! };
      }
    }
  } catch { /* fallback */ }
  return { width: 1920, height: 1080 }; // sensible default
}

/**
 * Show a notification in macOS Notification Center.
 */
export async function showNotification(title: string, message: string, sound = false): Promise<void> {
  try {
    const soundPart = sound ? 'sound name "default"' : '';
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" ${soundPart}`;
    await execAsync(`osascript -e '${script}'`);
  } catch { /* non-blocking */ }
}
