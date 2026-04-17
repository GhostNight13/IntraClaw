import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IntraClaw — The AI agent that improves itself while you sleep',
  description:
    'A self-improving autonomous AI agent. Multi-channel, private memory, open-source core. For solopreneurs, agencies and creators.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-white antialiased">
      {children}
    </div>
  );
}
