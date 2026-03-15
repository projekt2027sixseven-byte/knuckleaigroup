import Link from "next/link";
import { getTodayPicks } from "@/lib/db";
import type { PickWithMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let picks: PickWithMatch[] = [];
  let error: string | null = null;
  try {
    picks = await getTodayPicks();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Home
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <a
          href="/api/generate-picks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm font-medium"
        >
          Regenerate picks
        </a>
        <p className="mt-2 text-sm text-gray-500">
          Opens /api/generate-picks in a new tab to fetch, score, and save today&apos;s top 10.
        </p>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-2">Raw picks</h2>
      <pre className="p-4 bg-gray-100 rounded overflow-auto text-xs text-gray-800 border border-gray-200">
        {JSON.stringify(picks, null, 2)}
      </pre>
    </main>
  );
}
