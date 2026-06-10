import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, getDoc, query, where } from "firebase/firestore";

const PORT = 3000;

// Initialize Firebase SDK via official Web Client SDK
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Ensure database has initial seed data
async function initData() {
  try {
    const studentsSnap = await getDocs(collection(db, "students"));
    if (studentsSnap.empty) {
      console.log("[Firebase init] Seeding default Creator student document...");
      const creatorHandle = "Nilkontha";
      const creatorDoc = {
        name: "Nilkontha Das (Creator)",
        handle: creatorHandle,
        regNo: "202561201065",
        addedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "students", creatorHandle.toLowerCase()), creatorDoc);
      console.log("[Firebase init] Seed successful!");
    } else {
      console.log("[Firebase init] Database contains records. Seeding skipped.");
    }
  } catch (err) {
    console.error("[Firebase init Error] Failed to initialize/seed database:", err);
  }
}

const app = express();
app.use(express.json());

// In-Memory cache for Codeforces API responses to prevent rate limiting
const cacheDuration = 5 * 60 * 1000; // 5 minutes list cache
const cfUserCache: Record<string, { data: any; timestamp: number }> = {};
const cfSubmissionsCache: Record<string, { data: any; timestamp: number }> = {};
const cfContestsCache: Record<string, { data: any; timestamp: number }> = {};

// Global tracker for Codeforces server IP block/rate limit (preventing log pollution and wasteful delays)
let isServerIpBlocked = false;
let serverBlockedUntil = 0;

function checkServerBlock(): boolean {
  if (isServerIpBlocked && Date.now() < serverBlockedUntil) {
    return true;
  }
  isServerIpBlocked = false;
  return false;
}

function flagServerBlocked() {
  if (!isServerIpBlocked) {
    console.warn("[CF API Gatekeeper] Flagging server IP as blocked or rate-limited by Codeforces. Standard server fetches will be bypassed to prevent rate limits/downtime log spam.");
  }
  isServerIpBlocked = true;
  serverBlockedUntil = Date.now() + 15 * 60 * 1000; // Bypassed for 15 minutes
}

// Helper function to fetch user info from Codeforces with caching and smart batch retries
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
    if (checkServerBlock()) {
      console.log(`[CF API Gatekeeper] Server IP is temporarily blocked. Serving cached/offline placeholders for: ${handlesToFetch.join(", ")}`);
    } else {
      let activeHandles = [...handlesToFetch];
      let fetchSuccess = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (activeHandles.length > 0 && !fetchSuccess && attempts < maxAttempts) {
        attempts++;
        const url = `https://codeforces.com/api/user.info?handles=${activeHandles.join(";")}`;
        try {
          console.log(`[CF API] Batch fetch attempt ${attempts} for ${activeHandles.length} handles: ${activeHandles.join(", ")}`);
          const response = await fetch(url);
          
          // Handle non-JSON responses gracefully (e.g. Cloudflare or downtime HTML)
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await response.text();
            console.warn(`[CF API Error] Non-JSON response received (likely Cloudflare block/CAPTCHA):`, text.substring(0, 200));
            flagServerBlocked();
            break;
          }

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
            fetchSuccess = true;
            console.log(`[CF API] Successfully batch resolved info for ${data.result.length} handles.`);
          } else if (data.status === "FAILED" && data.comment) {
            console.warn(`[CF API Batch Failed] ${data.comment}`);
            
            if (data.comment.includes("Call limit exceeded")) {
              console.warn(`[CF API Rate Limited] "Call limit exceeded" on batch. Stopping immediate retries.`);
              flagServerBlocked();
              break;
            }

            // Parse invalid handle from comment e.g. "handles: User with handle touristt not found"
            const match = data.comment.match(/User with handle (.*?) not found/i);
            if (match && match[1]) {
              const badHandle = match[1].trim();
              console.log(`[CF API Handle Resolver] Identified invalid handle: "${badHandle}". Caching as unrated and retrying without it.`);
              
              // Cache bad handle to prevent querying it later
              cfUserCache[badHandle.toLowerCase()] = {
                data: {
                  handle: badHandle,
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

              // Remove bad handle and retry remaining list in the next loop iteration
              activeHandles = activeHandles.filter(h => h.toLowerCase() !== badHandle.toLowerCase());
            } else {
              console.warn(`[CF API Error] Unmapped batch error comment: "${data.comment}". Falling back.`);
              break;
            }
          } else {
            console.warn(`[CF API Error] Unexpected response status/format:`, data);
            break;
          }
        } catch (err) {
          console.error(`[CF API Exception on attempt ${attempts}]`, err);
          flagServerBlocked();
          break;
        }
      }

      // Gentle recovery fallback using individual requests with deliberate spacing of 1.1s to avoid hitting 1 req/sec limit
      if (!fetchSuccess && activeHandles.length > 0 && !checkServerBlock()) {
        console.log(`[CF API Recovery] Initiating gentle individual fetches for remaining ${activeHandles.length} handles.`);
        let spacedRequestIndex = 0;
        for (const h of activeHandles) {
          if (checkServerBlock()) {
            console.log(`[CF API Gatekeeper] Aborting remaining recovery queries due to server block.`);
            break;
          }

          const lowerH = h.toLowerCase();
          
          // Check if we already cached this as an error/not_found in this cycle
          if (cfUserCache[lowerH] && cfUserCache[lowerH].data.error === "not_found") {
            continue;
          }

          const singleUrl = `https://codeforces.com/api/user.info?handles=${h}`;
          try {
            if (spacedRequestIndex > 0) {
              // Wait 1.1 seconds before executing the next request to prevent Call limit exceeded
              console.log(`[CF API Throttle] Delaying individual request for "${h}" by 1100ms...`);
              await new Promise(resolve => setTimeout(resolve, 1100));
            }
            spacedRequestIndex++;

            const response = await fetch(singleUrl);
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const data = await response.json();
              if (data.status === "OK" && Array.isArray(data.result) && data.result.length > 0) {
                const info = data.result[0];
                cfUserCache[lowerH] = {
                  data: info,
                  timestamp: Date.now()
                };
                console.log(`[CF API Recovery] Successfully loaded individual handle "${h}".`);
              } else {
                console.warn(`[CF API Recovery Failed] Individual profile lookup for "${h}": ${data.comment || "Not found"}`);
                cfUserCache[lowerH] = {
                  data: {
                    handle: h,
                    rating: 0,
                    maxRating: 0,
                    rank: "unrated",
                    maxRank: "unrated",
                    avatar: "https://userpic.codeforces.org/no-avatar.jpg",
                    offline: true,
                    error: data.comment && data.comment.includes("Call limit exceeded") ? "rate_limited" : "not_found"
                  },
                  timestamp: Date.now()
                };
                if (data.comment?.includes("Call limit exceeded")) {
                  flagServerBlocked();
                }
              }
            } else {
              console.warn(`[CF API Recovery Failed] Individual profile lookup for "${h}" returned non-JSON.`);
              flagServerBlocked();
            }
          } catch (singleErr) {
            console.error(`[CF API Recovery Exception] for "${h}":`, singleErr);
          }
        }
      }
    }
  }

  // Return mapped handles in order
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

  if (checkServerBlock()) {
    console.log(`[CF API Gatekeeper] Server IP is temporarily blocked. Serving offline submissions fallback structure for: ${handle}`);
    return {
      totalSolved: 0,
      solvedProblems: [],
      ratingDistribution: {},
      tagDistribution: {},
      offline: true,
      lastUpdated: Date.now()
    };
  }

  const url = `https://codeforces.com/api/user.status?handle=${handle}`;
  try {
    console.log(`[CF API] Fetching submissions for: ${handle}`);
    const response = await fetch(url);
    
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn(`[CF API Submissions Error] Non-JSON response received (likely Cloudflare block) for: ${handle}`);
      flagServerBlocked();
      throw new Error("Cloudforces API returned non-JSON");
    }

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

// Helper to fetch contest rating history from Codeforces
async function fetchCFUserContests(handle: string) {
  const lowerH = handle.toLowerCase();
  const now = Date.now();

  if (cfContestsCache[lowerH] && (now - cfContestsCache[lowerH].timestamp < cacheDuration)) {
    return cfContestsCache[lowerH].data;
  }

  if (checkServerBlock()) {
    console.log(`[CF API Gatekeeper] Server IP is temporarily blocked. Serving offline contests fallback structure for: ${handle}`);
    return [];
  }

  const url = `https://codeforces.com/api/user.rating?handle=${handle}`;
  try {
    console.log(`[CF API] Fetching contests history for: ${handle}`);
    const response = await fetch(url);
    
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn(`[CF API Contests Error] Non-JSON response received (likely Cloudflare block) for: ${handle}`);
      flagServerBlocked();
      throw new Error("Cloudforces API returned non-JSON");
    }

    const data = await response.json();

    if (data.status === "OK" && Array.isArray(data.result)) {
      cfContestsCache[lowerH] = {
        data: data.result,
        timestamp: now
      };
      return data.result;
    }
  } catch (e) {
    console.error(`[CF API Exception Contests] for ${handle}`, e);
  }

  return [];
}

// 1. Get all registered students
app.get("/api/users", async (req, res) => {
  try {
    const studentsSnap = await getDocs(collection(db, "students"));
    const students: any[] = [];
    studentsSnap.forEach((doc) => {
      students.push(doc.data());
    });
    res.json(students);
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.GET, "students");
    } catch (loggedErr: any) {
      res.status(500).json({ error: "Failed to read students list", details: loggedErr.message });
    }
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

    // Verify handle existence with Codeforces API (with robust resilience)
    const url = `https://codeforces.com/api/user.info?handles=${handle}`;
    let cfData: any = null;
    try {
      const cfRes = await fetch(url);
      cfData = await cfRes.json();
    } catch (fetchErr: any) {
      console.warn(`[CF Verification Fetch Exception] for ${handle}:`, fetchErr);
    }

    let verifiedHandle = handle;
    let cfUserInfo: any = null;

    if (cfData && cfData.status === "OK" && Array.isArray(cfData.result) && cfData.result.length > 0) {
      // Clean, verified handle directly from official response
      verifiedHandle = cfData.result[0].handle;
      cfUserInfo = cfData.result[0];
    } else {
      // If CF API is rate limited ("Call limit exceeded") or temporarily down/unreachable,
      // we must NOT lock out valid students! Protect historical rosters and allow registration by verifying format.
      // Standard CF handle validation regex: 3 to 24 characters, alphanumeric, hyphen, or underscore
      const handleRegex = /^[a-zA-Z0-9_\-]{3,24}$/;
      if (!handleRegex.test(handle)) {
        return res.status(400).json({
          error: `The handle "${handle}" contains invalid characters or does not meet the Codeforces handle criteria (3-24 characters, letters, digits, '_' or '-').`
        });
      }
      console.log(`[CF API Offline / Rate Limited] Gracefully bypassing validation check for CF handle: ${handle}`);
    }

    // Check duplicate handle
    const studentDocRef = doc(db, "students", verifiedHandle.toLowerCase());
    const studentDocSnap = await getDoc(studentDocRef);
    if (studentDocSnap.exists()) {
      return res.status(400).json({ error: `Codeforces handle "${verifiedHandle}" is already registered.` });
    }

    // Check duplicate registration number
    const regQuerySnap = await getDocs(query(collection(db, "students"), where("regNo", "==", regNo.trim())));
    if (!regQuerySnap.empty) {
      return res.status(400).json({ error: `Registration number "${regNo}" is already registered.` });
    }

        // Save
    const newStudent = {
      name: name.trim(),
      handle: verifiedHandle,
      regNo: regNo.trim(),
      addedAt: new Date().toISOString(),
      cfData: cfUserInfo || undefined
    };

    try {
      await setDoc(studentDocRef, newStudent);
    } catch (writeErr) {
      handleFirestoreError(writeErr, OperationType.WRITE, `students/${verifiedHandle.toLowerCase()}`);
    }

    // Cache user info immediately to avoid extra delay later
    if (cfUserInfo) {
      cfUserCache[verifiedHandle.toLowerCase()] = {
        data: cfUserInfo,
        timestamp: Date.now()
      };
    }

    res.json({ success: true, student: newStudent });
  } catch (error: any) {
    console.error("[Register Error]", error);
    res.status(500).json({ error: "Failed to register student", details: error.message });
  }
});

// 3. Remove/Unregister database user (for ease of administration and management)
app.delete("/api/users/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    const clientPassword = req.headers["x-creator-password"] as string || "";
    const securePassword = process.env.CREATOR_PASSWORD || "202561201065";

    if (clientPassword.trim() !== securePassword.trim()) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Creator verification code/password." });
    }

    const studentDocRef = doc(db, "students", handle.toLowerCase());
    const studentDocSnap = await getDoc(studentDocRef);
    if (!studentDocSnap.exists()) {
      return res.status(404).json({ error: "Student not found." });
    }

    try {
      await deleteDoc(studentDocRef);
    } catch (delErr) {
      handleFirestoreError(delErr, OperationType.DELETE, `students/${handle.toLowerCase()}`);
    }

    res.json({ success: true, message: `Successfully removed user "${handle}"` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete student", details: error.message });
  }
});

// Save client-side resolved Codeforces API cache to Firestore
app.post("/api/cf/save-cache", async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Required updates array not provided." });
    }

    console.log(`[Cache Sync] Received background cache sync request for ${updates.length} handles.`);

    for (const item of updates) {
      const { handle, cfData } = item;
      if (!handle || !cfData) continue;

      try {
        const studentDocRef = doc(db, "students", handle.toLowerCase());
        const studentDocSnap = await getDoc(studentDocRef);
        if (studentDocSnap.exists()) {
          const student = studentDocSnap.data();
          await setDoc(studentDocRef, {
            ...student,
            cfData: cfData,
            lastCfUpdate: new Date().toISOString()
          }, { merge: true });

          // Also populate our local memory cache so subsequent direct loads get it immediately
          cfUserCache[handle.toLowerCase()] = {
            data: cfData,
            timestamp: Date.now()
          };
        }
      } catch (docErr) {
        console.warn(`[Cache Sync Error] Failed to cache student "${handle}":`, docErr);
      }
    }

    res.json({ success: true, message: "Sync complete" });
  } catch (error: any) {
    console.error("[Cache Save Exception]", error);
    res.status(500).json({ error: "Cache sync failed", details: error.message });
  }
});

// 4. Batch get CF Info for of all students with firestore routing caching
app.get("/api/cf/users-status", async (req, res) => {
  try {
    const studentsSnap = await getDocs(collection(db, "students"));
    const students: any[] = [];
    studentsSnap.forEach((doc) => {
      students.push(doc.data());
    });
    
    const handles = students.map((s: any) => s.handle);

    if (handles.length === 0) {
      return res.json([]);
    }

    // Fetch batch user stats from Codeforces API
    const cfUsersInfo = await fetchCFUserInfo(handles);

    // Combine student record with CF info, fallback to existing firestore cache if fresh fetch fails
    const fullState = students.map((student: any) => {
      const freshCfInfo = cfUsersInfo.find((u: any) => u.handle.toLowerCase() === student.handle.toLowerCase());
      
      const isFreshValid = freshCfInfo && !freshCfInfo.offline && !freshCfInfo.error;
      const mergedCfData = isFreshValid ? freshCfInfo : (student.cfData || freshCfInfo || {});

      return {
        ...student,
        cfData: mergedCfData
      };
    });

    // Background update Firestore documents with freshly fetched data so we can fallback next time without rate-limiting blocks
    students.forEach(async (student: any) => {
      const freshCfInfo = cfUsersInfo.find((u: any) => u.handle.toLowerCase() === student.handle.toLowerCase());
      if (freshCfInfo && !freshCfInfo.offline && !freshCfInfo.error) {
        // Only update if there's new data to preserve DB bandwidth
        const existingRating = student.cfData?.rating;
        const freshRating = freshCfInfo.rating;
        const existingAvatar = student.cfData?.avatar;
        const freshAvatar = freshCfInfo.avatar;

        if (existingRating !== freshRating || existingAvatar !== freshAvatar || !student.cfData) {
          try {
            const studentDocRef = doc(db, "students", student.handle.toLowerCase());
            await setDoc(studentDocRef, {
              ...student,
              cfData: freshCfInfo,
              lastCfUpdate: new Date().toISOString()
            }, { merge: true });
          } catch (bgErr) {
            console.warn(`[Background DB Cache Update Failed] for ${student.handle}:`, bgErr);
          }
        }
      }
    });

    res.json(fullState);
  } catch (error: any) {
    console.error("[CF Users Status API Error]", error);
    res.status(500).json({ error: "Failed to compile Codeforces user metadata status.", details: error.message });
  }
});

// 5. Get individual student Codeforces submissions statistics with fallback
app.get("/api/cf/user-profile/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    
    // Get info from Codeforces API
    const [userInfo] = await fetchCFUserInfo([handle]);
    const submissionsInfo = await fetchCFUserSubmissions(handle);
    const contestsInfo = await fetchCFUserContests(handle);

    // Fallback to Firestore cached profile info if fresh fetch returned offline/error
    let mergedUserInfo = userInfo;
    if (userInfo.offline || userInfo.error) {
      try {
        const docRef = doc(db, "students", handle.toLowerCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const studentData = docSnap.data();
          if (studentData && studentData.cfData) {
            mergedUserInfo = {
              ...studentData.cfData,
              cachedAt: studentData.lastCfUpdate,
              isCachedFallback: true
            };
            console.log(`[CF API Fallback] Serving Firestore cached profile info for ${handle}.`);
          }
        }
      } catch (dbErr) {
        console.warn(`[Firestore Profile Fallback Lookup Failed] for ${handle}:`, dbErr);
      }
    }

    res.json({
      info: mergedUserInfo,
      submissions: submissionsInfo,
      contests: contestsInfo
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
  await initData();

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
