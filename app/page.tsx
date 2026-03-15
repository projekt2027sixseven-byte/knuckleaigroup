import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">KnuckleAIGroup</h1>
      <p className="text-gray-700 mb-8">
        Daily football picks from a transparent rule-based scoring engine.
      </p>
      <nav className="flex flex-col gap-3">
        <Link
          href="/picks"
          className="text-blue-600 hover:underline font-medium"
        >
          View today&apos;s picks →
        </Link>
        <Link
          href="/api/generate-picks"
          className="text-gray-600 hover:underline text-sm"
        >
          Generate picks (API)
        </Link>
      </nav>
    </main>
  );
}
