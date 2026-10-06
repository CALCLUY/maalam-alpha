import { lazy, Suspense } from "react";

// The full "Maalam" application lives in ./darija. It is loaded lazily so the
// first paint is instant, exactly like the original Next.js page did with
// `dynamic(..., { ssr: false })`.
const DarijaApp = lazy(() => import("./darija/App"));

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0e] text-zinc-400">
      <div className="flex flex-col items-center gap-4">
        <div className="maalam-logo h-14 w-14 text-3xl" aria-hidden="true">
          <span>م</span>
        </div>
        <p className="text-sm tracking-wide">كنحمّلو Maalam…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <DarijaApp />
    </Suspense>
  );
}
