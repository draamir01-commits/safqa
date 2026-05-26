import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  User 
} from "firebase/auth";
import { auth, db } from "./config";
import { doc, setDoc } from "firebase/firestore";

const googleProvider = new GoogleAuthProvider();

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  // Use redirect on localhost (popup is blocked), popup on production
  const isLocalhost = window.location.hostname === "localhost" || 
                      window.location.hostname === "127.0.0.1";
  
  if (isLocalhost) {
    await signInWithRedirect(auth, googleProvider);
    return null; // page will redirect and come back
  } else {
    const credential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      email: user.email,
      displayName: user.displayName,
      createdAt: new Date()
    }, { merge: true });
    return user;
  }
}

// Call this on app startup to handle redirect result after Google login
export async function handleGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      const user = result.user;
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date()
      }, { merge: true });
      return user;
    }
  } catch (err) {
    console.error("Google redirect result error:", err);
  }
  return null;
}

export async function registerWithEmail(email: string, password: string, name: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;
  await updateProfile(user, { displayName: name });
  const userDocRef = doc(db, "users", user.uid);
  await setDoc(userDocRef, {
    email,
    displayName: name,
    createdAt: new Date()
  });
  return user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return auth.onAuthStateChanged(callback);
}

export async function updateUserProfile(userId: string, data: any) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, data, { merge: true });
}
