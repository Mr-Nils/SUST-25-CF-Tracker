import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, terminate } from "firebase/firestore";

async function main() {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

  try {
    const studentsSnap = await getDocs(collection(db, "students"));
    console.log("Total students in Firestore:", studentsSnap.size);
    studentsSnap.forEach((doc) => {
      const data = doc.data();
      console.log(`Document [${doc.id}]:`, {
        keys: Object.keys(data),
        name: data.name,
        handle: data.handle,
        regNo: data.regNo,
        addedAt: data.addedAt,
        cfData_exists: !!data.cfData,
        lastCfUpdate: data.lastCfUpdate
      });
    });
  } finally {
    await terminate(db);
  }
}

main().catch(console.error);
