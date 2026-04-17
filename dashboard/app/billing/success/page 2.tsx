'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function BillingSuccessPage(): React.ReactElement {
  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-slate-800 border border-emerald-700 rounded-xl p-8 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white">Subscription activated</h1>
        <p className="text-slate-400">
          Thanks for upgrading IntraClaw. Your new tier is being provisioned — it usually
          takes only a few seconds for the webhook to update your account.
        </p>
        <Link
          href="/billing"
          className="inline-block mt-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium"
        >
          Back to billing
        </Link>
      </div>
    </div>
  );
}
