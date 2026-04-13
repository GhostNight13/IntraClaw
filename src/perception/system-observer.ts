// src/perception/system-observer.ts
import * as si from 'systeminformation';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface SystemSnapshot {
  cpuUsage: number;
  batteryLevel: number;
  activeApp: string;
  isUserActive: boolean;
  hour: number;
  dayOfWeek: number;
  isBusinessDay: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

function getTimeOfDay(hour: number): SystemSnapshot['timeOfDay'] {
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function isBrusselsBusinessDay(): boolean {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
  const day = now.getDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

function getActiveApp(): string {
  try {
    const script = 'tell application "System Events" to get name of first process whose frontmost is true';
    return execSync(`osascript -e '${script}'`, { timeout: 2000 }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function isUserActive(): boolean {
  try {
    const output = execSync(
      'ioreg -c IOHIDSystem | awk \'/HIDIdleTime/{print $NF/1000000000; exit}\'',
      { timeout: 2000 }
    ).toString().trim();
    const idleSeconds = parseFloat(output);
    return idleSeconds < 300; // < 5 minutes
  } catch {
    return true; // Assume active if check fails
  }
}

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  try {
    const [cpuData, batteryData] = await Promise.all([
      si.currentLoad(),
      si.battery(),
    ]);

    const nowBrussels = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
    );
    const hour = nowBrussels.getHours();
    const dayOfWeek = nowBrussels.getDay();

    return {
      cpuUsage:      Math.round(cpuData.currentLoad),
      batteryLevel:  batteryData.hasBattery ? Math.round(batteryData.percent) : -1,
      activeApp:     getActiveApp(),
      isUserActive:  isUserActive(),
      hour,
      dayOfWeek,
      isBusinessDay: isBrusselsBusinessDay(),
      timeOfDay:     getTimeOfDay(hour),
    };
  } catch (err) {
    logger.warn('SystemObserver', 'Failed to get system snapshot', err instanceof Error ? err.message : err);
    const nowBrussels = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
    );
    const hour = nowBrussels.getHours();
    return {
      cpuUsage:      0,
      batteryLevel:  -1,
      activeApp:     'unknown',
      isUserActive:  true,
      hour,
      dayOfWeek:     nowBrussels.getDay(),
      isBusinessDay: isBrusselsBusinessDay(),
      timeOfDay:     getTimeOfDay(hour),
    };
  }
}
