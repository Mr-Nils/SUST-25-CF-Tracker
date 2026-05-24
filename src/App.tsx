import { useEffect, useState } from "react";
import { FullStudent } from "./types";
import RegistrationForm from "./components/RegistrationForm";
import Leaderboard from "./components/Leaderboard";
import UserProfile from "./components/UserProfile";
import { 
  Trophy, 
  Terminal, 
  Cpu, 
  Users, 
  Zap, 
  RefreshCw, 
  Flame, 
  ShieldCheck, 
  Trash2,
  ExternalLink,
  ChevronRight
} from "lucide-react";

export default function App() {
  const [students, setStudents] = useState<FullStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<FullStudent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stats summaries
  const statsSummary = {
    totalActive: students.length,
    peakRating: students.reduce((max, s) => {
      const r = s.cfData?.rating || 0;
      return r > max ? r : max;
    }, 0),
    topStudent: students.reduce((top: FullStudent | null, s) => {
      if (!top) return s;
      const r_current = s.cfData?.rating || 0;
      const r_top = top.cfData?.rating || 0;
      return r_current > r_top ? s : top;
    }, null),
    expertsCount: students.filter(s => (s.cfData?.rating || 0) >= 1600).length
  };

  // Fetch all students status joined with CF metadata
  const loadStudentsStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cf/users-status");
      if (!response.ok) {
        throw new Error("Failure communicating with SUST CF Proxy server.");
      }
      const data = await response.json();
      setStudents(data);
    } catch (err: any) {
      console.error("[Load Students Status Error]", err);
      setError(err.message || "Failed to parse batch member directories.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Delete/unregister a student
  const handleDeleteStudent = async (handle: string) => {
    if (!confirm(`Are you sure you want to unregister CF handle "${handle}" from SUST 25 workspace database?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${handle}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete student.");
      }

      // Reload
      loadStudentsStatus(true);
      if (selectedStudent?.handle.toLowerCase() === handle.toLowerCase()) {
        setSelectedStudent(null);
      }
    } catch (err: any) {
      alert(`Error unregistering user: ${err.message}`);
    }
  };

  useEffect(() => {
    loadStudentsStatus();
  }, []);

  return (
    <div className="min-h-screen bg-cyber-dark text-gray-100 flex flex-col font-sans relative pb-16 antialiased">
      {/* Dynamic background network grid design elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f23_1px,transparent_1px),linear-gradient(to_bottom,#0f0f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Main glowing cosmic top banner lights */}
      <div className="absolute top-0 left-1/4 right-1/4 h-72 bg-gradient-to-b from-cyber-cyan/10 via-cyber-pink/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Section 1: Dynamic Navigation Headboard banner */}
      <header className="border-b border-gray-900 bg-cyber-dark/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pulsing Codeforces Cyber logo icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-cyber-pink/40 rounded-lg blur-sm animate-pulse"></div>
              <div className="w-10 h-10 bg-cyber-panel border border-cyber-pink/60 rounded-lg flex items-center justify-center relative z-10">
                <Terminal className="w-5 h-5 text-cyber-pink" />
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base md:text-lg font-black tracking-widest text-white uppercase font-mono">
                  Sust <span className="text-cyber-cyan glow-text-cyan">'25</span> Codeforces
                </h1>
                <span className="px-1.5 py-0.5 text-[8px] tracking-widest bg-cyber-pink/10 border border-cyber-pink/40 text-cyber-pink font-semibold rounded font-mono uppercase">
                  BETA V1
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">
                Synchronized Battleground Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="hidden sm:inline text-xs text-gray-500">SYSTEM status: </span>
            <span className="px-2 py-1 rounded bg-[#00ff87]/10 border border-[#00ff87]/30 text-[#00ff87] text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#00ff87] rounded-full animate-ping"></span>
              Live Online
            </span>
          </div>
        </div>
      </header>

      {/* Section 2: Main Outer container */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 flex-grow w-full relative z-10 space-y-8">
        
        {/* Error warning banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-sm font-mono flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadStudentsStatus()}
              className="text-xs text-cyber-cyan underline hover:text-white cursor-pointer"
            >
              [Retry Status Reload]
            </button>
          </div>
        )}

        {/* View switching panel control banner */}
        {selectedStudent ? (
          /* Profile Detail Mode content */
          <UserProfile student={selectedStudent} onBack={() => setSelectedStudent(null)} />
        ) : (
          /* Competitive Dashboard main state: Reg cards + Leaderboard panel */
          <div className="space-y-8">
            
            {/* Statistics Dashboard summary deck overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 font-mono">
              
              {/* Stat Card 1 */}
              <div className="bg-cyber-panel border border-gray-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-cyber-cyan/50 transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyber-cyan to-transparent opacity-30"></div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Total Competitor</span>
                    <span className="text-2xl md:text-3xl font-extrabold text-white mt-1 block">
                      {statsSummary.totalActive}
                    </span>
                  </div>
                  <div className="p-2 bg-cyber-cyan/5 rounded-lg border border-cyber-cyan/20 text-cyber-cyan">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2.5">Registered SUST 25 members</p>
              </div>

              {/* Stat Card 2 */}
              <div className="bg-cyber-panel border border-gray-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-cyber-pink/50 transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyber-pink to-transparent opacity-30"></div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Peak rating</span>
                    <span className="text-2xl md:text-3xl font-extrabold text-[#ff007f] glow-text-pink mt-1 block">
                      {statsSummary.peakRating || "—"}
                    </span>
                  </div>
                  <div className="p-2 bg-cyber-pink/5 rounded-lg border border-cyber-pink/20 text-cyber-pink">
                    <Trophy className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2.5">Highest recorded rating</p>
              </div>

              {/* Stat Card 3 */}
              <div className="bg-cyber-panel border border-gray-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-[#00ff87]/50 transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#00ff87] to-transparent opacity-30"></div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Experts (&gt;=1600)</span>
                    <span className="text-2xl md:text-3xl font-extrabold text-[#00ff87] glow-text-green mt-1 block">
                      {statsSummary.expertsCount}
                    </span>
                  </div>
                  <div className="p-2 bg-green-950/10 rounded-lg border border-[#00ff87]/25 text-[#00ff87]">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2.5">Specialists or higher rank count</p>
              </div>

              {/* Stat Card 4 */}
              <div className="bg-cyber-panel border border-gray-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-cyber-yellow/50 transition-all duration-300">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyber-yellow to-transparent opacity-30"></div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Top Performer</span>
                    <span className="text-sm font-bold text-white mt-2 block truncate max-w-[120px]" title={statsSummary.topStudent?.name || "Nil"}>
                      {statsSummary.topStudent ? statsSummary.topStudent.name : "None yet"}
                    </span>
                  </div>
                  <div className="p-2 bg-cyber-yellow/5 rounded-lg border border-cyber-yellow/20 text-cyber-yellow">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2.5">
                  Leader: {statsSummary.topStudent?.handle ? `${statsSummary.topStudent.handle} (${statsSummary.topStudent.cfData?.rating || 0})` : "—"}
                </p>
              </div>

            </div>

            {/* Dashboard Workspace Segment */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Registration and instruction Panel */}
              <div className="col-span-1 lg:col-span-4 space-y-6">
                
                {/* Registration widget */}
                <RegistrationForm onRegisterSuccess={() => loadStudentsStatus(true)} />

                {/* About and help guidelines cards */}
                <div className="bg-cyber-dark-panel rounded-xl border border-gray-900 p-5 md:p-6 space-y-4 font-mono text-xs text-gray-400">
                   <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                     <Cpu className="w-4 h-4 text-cyber-pink" />
                     CODEFORCES PROXIES
                   </h4>
                   <p className="leading-relaxed">
                     This is a community dashboard built for the <strong className="text-cyber-cyan">SUST Batch '25</strong> computer engineering and programming community. 
                   </p>
                   <ul className="space-y-2 list-disc list-inside text-gray-500">
                     <li>Paste user links directly (e.g. <code className="text-cyber-pink">codeforces.com/profile/tourist</code>)</li>
                     <li>We compile submissions statistics automatically</li>
                     <li>Rating categories update on 5 minute cached segments to satisfy API rate limits</li>
                   </ul>
                   <div className="pt-2 border-t border-gray-900 flex justify-between items-center text-[10px]">
                     <span>Developer: Nilkontha Das</span>
                     <span className="text-cyber-pink">SUST CSE 25</span>
                   </div>
                </div>

              </div>

              {/* Leaderboard Table Grid list */}
              <div className="col-span-1 lg:col-span-8">
                <Leaderboard
                  students={students}
                  isLoading={loading}
                  onSelectStudent={(student) => setSelectedStudent(student)}
                  onDeleteStudent={handleDeleteStudent}
                />
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
