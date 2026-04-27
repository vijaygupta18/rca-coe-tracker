import { Link } from 'react-router-dom';
import { FileSearch } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
          <FileSearch className="w-6 h-6 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Page not found</h1>
        <p className="text-[13px] text-slate-500 mt-2">
          We couldn't find what you were looking for.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Go to RCAs
        </Link>
      </div>
    </div>
  );
}
