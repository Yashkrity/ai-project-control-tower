import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-indigo-600">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500">
        Go to dashboard
      </Link>
    </div>
  );
}
