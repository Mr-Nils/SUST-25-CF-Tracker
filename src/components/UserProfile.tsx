import { useEffect, useState, useMemo } from "react";
import { ProfileDetails, FullStudent, SolvedProblem, CFContest } from "../types";
import { getRankStyles } from "./Leaderboard";
import { cfGetUserInfo, cfGetUserStatus, cfGetUserRating } from "../cfApi";
import { 
  User, 
  ExternalLink, 
  Award, 
  CheckCircle, 
  Calendar, 
  Hash, 
  Search, 
  BarChart3, 
  Tags, 
  RefreshCw, 
  ArrowLeft, 
  MapPin, 
  Briefcase, 
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from "lucide-react";

interface ContestRatingChartProps {
  contests: CFContest[];
}

function ContestRatingChart({ contests }: ContestRatingChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!contests || contests.length === 0) return null;

  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  // We limit the trend line to the last 20 contest sessions to remain clean and beautifully spaced
  const chartData = contests.slice(-20);

  const ratings = chartData.map(c => c.newRating);
  const oldRatings = chartData.map(c => c.oldRating);
  const minRating = Math.min(...ratings, ...oldRatings);
  const maxRating = Math.max(...ratings, ...oldRatings);
  
  // High-contrast margin bounds for custom dynamic dynamic scale
  const rMin = Math.max(0, minRating - 80);
  const rMax = maxRating + 80;
  const rRange = rMax - rMin || 1;

  const points = chartData.map((c, idx) => {
    const x = paddingLeft + (idx / (chartData.length - 1 || 1)) * (width - paddingLeft - paddingRight);
    const y = height - paddingBottom - ((c.newRating - rMin) / rRange) * (height - paddingTop - paddingBottom);
    return { x, y, contest: c, idx };
  });

  // Calculate 3 clean horizontal grid divisions
  const gridLinesCount = 3;
  const gridLines = Array.from({ length: gridLinesCount }).map((_, i) => {
    const ratingVal = Math.round(rMin + (i * rRange) / (gridLinesCount - 1));
    const y = height - paddingBottom - ((ratingVal - rMin) / rRange) * (height - paddingTop - paddingBottom);
    return { ratingVal, y };
  });

  // Smooth standard SVG linear path generator
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} Z`
    : "";

  // Set default view active state to latest contest point
  const activeIdx = hoveredIdx !== null ? hoveredIdx : (chartData.length - 1);
  const activePoint = points[activeIdx];
  const activeContest = activePoint?.contest;

  const activeDelta = activeContest ? activeContest.newRating - activeContest.oldRating : 0;
  const activeIsPositive = activeDelta >= 0;
  const activeShiftColor = activeIsPositive ? "text-[#00ff87]" : "text-red-400";
  const activeShiftSign = activeIsPositive ? "+" : "";
  const activeRankStyles = activeContest ? getRankStyles(activeContest.newRating) : getRankStyles(0);

  return (
    <div className="bg-cyber-dark/40 border border-gray-950 rounded-xl p-4 font-mono mb-5 space-y-4">
      {/* Dynamic Header Metrics Context Panel */}
      {activeContest && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b border-gray-900/60 pb-3" id="rating-focus-stats">
          <div className="md:col-span-7 space-y-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">
              {hoveredIdx !== null ? "⚡ FOCUS POINT METRIC" : "🏆 LATEST CONTEST SCORE"}
            </span>
            <span className="text-white text-xs font-semibold block truncate" title={activeContest.contestName}>
              {activeContest.contestName}
            </span>
            <span className="text-[10px] text-gray-500">
              Resolved: {new Date(activeContest.ratingUpdateTimeSeconds * 1000).toLocaleDateString()} • Rank: #{activeContest.rank}
            </span>
          </div>
          <div className="md:col-span-5 flex items-center justify-end gap-3.5 font-mono">
            <div className="text-right">
              <span className="text-[9px] text-gray-500 block">DELTA</span>
              <span className={`text-xs font-extrabold ${activeShiftColor}`}>
                {activeShiftSign}{activeDelta}
              </span>
            </div>
            <div className="h-7 w-px bg-gray-900" />
            <div className="text-right font-bold">
              <span className="text-[9px] text-gray-500 block font-normal">RATING</span>
              <span className={`text-xs ${activeRankStyles.textColor}`} style={{ textShadow: activeRankStyles.textShadow }}>
                {activeContest.newRating}
              </span>
            </div>
            <div className="h-7 w-px bg-gray-900" />
            <div className="text-right">
              <span className="text-[9px] text-gray-500 block">CF TIER</span>
              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${activeRankStyles.textColor} ${activeRankStyles.bgClass} border border-current/10 whitespace-nowrap`}>
                {activeRankStyles.rankName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Container Stage */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "600/220" }} id="rating-trend-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid Axes Lines */}
          {gridLines.map((gl, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={gl.y}
                x2={width - paddingRight}
                y2={gl.y}
                className="stroke-gray-900/40 dark:stroke-gray-200/20"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 8}
                y={gl.y + 3}
                className="fill-gray-500 font-mono text-[9px] font-semibold text-right"
                textAnchor="end"
              >
                {gl.ratingVal}
              </text>
            </g>
          ))}

          {/* Area Gradient Graph Path */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#chartGradient)"
            />
          )}

          {/* Stroke line path */}
          {linePath && (
            <>
              {/* Stroke halo glow */}
              <path
                d={linePath}
                fill="none"
                stroke="#a855f7"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.25}
                className="blur-[2px]"
              />
              {/* Solid path line */}
              <path
                d={linePath}
                fill="none"
                stroke="#a855f7"
                className="stroke-purple-500"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Highlight indicator vertical rail bar */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={paddingTop}
              x2={activePoint.x}
              y2={height - paddingBottom}
              stroke="#a855f7"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
            />
          )}

          {/* Highlight and plot vertices dots */}
          {points.map((p, i) => {
            const isActive = i === activeIdx;
            
            // Re-map dot color dynamically mapped to Codeforces tiering
            let dotColor = "#cbd5e1";
            if (p.contest.newRating >= 2300) dotColor = "#fb923c"; // Orange
            else if (p.contest.newRating >= 2100) dotColor = "#e879f9"; // Fuchsia
            else if (p.contest.newRating >= 1900) dotColor = "#60a5fa"; // Expert blue
            else if (p.contest.newRating >= 1600) dotColor = "#22d3ee"; // Specialist cyan
            else if (p.contest.newRating >= 1200) dotColor = "#00ff87"; // Pupil green

            return (
              <g key={i}>
                {isActive && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6.5}
                    fill={dotColor}
                    opacity={0.3}
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 4.5 : 2.5}
                  fill={dotColor}
                  stroke="#161b22"
                  strokeWidth={isActive ? 1.5 : 1}
                  className="transition-all duration-150"
                  style={{ filter: isActive ? `drop-shadow(0 0 3px ${dotColor})` : "none" }}
                />
              </g>
            );
          })}

          {/* Hover interactive detection columns */}
          {points.map((p, i) => {
            const colWidth = (width - paddingLeft - paddingRight) / (points.length || 1);
            return (
              <rect
                key={i}
                x={p.x - colWidth / 2}
                y={0}
                width={colWidth}
                height={height - paddingBottom}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(p.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>

        {/* Dynamic Interactive guide label */}
        <div className="absolute bottom-1 right-2 flex items-center gap-2.5 text-[8px] text-gray-500 bg-cyber-panel/90 border border-gray-900/60 px-2 py-0.5 rounded font-mono select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Rating Curve Progress (Hover timeline points)
        </div>
      </div>
    </div>
  );
}

interface UserProfileProps {
  student: FullStudent;
  onBack: () => void;
}

export default function UserProfile({ student, onBack }: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problemSearch, setProblemSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllContests, setShowAllContests] = useState(false);
  const problemsPerPage = 10;

  const fetchProfileDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cf/user-profile/${student.handle}`);
      if (!response.ok) {
        throw new Error("Failed to fetch Codeforces profile stats.");
      }
      const data = await response.json();
      
      let finalProfile = data;
      const isStaleOrOffline = !data.info || data.info.offline || data.info.error || (data.submissions && data.submissions.offline);

      if (isStaleOrOffline) {
        console.log(`[Client Fallback Healing] Server fetched profile was rate-limited or offline. Initiating direct browser Codeforces JSONP query for user "${student.handle}"...`);
        try {
          // Fetch user info via JSONP
          let freshInfo = data.info;
          try {
            const infoResult = await cfGetUserInfo([student.handle]);
            if (infoResult && infoResult[0]) {
              freshInfo = infoResult[0];
            }
          } catch (infoErr) {
            console.warn("[Client JSONP user info fetch failed]:", infoErr);
          }

          // Fetch submissions via JSONP
          let freshSubs = data.submissions;
          try {
            const submissionsResult = await cfGetUserStatus(student.handle);
            if (Array.isArray(submissionsResult)) {
              const solvedProblemsMap = new Map();
              submissionsResult.forEach((sub: any) => {
                if (sub.verdict === "OK" && sub.problem) {
                  const key = `${sub.problem.contestId}-${sub.problem.index}`;
                  if (!solvedProblemsMap.has(key)) {
                    solvedProblemsMap.set(key, {
                      contestId: sub.problem.contestId,
                      index: sub.problem.index,
                      name: sub.problem.name,
                      rating: sub.problem.rating || 0,
                      tags: sub.problem.tags || [],
                      solvedAt: sub.creationTimeSeconds * 1000
                    });
                  }
                }
              });

              const solvedList = Array.from(solvedProblemsMap.values());
              const totalSolved = solvedList.length;
              const ratingDistribution: Record<number, number> = {};
              const tagDistribution: Record<string, number> = {};

              solvedList.forEach((prob: any) => {
                if (prob.rating) {
                  ratingDistribution[prob.rating] = (ratingDistribution[prob.rating] || 0) + 1;
                }
                prob.tags.forEach((tag: string) => {
                  tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
                });
              });

              freshSubs = {
                totalSolved,
                solvedProblems: solvedList,
                ratingDistribution,
                tagDistribution,
                lastUpdated: Date.now()
              };
            }
          } catch (subsErr) {
            console.warn("[Client JSONP user status fetch failed]:", subsErr);
          }

          // Fetch contests rating history via JSONP
          let freshContests = data.contests;
          try {
            const ratingHistoryResult = await cfGetUserRating(student.handle);
            if (Array.isArray(ratingHistoryResult)) {
              freshContests = ratingHistoryResult;
            }
          } catch (ratingErr) {
            console.warn("[Client JSONP user rating fetch failed]:", ratingErr);
          }

          finalProfile = {
            info: freshInfo,
            submissions: freshSubs,
            contests: freshContests
          };

          // Background sync updated user info back to server database cache
          if (freshInfo && !freshInfo.offline && !freshInfo.error) {
            fetch("/api/cf/save-cache", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                updates: [{ handle: student.handle, cfData: freshInfo }]
              })
            }).catch(e => console.warn("[Background Sync Cached Profile Failed]", e));
          }

        } catch (fallbackErr) {
          console.warn("[Client Fallback Healing Failed] Codeforces API could not be queried directly:", fallbackErr);
        }
      }

      setProfile(finalProfile);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileDetails();
  }, [student.handle]);

  // Reset pagination on filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [problemSearch, selectedTag]);

  // Derived calculations
  const rankMeta = useMemo(() => {
    const rating = profile?.info?.rating || student.cfData?.rating || 0;
    return getRankStyles(rating);
  }, [profile?.info?.rating, student.cfData?.rating]);

  // Process problems and statistics
  const filteredProblems = useMemo(() => {
    if (!profile?.submissions?.solvedProblems) return [];
    return profile.submissions.solvedProblems.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(problemSearch.toLowerCase()) || 
                            p.index.toLowerCase().includes(problemSearch.toLowerCase()) ||
                            p.contestId.toString().includes(problemSearch);
      
      const matchesTag = !selectedTag || p.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [profile?.submissions?.solvedProblems, problemSearch, selectedTag]);

  // Paginated list
  const paginatedProblems = useMemo(() => {
    const startIdx = (currentPage - 1) * problemsPerPage;
    return filteredProblems.slice(startIdx, startIdx + problemsPerPage);
  }, [filteredProblems, currentPage]);

  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);

  // Stats summaries
  const ratingStats = useMemo(() => {
    if (!profile?.submissions?.ratingDistribution) return [];
    const dist = profile.submissions.ratingDistribution;
    return Object.entries(dist)
      .map(([rating, count]) => ({ rating: parseInt(rating), count: count as number }))
      .sort((a, b) => a.rating - b.rating);
  }, [profile?.submissions?.ratingDistribution]);

  const maxProbCount = useMemo(() => {
    if (ratingStats.length === 0) return 0;
    return Math.max(...ratingStats.map((item) => item.count));
  }, [ratingStats]);

  const tagStats = useMemo(() => {
    if (!profile?.submissions?.tagDistribution) return [];
    const dist = profile.submissions.tagDistribution;
    return Object.entries(dist)
      .map(([tag, count]) => ({ tag, count: count as number }))
      .sort((a, b) => b.count - a.count);
  }, [profile?.submissions?.tagDistribution]);

  return (
    <div className="space-y-6">
      {/* Back Header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 font-mono">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 border border-cyber-pink/30 hover:border-cyber-pink rounded-lg bg-cyber-pink/5 hover:bg-cyber-pink/20 text-cyber-pink text-xs uppercase tracking-wider font-semibold transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Battle Ground (Leaderboard)
        </button>

        <button
          onClick={fetchProfileDetails}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-cyber-cyan/30 hover:border-cyber-cyan rounded-lg bg-cyber-cyan/5 hover:bg-cyber-cyan/20 text-cyber-cyan text-xs uppercase tracking-wider font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Force Sync CF API
        </button>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-mono text-gray-400 animate-pulse uppercase tracking-widest text-center">
            INTERROGATING CODEFORCES SYSTEM DATABASES...
          </span>
        </div>
      ) : error ? (
        <div className="p-8 border border-red-500/30 bg-red-950/20 rounded-xl font-mono text-center">
          <p className="text-red-400 uppercase font-bold tracking-widest text-lg">DATALINK CONNECTION FAILURE</p>
          <p className="text-gray-400 text-sm mt-2">{error}</p>
          <button
            onClick={fetchProfileDetails}
            className="mt-6 px-5 py-2.5 bg-red-500/20 hover:bg-red-500 hover:text-white border border-red-500/40 text-red-300 rounded-lg text-sm tracking-wider uppercase font-semibold transition-all cursor-pointer"
          >
            Retry Connection Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Student Card Details & Analytics */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Student Cyber Card */}
            <div className="bg-cyber-panel rounded-xl neon-border-cyan p-6 relative overflow-hidden" id="user-cyber-card">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-cyan/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex flex-col items-center text-center">
                {/* Glowing Avatar frame based on rank */}
                <div className="relative p-1 rounded-full mb-4">
                  <div 
                    className="absolute inset-0 rounded-full blur-md opacity-70 animate-pulse" 
                    style={{ backgroundColor: rankMeta.glowBg }}
                  ></div>
                  <img
                    src={profile?.info?.avatar || "https://userpic.codeforces.org/no-avatar.jpg"}
                    alt={student.name}
                    className="w-24 h-24 rounded-full border-2 border-cyber-cyan object-cover bg-cyber-dark relative z-10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 right-2 bg-cyber-dark text-cyber-cyan p-1 rounded-full border border-cyber-cyan z-20">
                    <Award className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-extrabold tracking-wide text-white font-sans">
                  {student.name}
                </h3>
                
                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-xs">
                  <span className={`font-bold tracking-wider ${rankMeta.textColor}`} style={{ textShadow: rankMeta.textShadow }}>
                    {profile?.info?.handle || student.handle}
                  </span>
                  <a
                    href={`https://codeforces.com/profile/${profile?.info?.handle || student.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-500 hover:text-cyber-cyan transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Rank Badge */}
                <div className="mt-3.5 flex flex-col items-center gap-2">
                  <span className={`px-3 py-1.5 text-xs font-bold font-mono rounded-md bg-cyber-dark border tracking-widest uppercase inline-block ${rankMeta.textColor} ${rankMeta.bgClass}`}>
                    {rankMeta.rankName}
                  </span>
                  {(profile?.info?.isCachedFallback || profile?.info?.offline) && (
                    <span className="px-2 py-0.5 text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono rounded uppercase tracking-widest font-extrabold animate-pulse">
                      Serving Cached Backup
                    </span>
                  )}
                </div>
              </div>

              {/* Specs List */}
              <div className="mt-6 pt-5 border-t border-gray-900 font-mono text-xs space-y-3 text-gray-400">
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Hash className="w-3.5 h-3.5 text-cyber-cyan" />
                    Reg index:
                  </span>
                  <span className="text-white font-medium">{student.regNo}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Award className="w-3.5 h-3.5 text-cyber-cyan" />
                    Current Rating:
                  </span>
                  <span className={`font-bold text-sm ${rankMeta.textColor}`}>
                    {profile?.info?.rating || "unrated"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <TrendingUp className="w-3.5 h-3.5 text-cyber-pink" />
                    Max Rating:
                  </span>
                  <span className="text-white font-semibold flex items-center gap-1">
                    {profile?.info?.maxRating || "unrated"} 
                    {profile?.info?.maxRank && (
                      <span className="text-[10px] text-gray-500">({profile.info.maxRank})</span>
                    )}
                  </span>
                </div>

                {profile?.info?.organization && (
                  <div className="flex justify-between items-start py-1">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Briefcase className="w-3.5 h-3.5 text-cyber-cyan" />
                      Org:
                    </span>
                    <span className="text-white text-right max-w-[180px] truncate">{profile.info.organization}</span>
                  </div>
                )}

                {profile?.info?.country && (
                  <div className="flex justify-between items-center py-1">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-cyber-cyan" />
                      Location:
                    </span>
                    <span className="text-white">
                      {profile.info.city ? `${profile.info.city}, ` : ""}{profile.info.country}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-cyber-cyan" />
                    Joined:
                  </span>
                  <span className="text-white/80">
                    {profile?.info?.registrationTimeSeconds 
                      ? new Date(profile.info.registrationTimeSeconds * 1000).toLocaleDateString()
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Problems Solved Panel */}
            <div className="bg-cyber-panel rounded-xl border border-gray-900 p-5 md:p-6 text-center font-mono">
              <span className="text-gray-500 text-xs tracking-wider uppercase">VALID SOLVED PROTOCOL</span>
              <div className="text-4xl md:text-5xl font-extrabold text-[#00ff87] glow-text-green mt-2 font-mono">
                {profile?.submissions?.totalSolved || 0}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Unique problems solved across live contests & gym
              </p>
            </div>

            {/* Glowing Tag Cloud / Distribution */}
            <div className="bg-cyber-panel rounded-xl border border-gray-900 p-5 md:p-6">
              <h4 className="text-sm font-bold tracking-widest text-[#00f0ff] uppercase flex items-center gap-2 mb-4 font-mono">
                <Tags className="w-4 h-4 text-cyber-cyan" />
                Problem Tags Distribution
              </h4>
              {tagStats.length === 0 ? (
                <p className="text-gray-600 font-mono text-center text-xs py-4">No Tag details loaded</p>
              ) : (
                <div className="space-y-3.5 font-mono text-xs">
                  {tagStats.slice(0, 7).map((item) => {
                    const totalTagsCount = tagStats.reduce((acc, curr) => acc + curr.count, 0);
                    const percentage = totalTagsCount > 0 ? Math.round((item.count / totalTagsCount) * 100) : 0;
                    const isSelected = selectedTag === item.tag;

                    return (
                      <div 
                        key={item.tag} 
                        onClick={() => setSelectedTag(isSelected ? null : item.tag)}
                        className={`group cursor-pointer p-2 rounded transition-colors ${
                          isSelected ? "bg-cyber-cyan/15 border border-cyber-cyan/30" : "hover:bg-cyber-dark/40 border border-transparent"
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className={`font-semibold tracking-wide ${isSelected ? "text-cyber-cyan font-bold" : "text-gray-300 group-hover:text-cyber-cyan"}`}>
                            #{item.tag}
                          </span>
                          <span className="text-gray-500 font-bold">{item.count} items</span>
                        </div>
                        <div className="w-full bg-cyber-dark rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-cyber-cyan rounded-full h-1.5 transition-all duration-500" 
                            style={{ width: `${Math.max(5, Math.min(100, Math.round((item.count / tagStats[0].count) * 100)))}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {tagStats.length > 7 && (
                    <p className="text-[10px] text-gray-500 text-center uppercase font-bold pt-2">
                       + {tagStats.length - 7} more tags available
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Interactive Charts and Problems status */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Rating distribution analytics (Dynamic Custom SVG Graph) */}
            <div className="bg-cyber-panel rounded-xl border border-gray-900 p-5 md:p-6">
              <h4 className="text-sm font-bold tracking-widest text-cyber-pink uppercase flex items-center gap-2 mb-4 font-mono">
                <BarChart3 className="w-4 h-4 text-cyber-pink" />
                Solved Difficulty rating breakdown
              </h4>
              
              {ratingStats.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-mono text-xs">
                  No rated solved problems registered to Codeforce server.
                </div>
              ) : (
                <div className="font-mono">
                  {/* Dynamic SVG Visualizer Bar Chart */}
                  <div className="h-64 w-full flex items-end gap-1.5 md:gap-3 px-2 pt-6 pb-2 border-b border-l border-gray-800">
                    {ratingStats.map((item) => {
                      const heightPercent = maxProbCount > 0 ? (item.count / maxProbCount) * 85 : 0;
                      // Color spectrum from lightweight green (800 rating) to purple/red (2400 rating)
                      let barColor = "bg-green-400";
                      if (item.rating >= 2000) barColor = "bg-pink-500";
                      else if (item.rating >= 1600) barColor = "bg-blue-400";
                      else if (item.rating >= 1200) barColor = "bg-cyan-400";

                      return (
                        <div key={item.rating} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                          {/* Hover Tooltip card popup */}
                          <div className="absolute bottom-full mb-2 bg-cyber-panel border border-cyber-pink/50 text-white p-2 rounded rounded-br-none shadow-neon-pink opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none text-[10px] whitespace-nowrap">
                            <span className="text-cyber-cyan font-bold">{item.rating} Rating</span>: <span className="font-extrabold text-[#00ff87]">{item.count}</span> solved
                          </div>

                          {/* Glowing vertical bar */}
                          <div 
                            className={`w-full rounded-t-sm transition-all duration-700 relative ${barColor}`} 
                            style={{ height: `${Math.max(4, heightPercent)}%` }}
                          >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                          
                          {/* Vertical Axis labels for ratings */}
                          <span className="text-[9px] font-bold text-gray-500 rotate-45 transform origin-left mt-2 whitespace-nowrap block absolute top-full left-1/2 -translate-x-1/2">
                            {item.rating}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Spacing for vertical text */}
                  <div className="h-10"></div>
                </div>
              )}
            </div>

            {/* Codeforces Contest Tracker */}
            <div className="bg-cyber-panel rounded-xl border border-gray-900 p-5 md:p-6 shadow-indigo-500/10" id="cf-contest-tracker">
              <h4 className="text-sm font-bold tracking-widest text-purple-400 uppercase flex items-center gap-2 mb-4 font-mono">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Codeforces Contest Performance Tracker
              </h4>

              {!profile?.contests || profile.contests.length === 0 ? (
                <div className="py-8 text-center text-gray-500 font-mono text-xs border border-dashed border-gray-800 rounded-lg">
                  No rated Codeforces contest participation records detected for this student.
                </div>
              ) : (
                <div className="font-mono space-y-3">
                  {/* Embedded high-fidelity interactive SVG rating trend line graph */}
                  <ContestRatingChart contests={profile.contests} />

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs" id="contests-table">
                      <thead>
                        <tr className="border-b border-gray-900 text-[10px] text-purple-400 uppercase font-bold tracking-wider">
                          <th className="py-2.5 px-3">Contest Detail</th>
                          <th className="py-2.5 px-3 text-center w-20">Rank</th>
                          <th className="py-2.5 px-3 text-center w-24">Rating Shift</th>
                          <th className="py-2.5 px-3 text-center w-36">New Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-900/40">
                        {profile.contests
                          .slice()
                          .reverse()
                          .slice(0, showAllContests ? undefined : 5)
                          .map((contest) => {
                            const delta = contest.newRating - contest.oldRating;
                            const isPositive = delta >= 0;
                            const shiftColor = isPositive ? "text-[#00ff87]" : "text-red-400";
                            const shiftSign = isPositive ? "+" : "";
                            const currentRankStyles = getRankStyles(contest.newRating);

                            return (
                              <tr key={contest.contestId} className="hover:bg-cyber-dark/30 transition-colors">
                                <td className="py-3 px-3">
                                  <a
                                    href={`https://codeforces.com/contest/${contest.contestId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-white hover:text-cyber-cyan font-semibold block max-w-sm truncate transition-colors"
                                    title={contest.contestName}
                                  >
                                    {contest.contestName}
                                  </a>
                                  <span className="text-[10px] text-gray-500">
                                    {new Date(contest.ratingUpdateTimeSeconds * 1000).toLocaleDateString()}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-gray-300">
                                  #{contest.rank}
                                </td>
                                <td className={`py-3 px-3 text-center font-bold font-mono ${shiftColor}`}>
                                  {shiftSign}{delta}
                                </td>
                                <td className="py-3 px-3 text-center font-semibold text-white/95">
                                  <span className="text-gray-500 text-[10px] font-normal mr-1.5">{contest.oldRating} ➔</span>
                                  <span className={currentRankStyles.textColor}>{contest.newRating}</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {profile.contests.length > 5 && (
                    <div className="text-center pt-3 border-t border-gray-900">
                      <button
                        onClick={() => setShowAllContests(!showAllContests)}
                        className="text-xs text-cyber-cyan hover:text-[#00ff87] font-bold tracking-wider uppercase transition-colors cursor-pointer"
                        id="toggle-all-contests-btn"
                      >
                        {showAllContests ? "[ SHOW FEWER CONTESTS ]" : `[ SHOW ALL ${profile.contests.length} CONTEST PARTICIPATIONS ]`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Solved Problems Catalog */}
            <div className="bg-cyber-panel rounded-xl neon-border-pink p-5 md:p-6" id="solved-problems-list">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h4 className="text-sm font-bold tracking-widest text-[#00ff87] uppercase flex items-center gap-2 font-mono">
                    <CheckCircle className="w-4 h-4 text-[#00ff87]" />
                    Solved Problems Database Catalog
                  </h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Live tracking of unique AC submissions
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <Search className="w-3.5 h-3.5 text-cyber-cyan" />
                  </span>
                  <input
                    id="user-problem-search"
                    type="text"
                    placeholder="Search standard problem..."
                    value={problemSearch}
                    onChange={(e) => setProblemSearch(e.target.value)}
                    className="w-full bg-cyber-dark text-white rounded-lg pl-9 pr-4 py-1.5 text-xs font-mono border border-gray-800 focus:border-cyber-cyan focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Reset selected filter header */}
              {selectedTag && (
                <div className="mb-4 flex items-center justify-between p-2.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/20 text-xs font-mono">
                  <span className="text-[#00f0ff] font-medium">Filtering by tag: <span className="font-extrabold uppercase">#{selectedTag}</span> ({filteredProblems.length} elements)</span>
                  <button 
                    onClick={() => setSelectedTag(null)} 
                    className="text-gray-400 hover:text-white cursor-pointer font-bold tracking-wide"
                  >
                    [CLEAR FILTER]
                  </button>
                </div>
              )}

              {filteredProblems.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-gray-800 rounded-lg bg-cyber-dark/40 font-mono">
                  <p className="text-gray-500 text-xs">No matching solved problems register discovered on terms</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs" id="problems-table">
                      <thead>
                        <tr className="border-b border-gray-900 text-[10px] text-cyber-cyan uppercase font-bold tracking-wider">
                          <th className="py-3 px-3 text-center w-16">ID</th>
                          <th className="py-3 px-3">Problem Statement Name</th>
                          <th className="py-3 px-3 text-center w-24">Difficulty</th>
                          <th className="py-3 px-3 hidden sm:table-cell">Tags</th>
                          <th className="py-3 px-3 text-center w-32">Solved At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-900/40">
                        {paginatedProblems.map((p) => {
                          let rateColor = "text-green-400";
                          if (p.rating >= 2100) rateColor = "text-red-400 font-bold";
                          else if (p.rating >= 1900) rateColor = "text-orange-400 font-bold";
                          else if (p.rating >= 1500) rateColor = "text-blue-400";
                          else if (p.rating >= 1200) rateColor = "text-cyan-400";

                          return (
                            <tr key={`${p.contestId}-${p.index}`} className="hover:bg-cyber-dark/30 transition-colors">
                              {/* Problem index ID Code */}
                              <td className="py-3 px-3 text-center font-bold text-gray-500">
                                {p.contestId}{p.index}
                              </td>

                              {/* Problem Name with link */}
                              <td className="py-3 px-3">
                                <a
                                  href={`https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white hover:text-cyber-pink font-semibold flex items-center gap-1 transition-colors"
                                >
                                  {p.name}
                                  <ExternalLink className="w-3 h-3 text-gray-600 inline shrink-0" />
                                </a>
                              </td>

                              {/* Problem Rating difficulty */}
                              <td className="py-3 px-3 text-center">
                                <span className={`font-extrabold ${rateColor}`}>
                                  {p.rating ? p.rating : "—"}
                                </span>
                              </td>

                              {/* Problem Tags list */}
                              <td className="py-3 px-3 hidden sm:table-cell">
                                <div className="flex flex-wrap gap-1 max-w-[240px]">
                                  {p.tags.slice(0, 3).map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => setSelectedTag(t)}
                                      className={`px-1.5 py-0.5 rounded text-[9px] hover:text-white hover:border-cyber-cyan transition-colors font-semibold ${
                                        selectedTag === t 
                                          ? "text-cyber-cyan border border-cyber-cyan/40 bg-cyber-cyan/10" 
                                          : "text-gray-500 border border-transparent bg-cyber-dark/60 h-auto"
                                      }`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                  {p.tags.length > 3 && (
                                    <span className="text-[8px] text-gray-600 block self-center">
                                      +{p.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Solved Timestamp */}
                              <td className="py-3 px-3 text-center text-gray-500 text-[10px]">
                                {new Date(p.solvedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination control bar */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-900 font-mono text-xs select-none">
                      <span className="text-gray-500 font-medium">
                        Showing <span className="text-white font-bold">{Math.min(filteredProblems.length, (currentPage - 1) * problemsPerPage + 1)}-{Math.min(filteredProblems.length, currentPage * problemsPerPage)}</span> of <span className="text-white font-bold">{filteredProblems.length}</span> problems
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <span className="text-gray-400 px-1 font-bold">
                          {currentPage} / {totalPages}
                        </span>

                        <button
                          onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
