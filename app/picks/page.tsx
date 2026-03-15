import Link from "next/link";
import { getTodayPicks } from "@/lib/db";
import type { PickWithMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default async function PicksPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Today&apos;s top 10 picks</h1>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Home
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      {!error && picks.length === 0 && (
        <p className="text-gray-600">No picks for today yet. Run generation to populate.</p>
      )}

      <ul className="space-y-4">
        {picks.map((p, i) => (
          <li
            key={p.match_id + String(p.pick_date ?? i)}
            className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="font-semibold text-gray-900">
                  #{i + 1} {p.match?.home_team ?? "Home"} v {p.match?.away_team ?? "Away"}
                </p>
                <p className="text-sm text-gray-500">{p.match?.league ?? "—"}</p>
                <p className="text-sm text-gray-600 mt-1">{formatTime(p.match?.start_time)}</p>
              </div>
              <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 text-sm font-medium shrink-0">
                {p.predicted_outcome}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <dt className="text-gray-500">Win probability</dt>
                <dd className="font-medium">{(p.win_probability * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Draw risk</dt>
                <dd className="font-medium">{(p.draw_risk * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Upset risk</dt>
                <dd className="font-medium">{(p.upset_risk * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Confidence</dt>
                <dd className="font-medium">{p.confidence_score}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}
