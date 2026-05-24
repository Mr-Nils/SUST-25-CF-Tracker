import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");

// Ensure data directory and file exist with initial seed data
function initData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STUDENTS_FILE)) {
    const seedStudents = [
      {
        name: "Nilkontha Das (Creator)",
        handle: "Nilkontha",
        regNo: "202561201065",
        addedAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(seedStudents, null, 2), "utf8");
  }
}

initData();

const app = express();
app.use(express.json());

// In-Memory cache for Codeforces API responses to prevent rate limiting
const cacheDuration = 5 * 60 * 1000; // 5 minutes list cache
const cfUserCache: Record<string, { data: any; timestamp: number }> = {};
const cfSubmissionsCache: Record<string, { data: any; timestamp: number }> = {};

// Helper function to fetch user info from Codeforces with caching
async function fetchCFUserInfo(handles: string[]) {
  const handlesToFetch = [];
  const result: any[] = [];

  // Check cache for each handle
  const now = Date.now();
  for (const h of handles) {
    const lowerH = h.toLowerCase();
    if (cfUserCache[lowerH] && (now - cfUserCache[lowerH].timestamp < cacheDuration)) {
      result.push(cfUserCache[lowerH].data);
    } else {
      handlesToFetch.push(h);
    }
  }

  // If we have uncached handles, load them from CF API
  if (handlesToFetch.length > 0) {
    // Codeforces user.info accepts semicolon separated handles
    const url = `https://codeforces.com/api/user.info?handles=${handlesToFetch.join(";")}`;
    try {
      console.log(`[CF API] Fetching info for: ${handlesToFetch.join(", ")}`);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === "OK" && Array.isArray(data.result)) {
        data.result.forEach((info: any) => {
          const lowerH = info.handle.toLowerCase();
          cfUserCache[lowerH] = {
            data: info,
            timestamp: Date.now()
          };
          result.push(info);
        });
      } else {
        console.warn(`[CF API Error] Semicolon batch fetch failed: ${data.comment || "Unknown error"}. Falling back to individual queries.`);
        
        // Loop and fetch individual profiles so one bad handle doesn't crash the entire list
        for (const singleHandle of handlesToFetch) {
          const singleUrl = `https://codeforces.com/api/user.info?handles=${singleHandle}`;
          try {
            const singleResponse = await fetch(singleUrl);
            const singleData = await singleResponse.json();
            
            if (singleData.status === "OK" && Array.isArray(singleData.result) && singleData.result.length > 0) {
              const info = singleData.result[0];
              const lowerH = info.handle.toLowerCase();
              cfUserCache[lowerH] = {
                data: info,
                timestamp: Date.now()
              };
            } else {
              console.error(`[CF API Error] Individual handle "${singleHandle}" could not be resolved: ${singleData.comment}`);
              // Cache unrated metadata placeholder with error flag so we don't request spam Codeforces API repeatedly
              const lowerH = singleHandle.toLowerCase();
              cfUserCache[lowerH] = {
                data: {
                  handle: singleHandle,
                  rating: 0,
                  maxRating: 0,
                  rank: "unrated",
                  maxRank: "unrated",
                  avatar: "https://userpic.codeforces.org/no-avatar.jpg",
                  offline: true,
                  error: "not_found"
                },
                timestamp: Date.now()
              };
            }
          } catch (err) {
            console.error(`[CF API Error] Exception during individual query for "${singleHandle}":`, err);
          }
        }
      }
    } catch (e) {
      console.error(`[CF API Exception]`, e);
    }
  }

  // Map requested handles in order (including cached and newly loaded ones)
  // Fill missing handles with offline/null structure to prevent crashes
  return handles.map(h => {
    const lowerH = h.toLowerCase();
    return cfUserCache[lowerH]?.data || {
      handle: h,
      rating: 0,
      maxRating: 0,
      rank: "unrated",
      maxRank: "unrated",
      avatar: "https://userpic.codeforces.org/no-avatar.jpg",
      offline: true
    };
  });
}

// Helper to fetch solved problems statistics from Codeforces
async function fetchCFUserSubmissions(handle: string) {
  const lowerH = handle.toLowerCase();
  const now = Date.now();

  if (cfSubmissionsCache[lowerH] && (now - cfSubmissionsCache[lowerH].timestamp < cacheDuration)) {
    return cfSubmissionsCache[lowerH].data;
  }

  const url = `https://codeforces.com/api/user.status?handle=${handle}`;
  try {
    console.log(`[CF API] Fetching submissions for: ${handle}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && Array.isArray(data.result)) {
      const submissions = data.result;
      
      // Filter solved problems (verdict: "OK")
      // Ensure unique problems solved by tracking (contestId, index) or (problem name)
      const solvedProblemsMap = new Map();
      
      submissions.forEach((sub: any) => {
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

      // Extract details
      const ratingDistribution: Record<number, number> = {};
      const tagDistribution: Record<string, number> = {};

      solvedList.forEach(prob => {
        if (prob.rating) {
          ratingDistribution[prob.rating] = (ratingDistribution[prob.rating] || 0) + 1;
        }
        prob.tags.forEach((tag: string) => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      });

      const stats = {
        totalSolved,
        solvedProblems: solvedList,
        ratingDistribution,
        tagDistribution,
        lastUpdated: Date.now()
      };

      cfSubmissionsCache[lowerH] = {
        data: stats,
        timestamp: Date.now()
      };

      return stats;
    }
  } catch (e) {
    console.error(`[CF API Exception Submissions] for ${handle}`, e);
  }

  return {
    totalSolved: 0,
    solvedProblems: [],
    ratingDistribution: {},
    tagDistribution: {},
    offline: true,
    lastUpdated: Date.now()
  };
}

// 1. Get all registered students
app.get("/api/users", (req, res) => {
  try {
    if (!fs.existsSync(STUDENTS_FILE)) {
      return res.json([]);
    }
    const data = fs.readFileSync(STUDENTS_FILE, "utf8");
    const students = JSON.parse(data);
    res.json(students);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read students list", details: error.message });
  }
});

// 2. Register a new student
app.post("/api/users", async (req, res) => {
  try {
    const { name, handleInput, regNo } = req.body;

    if (!name || !handleInput || !regNo) {
      return res.status(400).json({ error: "Name, CF Link/Handle, and Registration number are required." });
    }

    // Parse handle from Codeforces link if user paste the link
    // e.g., https://codeforces.com/profile/tourist or codeforces.com/profile/tourist
    let handle = handleInput.trim();
    if (handle.includes("codeforces.com")) {
      const parts = handle.split("/profile/");
      if (parts.length > 1) {
        handle = parts[1].split("/")[0].split("?")[0];
      } else {
        const partsContest = handle.split("/profile/");
        // Fallback for general paths
        handle = parts[parts.length - 1].trim();
      }
    }
    handle = handle.replace(/[@#]/g, "").trim(); // cleanse special chars if any

    if (!handle) {
      return res.status(400).json({ error: "Could not parse a valid Codeforces handle from input." });
    }

    // Verify handle existence with Codeforces API
    const url = `https://codeforces.com/api/user.info?handles=${handle}`;
    const cfRes = await fetch(url);
    const cfData = await cfRes.json();

    if (cfData.status !== "OK" || !cfData.result || cfData.result.length === 0) {
      return res.status(400).json({ error: `The Codeforces handle "${handle}" could not be found or verified by Codeforces API.` });
    }

    // Get verified handle capitalization representing real user
    const verifiedHandle = cfData.result[0].handle;

    // Load existing
    let students = [];
    if (fs.existsSync(STUDENTS_FILE)) {
      students = JSON.parse(fs.readFileSync(STUDENTS_FILE, "utf8"));
    }

    // Check duplicate handle or registration number
    const isDuplicateHandle = students.some((s: any) => s.handle.toLowerCase() === verifiedHandle.toLowerCase());
    const isDuplicateReg = students.some((s: any) => s.regNo.trim() === regNo.trim());

    if (isDuplicateHandle) {
      return res.status(400).json({ error: `Codeforces handle "${verifiedHandle}" is already registered.` });
    }
    if (isDuplicateReg) {
      return res.status(400).json({ error: `Registration number "${regNo}" is already registered.` });
    }

    // Save
    const newStudent = {
      name: name.trim(),
      handle: verifiedHandle,
      regNo: regNo.trim(),
      addedAt: new Date().toISOString()
    };

    students.push(newStudent);
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(students, null, 2), "utf8");

    // Cache user info immediately to avoid extra delay later
    cfUserCache[verifiedHandle.toLowerCase()] = {
      data: cfData.result[0],
      timestamp: Date.now()
    };

    res.json({ success: true, student: newStudent });
  } catch (error: any) {
    console.error("[Register Error]", error);
    res.status(500).json({ error: "Failed to register student", details: error.message });
  }
});

// 3. Remove/Unregister database user (for ease of administration and management)
app.delete("/api/users/:handle", (req, res) => {
  try {
    const { handle } = req.params;
    const clientPassword = req.headers["x-creator-password"] as string || "";
    const securePassword = process.env.CREATOR_PASSWORD || "202561201065";

    if (clientPassword.trim() !== securePassword.trim()) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Creator verification code/password." });
    }

    if (!fs.existsSync(STUDENTS_FILE)) {
      return res.status(404).json({ error: "No students dataset found." });
    }
    const students = JSON.parse(fs.readFileSync(STUDENTS_FILE, "utf8"));
    const updated = students.filter((s: any) => s.handle.toLowerCase() !== handle.toLowerCase());
    
    if (students.length === updated.length) {
      return res.status(404).json({ error: "Student not found." });
    }

    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(updated, null, 2), "utf8");
    res.json({ success: true, message: `Successfully removed user "${handle}"` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete student", details: error.message });
  }
});

// 4. Batch get CF Info for of all students
app.get("/api/cf/users-status", async (req, res) => {
  try {
    if (!fs.existsSync(STUDENTS_FILE)) {
      return res.json([]);
    }
    const students = JSON.parse(fs.readFileSync(STUDENTS_FILE, "utf8"));
    const handles = students.map((s: any) => s.handle);

    if (handles.length === 0) {
      return res.json([]);
    }

    // Fetch batch user stats
    const cfUsersInfo = await fetchCFUserInfo(handles);

    // Combine student record with CF info
    const fullState = students.map((student: any) => {
      const cfInfo = cfUsersInfo.find((u: any) => u.handle.toLowerCase() === student.handle.toLowerCase()) || {};
      return {
        ...student,
        cfData: cfInfo
      };
    });

    res.json(fullState);
  } catch (error: any) {
    console.error("[CF Users Status API Error]", error);
    res.status(500).json({ error: "Failed to compile Codeforces user metadata status.", details: error.message });
  }
});

// 5. Get individual student Codeforces submissions statistics
app.get("/api/cf/user-profile/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    
    // Get info
    const [userInfo] = await fetchCFUserInfo([handle]);
    const submissionsInfo = await fetchCFUserSubmissions(handle);

    res.json({
      info: userInfo,
      submissions: submissionsInfo
    });
  } catch (error: any) {
    console.error("[Individual Profile API Error]", error);
    res.status(500).json({ error: "Failed to retrieve student profile statistics.", details: error.message });
  }
});

// 6. Verify Creator Password securely
app.post("/api/auth/verify-creator", (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const securePassword = process.env.CREATOR_PASSWORD || "202561201065";
    
    if (password.trim() === securePassword.trim()) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ error: "Access Denied: Invalid Creator Verification Code/Password." });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to verify password", details: error.message });
  }
});

// Setup Vite & static service
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
