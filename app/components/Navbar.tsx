import DarkModeToggle from '@/app/components/DarkModeToggle';

export default function Navbar(): JSX.Element {
  return (
    <nav className="sticky top-0 z-40 w-full backdrop-blur bg-black/30 border-b border-slate-700/40">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-glass" />
          <div className="font-semibold tracking-wide">
            VC Bitstring Status List
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#overview">Overview</a>
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#initiation">Initiation</a>
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#crypto">Crypto</a>
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#bitgrid">BitGrid</a>
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#timeline">Timeline</a>
          <a className="px-3 py-2 rounded-md hover:bg-slate-800/60" href="#manual">Manual</a>
          <DarkModeToggle />
        </div>
      </div>
    </nav>
  );
}