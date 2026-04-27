import { Info } from 'lucide-react';

export default function BlamelessBanner() {
  return (
    <div className="bg-blue-50 text-blue-900 ring-1 ring-blue-100 rounded-lg px-3.5 py-2 text-[13px] mb-5 flex items-start gap-2">
      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" aria-hidden />
      <span>This is a blameless review. Names appear only to anchor the timeline.</span>
    </div>
  );
}
