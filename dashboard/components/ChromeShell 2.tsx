'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { PWAInstall } from '@/components/PWAInstall';

const PUBLIC_PREFIXES = ['/auth'];
// Routes where chrome (sidebar/mobilenav) is hidden — marketing landing.
const MARKETING_ROUTES = new Set<string>(['/']);

export function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isMarketing = MARKETING_ROUTES.has(pathname);
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const hideChrome = isMarketing || isPublic;

  if (hideChrome) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      <MobileNav />
      <PWAInstall />
    </>
  );
}
