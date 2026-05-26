import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAnTMHEC9Kq78qv7RMHYA60t8MQqczjzKs",
  authDomain: "safqa-50714.firebaseapp.com",
  projectId: "safqa-50714",
  storageBucket: "safqa-50714.firebasestorage.app",
  messagingSenderId: "417341632892",
  appId: "1:417341632892:web:e69d812470488c8339b4f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Critical safety check per firebase-integration skill instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firebase collection offline mode active.");
    }
  }
}
testConnection();
