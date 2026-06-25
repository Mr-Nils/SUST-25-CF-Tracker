import { useState } from "react";
import { FullStudent } from "../types";
import { Search, Trophy, Trash2, ArrowUpDown, ShieldAlert, Award, Star, ExternalLink } from "lucide-react";

// Get stylized color class and styling details for each rank
export function getRankStyles(rating: number = 0) {
  if (rating === 0) {
    return {
      textColor: "text-gray-500",
      bgClass: "bg-gray-950/40 border-gray-800",
      glowBg: "rgba(100, 100, 100, 0.15)",
      shadowClass: "shadow-gray-500/20",
      rankName: "Unrated",
      textShadow: "none"
    };
  }
  if (rating < 1200) {
    return {
      textColor: "text-slate-400",
      bgClass: "bg-slate-950/40 border-slate-700",
      glowBg: "rgba(148, 163, 184, 0.2)",
      shadowClass: "shadow-slate-500/30",
      rankName: "Newbie",
      textShadow: "0 0 6px rgba(148, 163, 184, 0.4)"
    };
  }
  if (rating < 1400) {
    return {
      textColor: "text-[#00ff87]",
      bgClass: "bg-green-950/20 border-[#00ff87]/30",
      glowBg: "rgba(0, 255, 135, 0.2)",
      shadowClass: "shadow-[#00ff87]/30",
      rankName: "Pupil",
      textShadow: "0 0 10px rgba(0, 255, 135, 0.5)"
    };
  }
  if (rating < 1600) {
    return {
      textColor: "text-cyan-400",
      bgClass: "bg-cyan-950/20 border-cyan-500/30",
      glowBg: "rgba(6, 182, 212, 0.2)",
      shadowClass: "shadow-cyan-400/30",
      rankName: "Specialist",
      textShadow: "0 0 10px rgba(34, 211, 238, 0.5)"
    };
  }
  if (rating < 1900) {
    return {
      textColor: "text-blue-400",
      bgClass: "bg-blue-950/20 border-blue-500/30",
      glowBg: "rgba(59, 130, 246, 0.2)",
      shadowClass: "shadow-blue-400/30",
      rankName: "Expert",
      textShadow: "0 0 10px rgba(96, 165, 250, 0.5)"
    };
  }
  if (rating < 2100) {
    return {
      textColor: "text-fuchsia-400",
      bgClass: "bg-fuchsia-950/20 border-fuchsia-500/30",
      glowBg: "rgba(217, 70, 239, 0.2)",
      shadowClass: "shadow-fuchsia-400/30",
      rankName: "Candidate Master",
      textShadow: "0 0 10px rgba(232, 121, 249, 0.5)"
    };
  }
  if (rating < 2300) {
    return {
      textColor: "text-orange-400",
      bgClass: "bg-orange-950/20 border-orange-500/30",
      glowBg: "rgba(251, 146, 60, 0.2)",
      shadowClass: "shadow-orange-400/30",
      rankName: "Master",
      textShadow: "0 0 10px rgba(251, 146, 60, 0.5)"
    };
  }
  if (rating < 2400) {
    return {
      textColor: "text-amber-500",
      bgClass: "bg-amber-950/20 border-amber-500/30",
      glowBg: "rgba(245, 158, 11, 0.2)",
      shadowClass: "shadow-amber-500/30",
      rankName: "International Master",
      textShadow: "0 0 10px rgba(245, 158, 11, 0.5)"
    };
  }
  if (rating < 2600) {
    return {
      textColor: "text-red-400",
      bgClass: "bg-red-950/20 border-red-500/30",
      glowBg: "rgba(239, 68, 68, 0.2)",
      shadowClass: "shadow-red-400/30",
      rankName: "Grandmaster",
      textShadow: "0 0 10px rgba(248, 113, 113, 0.5)"
    };
  }
  if (rating < 3000) {
    return {
      textColor: "text-rose-500",
      bgClass: "bg-rose-950/25 border-rose-500/40",
      glowBg: "rgba(244, 63, 94, 0.25)",
      shadowClass: "shadow-rose-500/45",
      rankName: "International Grandmaster",
      textShadow: "0 0 12px rgba(244, 63, 94, 0.6)"
    };
  }
  return {
    textColor: "text-[#ff007f]",
    bgClass: "bg-pink-950/25 border-pink-500/40",
    glowBg: "rgba(255, 0, 127, 0.25)",
    shadowClass: "shadow-pink-500/50",
    rankName: "Legendary Grandmaster",
    textShadow: "0 0 15px rgba(255, 0, 127, 0.7)"
  };
}

interface LeaderboardProps {
  students: FullStudent[];
  isLoading: boolean;
  onSelectStudent: (student: FullStudent) => void;
  onDeleteStudent: (handle: string) => void;
  isCreator: boolean;
}

type SortField = "rank" | "name" | "rating" | "regNo" | "peakRating";
type SortOrder = "asc" | "desc";

export default function Leaderboard({ students, isLoading, onSelectStudent, onDeleteStudent, isCreator }: LeaderboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("rating");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc"); // Default to desc for new sorts (e.g. highest rating)
    }
  };

  // Filter students based on search term
  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.handle.toLowerCase().includes(term) ||
      s.regNo.includes(term) ||
      (s.cfData?.rank && s.cfData.rank.toLowerCase().includes(term))
    );
  });

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let factorA: any = "";
    let factorB: any = "";

    if (sortField === "rating") {
      factorA = a.cfData?.rating || 0;
      factorB = b.cfData?.rating || 0;
    } else if (sortField === "name") {
      factorA = a.name.toLowerCase();
      factorB = b.name.toLowerCase();
    } else if (sortField === "regNo") {
      factorA = a.regNo;
      factorB = b.regNo;
    } else if (sortField === "rank") {
      factorA = a.cfData?.rating || 0; // Rank corresponds to rating
      factorB = b.cfData?.rating || 0;
    } else if (sortField === "peakRating") {
      factorA = a.cfData?.maxRating || 0;
      factorB = b.cfData?.maxRating || 0;
    }

    if (factorA < factorB) return sortOrder === "asc" ? -1 : 1;
    if (factorA > factorB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-cyber-panel rounded-xl neon-border-pink p-5 md:p-6 transition-all duration-300 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold uppercase text-white tracking-wider flex items-center gap-2">
            <Trophy className="w-5 h-5 text-cyber-yellow animate-bounce" />
            Competitive Leaderboard
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            REAL-TIME RATING METADATA SYNC | TOTAL REGISTERED: {students.length}
          </p>
        </div>

        {/* Search controls */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
            <Search className="w-4 h-4 text-cyber-pink" />
          </span>
          <input
            id="search-box"
            type="text"
            placeholder="Search by name, handle, reg or rank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-dark/90 text-white rounded-lg pl-9 pr-4 py-2 text-sm font-mono border border-gray-800 focus:border-cyber-pink focus:outline-none focus:ring-1 focus:ring-cyber-pink transition-all duration-200"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-cyber-pink border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-gray-400 animate-pulse uppercase tracking-widest">
            SYNCHRONIZING WITH CODEFORCES CORE API...
          </span>
        </div>
      ) : sortedStudents.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-gray-800 rounded-lg bg-cyber-dark/40">
          <ShieldAlert className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-mono text-sm uppercase">No Students Detected System-Wide</p>
          <p className="text-gray-500 text-xs mt-1.5 font-mono">
            Fill the Registration form to populate or reset.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono" id="leaderboard-table">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-cyber-pink uppercase font-bold tracking-wider select-none">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1.5">
                    Student / Handles
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-center hidden md:table-cell" onClick={() => handleSort("regNo")}>
                  <div className="flex items-center justify-center gap-1.5">
                    Reg No
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort("rating")}>
                  <div className="flex items-center justify-center gap-1.5">
                    CF Rating
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-center hidden sm:table-cell" onClick={() => handleSort("peakRating")}>
                  <div className="flex items-center justify-center gap-1.5">
                    Peak Rating
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center hidden sm:table-cell">Rank / Class</th>
                <th className="py-3.5 px-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/60 text-sm">
              {sortedStudents.map((student, idx) => {
                const rankStyles = getRankStyles(student.cfData?.rating || 0);
                const isPodium = idx < 3;
                const indexNum = idx + 1;

                return (
                  <tr
                    key={student.handle}
                    id={`row-${student.handle}`}
                    className="hover:bg-cyber-dark-panel/40 transition-colors duration-200 group border-b border-gray-900"
                  >
                    {/* Rank Number */}
                    <td className="py-4 px-3 text-center">
                      {isPodium ? (
                        <div className="flex items-center justify-center">
                          {idx === 0 && (
                            <span className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/50 flex items-center justify-center text-amber-400 font-extrabold text-xs shadow-custom group-hover:animate-pulse">
                              1
                            </span>
                          )}
                          {idx === 1 && (
                            <span className="w-7 h-7 rounded-full bg-slate-100/10 border border-slate-300/40 flex items-center justify-center text-slate-300 font-extrabold text-xs">
                              2
                            </span>
                          )}
                          {idx === 2 && (
                            <span className="w-7 h-7 rounded-full bg-amber-700/15 border border-amber-800/40 flex items-center justify-center text-amber-600 font-extrabold text-xs">
                              3
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 font-semibold">{indexNum}</span>
                      )}
                    </td>

                    {/* Student Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.cfData?.avatar || "https://userpic.codeforces.org/no-avatar.jpg"}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg bg-cyber-dark border border-gray-800 object-cover"
                        />
                        <div className="flex flex-col min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm">
                          <span className="text-white font-semibold truncate group-hover:text-cyber-cyan transition-colors flex items-center gap-1.5 flex-wrap">
                            <span>{student.name}</span>
                            <span className={`text-[9px] uppercase tracking-wider font-extrabold font-mono px-1.5 py-0.5 rounded ${rankStyles.textColor} ${rankStyles.bgClass} border border-current/10 whitespace-nowrap`}>
                              {rankStyles.rankName}
                            </span>
                          </span>
                          <span className="text-gray-500 text-xs flex items-center gap-1.5 mt-0.5">
                            <span className={`font-semibold tracking-wider ${rankStyles.textColor}`} style={{ textShadow: rankStyles.textShadow }}>
                              {student.handle}
                            </span>
                            <a
                              href={`https://codeforces.com/profile/${student.handle}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-cyber-pink transition-colors text-gray-500/70"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Registration No */}
                    <td className="py-3 px-4 text-center hidden md:table-cell text-gray-400 text-xs">
                      {student.regNo}
                    </td>

                    {/* Codeforces rating */}
                    <td className="py-3 px-4 text-center">
                      <span className={`text-base font-extrabold tracking-wide ${rankStyles.textColor}`} style={{ textShadow: rankStyles.textShadow }}>
                        {student.cfData?.rating || "—"}
                      </span>
                    </td>

                    {/* Peak Rating */}
                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                      {student.cfData?.maxRating ? (
                        <span className="text-sm font-extrabold text-cyber-pink">
                          {student.cfData.maxRating}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Rank Class badges */}
                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md bg-cyber-dark border capitalize tracking-widest inline-flex ${rankStyles.textColor} ${rankStyles.bgClass}`}>
                        {rankStyles.rankName}
                      </span>
                    </td>

                    {/* Operations */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onSelectStudent(student)}
                          className="px-2.5 py-1.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-semibold hover:bg-cyber-cyan hover:text-cyber-dark hover:shadow-neon-cyan transition-all duration-200 cursor-pointer"
                        >
                          Profile
                        </button>
                        {isCreator && (
                          <button
                            onClick={() => onDeleteStudent(student.handle)}
                            className="p-1.5 rounded bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 cursor-pointer"
                            title="Unregister Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
