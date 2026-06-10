import React, { useEffect, useState } from "react";
import { FullStudent } from "./types";
import RegistrationForm from "./components/RegistrationForm";
import Leaderboard from "./components/Leaderboard";
import UserProfile from "./components/UserProfile";
import { cfGetUserInfo } from "./cfApi";
import { 
  Trophy, 
  Terminal, 
  Cpu, 
  Users, 
  Zap, 
  RefreshCw, 
  Flame, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2,
  ExternalLink,
  ChevronRight,
  Sun,
  Moon
} from "lucide-react";

export default function App() {
  const [students, setStudents] = useState<FullStudent[]>([]);
  const [cfApiStatus, setCfApiStatus] = useState<"checking" | "online" | "degraded" | "offline">("checking");
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<FullStudent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("app_theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  // Creator state
  const [isCreator, setIsCreator] = useState<boolean>(() => {
    return localStorage.getItem("is_creator_mode") === "true";
  });
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorInput, setCreatorInput] = useState("");
  const [creatorError, setCreatorError] = useState<string | null>(null);

  // Custom non-blocking modal states (iframe safe)
  const [confirmModal, setConfirmModal] = useState<{ title: string; subtitle: string; onConfirm: () => void } | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const handleCreatorToggle = () => {
    if (isCreator) {
      localStorage.removeItem("is_creator_mode");
      localStorage.removeItem("creator_password");
      setIsCreator(false);
    } else {
      setShowCreatorModal(true);
    }
  };

  const handleVerifyCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorInput.trim()) {
      setCreatorError("Please enter the Creator Password.");
      return;
    }
    setCreatorError(null);
    try {
      const response = await fetch("/api/auth/verify-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: creatorInput.trim() }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Access Denied: Invalid Creator Verification Code/Password.");
      }
      localStorage.setItem("is_creator_mode", "true");
      localStorage.setItem("creator_password", creatorInput.trim());
      setIsCreator(true);
      setShowCreatorModal(false);
      setCreatorInput("");
    } catch (err: any) {
      setCreatorError(err.message || "Access Denied: Invalid Creator Verification Code.");
    }
  };

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

  // Fetch all students status joined with CF metadata (with automatic client-assisted rate-limit self-healing)
  const loadStudentsStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cf/users-status");
      if (!response.ok) {
        throw new Error("Failure communicating with SUST CF Proxy server.");
      }
      const data: FullStudent[] = await response.json();
      
      // Set the initial list immediately using whatever server/database cached state is available
      setStudents(data);

      // Initiate asynchronous client-side direct Codeforces fetch to bypass server IP rate limits (Cloudflare or CORS restrictions)
      const handles = data.map((s: any) => s.handle).filter(Boolean);
      if (handles.length > 0) {
        // Run in the background without blocking the UI
        (async () => {
          let activeHandles = [...handles];
          let results: any[] = [];
          let fetchSuccess = false;
          let attempts = 0;
          const maxAttempts = 5;

          while (activeHandles.length > 0 && !fetchSuccess && attempts < maxAttempts) {
            attempts++;
            try {
              console.log(`[Client CF Direct Query (JSONP)] Fetching ${activeHandles.length} handles...`);
              const cfResult = await cfGetUserInfo(activeHandles);
              results = cfResult;
              fetchSuccess = true;
              setCfApiStatus("online");
            } catch (cfErr: any) {
              console.warn(`[Client CF API Direct Fetch Exception on attempt ${attempts}]:`, cfErr.message || cfErr);
              
              const errMsg = cfErr.message || String(cfErr);
              if (errMsg.includes("Call limit exceeded") || errMsg.includes("limit")) {
                setCfApiStatus("degraded");
              }
              // Handle bad handles by parsing the failure comment if available
              const match = errMsg.match(/User with handle (.*?) not found/i);
              if (match && match[1]) {
                const badHandle = match[1].trim().toLowerCase();
                activeHandles = activeHandles.filter(h => h.toLowerCase() !== badHandle);
                console.log(`[Client CF Direct Query Self-Healing] Pruned bad handle "${badHandle}" from active query list.`);
              } else {
                // If it's a call limit exceeded or general error, we stop retrying
                break;
              }
            }
          }

          if (!fetchSuccess && results.length === 0) {
            setCfApiStatus("offline");
          }

          if (results.length > 0) {
            // Update React state with fresh client-resolved real-time stats
            setStudents(prevStudents => {
              return prevStudents.map(student => {
                const freshCf = results.find(
                  r => r.handle.toLowerCase() === student.handle.toLowerCase()
                );
                return freshCf ? { ...student, cfData: freshCf } : student;
              });
            });

            // Sync these fresh results back to server database backup cache
            const updates = results.map(r => ({
              handle: r.handle,
              cfData: r
            }));

            fetch("/api/cf/save-cache", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates })
            })
            .then(res => res.json())
            .then(resData => {
              if (resData.success) {
                console.log(`[Cache Sync Success] Updated database-level backup cache for ${results.length} students.`);
              }
            })
            .catch(syncErr => {
              console.warn("[Cache Sync Warning] Background database cache sync failed:", syncErr);
            });
          }
        })();
      }

    } catch (err: any) {
      console.error("[Load Students Status Error]", err);
      setError(err.message || "Failed to parse batch member directories.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Delete/unregister a student (resilient non-blocking modal flow)
  const handleDeleteStudent = (handle: string) => {
    if (!isCreator) {
      setAlertModal({
        title: "Access Forbidden",
        message: "Operation Denied: Only certified Creator is allowed to remove user registrations."
      });
      return;
    }

    setConfirmModal({
      title: "Remove Registration",
      subtitle: `Are you sure you want to unregister CF handle "${handle}" from SUST '25 workspace database?`,
      onConfirm: async () => {
        const creatorPassword = localStorage.getItem("creator_password") || "";
        try {
          const response = await fetch(`/api/users/${handle}`, {
            method: "DELETE",
            headers: {
              "x-creator-password": creatorPassword
            }
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
          setAlertModal({
            title: "Network protocol failure",
            message: `Error unregistering user: ${err.message}`
          });
        }
      }
    });
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

          <div className="flex items-center gap-3 font-mono">
            <span className="hidden lg:inline text-xs text-gray-500">SYSTEM: </span>
            <span className="px-2 py-1 rounded bg-[#00ff87]/10 border border-[#00ff87]/30 text-[#00ff87] text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#00ff87] rounded-full animate-ping"></span>
              HUB LIVE
            </span>

            {/* Codeforces API status badge */}
            {cfApiStatus === "checking" && (
              <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 animate-pulse" title="System is currently checking Codeforces API status and fetching batch data...">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                CF API: TIMING...
              </span>
            )}
            {cfApiStatus === "online" && (
              <span className="px-2 py-1 rounded bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-cyber-cyan rounded-full"></span>
                CF API: ONLINE
              </span>
            )}
            {cfApiStatus === "degraded" && (
              <span className="px-2 py-1 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1" title="Codeforces is rate-limiting of API requests (Call limit exceeded)">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></span>
                CF API: COOLDOWN
              </span>
            )}
            {cfApiStatus === "offline" && (
              <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-red-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1" title="API Unreachable or Down. Serving cached backup ratings from Firestore database securely.">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                CF API: OFFLINE (CACHED)
              </span>
            )}
            <button
              onClick={handleCreatorToggle}
              className={`px-3 py-1 text-xs font-bold rounded-md border tracking-wider transition-all duration-300 flex items-center gap-1.5 uppercase cursor-pointer ${
                isCreator 
                  ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white"
                  : "bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan hover:text-cyber-dark"
              }`}
            >
              {isCreator ? "🔓 Creator Mode" : "🔒 Creator Login"}
            </button>

            {/* Bright/Dark Mode Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-cyber-yellow hover:border-cyber-yellow/40 bg-cyber-panel transition-all duration-300 cursor-pointer flex items-center justify-center"
              title={theme === "dark" ? "Toggle Bright Mode" : "Toggle Dark Mode"}
              id="theme-toggle-btn"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-cyber-yellow shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-purple-600 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Section 2: Main Outer container */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 flex-grow w-full relative z-10 space-y-6 md:space-y-8">
        
        {/* Codeforces server offline / degraded banner notice */}
        {(cfApiStatus === "offline" || cfApiStatus === "degraded") && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/20 to-red-950/15 border border-amber-500/25 text-amber-300 text-xs md:text-sm font-mono relative overflow-hidden group shadow-md animate-pulse">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-red-500"></div>
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-white uppercase tracking-wider block mb-1">
                  Codeforces Server Outage / Rate Protection Active
                </span>
                <span className="text-gray-300 leading-relaxed block">
                  {cfApiStatus === "offline" 
                    ? "The Codeforces central API servers are currently unreachable, offline, or heavily rate-limiting inquiries. The SUST '25 Battleground Hub has automatically switched the background client sync to our Firestore persistent backup cache to protect system uptime. All competitor ranks and ratings remain fully readable!"
                    : "The Codeforces central API continues to trigger a query 'Call limit exceeded' cooldown. Some real-time competitor stat refreshes might be rate-protected. Serve limits are preserved via offline backups."}
                </span>
              </div>
            </div>
          </div>
        )}
        
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
                  isCreator={isCreator}
                />
              </div>

            </div>

          </div>
        )}
      </main>

      {/* Creator Authentication Overlay Modal */}
      {showCreatorModal && (
        <div className="fixed inset-0 bg-cyber-dark/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-mono">
          <div className="bg-cyber-panel border border-cyber-pink/50 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-cyber-pink uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>⚠</span> Creator Login Verification
            </h3>
            <p className="text-gray-400 mb-4 text-xs leading-relaxed">
              This system protects the registered participant roster from unauthorized modifications. To verify that you are the creator (<strong className="text-white">Nilkontha Das</strong>), please enter your secure password:
            </p>

            <form onSubmit={handleVerifyCreator} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1.5">
                  Creator Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={creatorInput}
                  onChange={(e) => setCreatorInput(e.target.value)}
                  className="w-full bg-cyber-dark text-white rounded-lg px-3 py-2 border border-gray-800 focus:border-cyber-pink focus:outline-none focus:ring-1 focus:ring-cyber-pink"
                  autoFocus
                />
              </div>

              {creatorError && (
                <p className="text-red-400 font-semibold tracking-wider text-[11px]">{creatorError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatorModal(false);
                    setCreatorInput("");
                    setCreatorError(null);
                  }}
                  className="px-3 py-1.5 rounded border border-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyber-pink text-white font-bold tracking-wide hover:bg-opacity-90 shadow-neon-pink transition-all cursor-pointer"
                >
                  Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Asynchronous Confirmation Dialog Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-cyber-dark/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-mono">
          <div className="bg-cyber-panel border border-cyber-pink/50 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-cyber-pink uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>⚠</span> {confirmModal.title}
            </h3>
            <p className="text-gray-400 mb-6 text-xs leading-relaxed">
              {confirmModal.subtitle}
            </p>
            <div className="flex items-center justify-end gap-3 font-mono text-xs">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded border border-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold tracking-wide transition-all shadow-neon-pink cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Asynchronous Alert / Notification Dialogue Modal */}
      {alertModal && (
        <div className="fixed inset-0 bg-cyber-dark/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-mono">
          <div className="bg-cyber-panel border border-cyber-cyan/50 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-sm font-bold text-cyber-cyan uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>ℹ</span> {alertModal.title}
            </h3>
            <p className="text-gray-400 mb-6 text-xs leading-relaxed">
              {alertModal.message}
            </p>
            <div className="flex items-center justify-end font-mono text-xs">
              <button
                onClick={() => setAlertModal(null)}
                className="px-4 py-1.5 rounded bg-cyber-cyan hover:bg-cyber-cyan/80 text-cyber-dark font-bold tracking-wide transition-all shadow-neon-cyan cursor-pointer"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
