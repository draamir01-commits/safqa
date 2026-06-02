import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Upload with a 15-second timeout — if Firebase Storage doesn't respond,
// fall back to Base64 so the user is never blocked
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Upload timeout")), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); })
           .catch(e => { clearTimeout(timer); reject(e); });
  });
}

export async function uploadFile(companyId: string, folder: string, file: File): Promise<string> {
  try {
    const fileRef = ref(storage, `companies/${companyId}/${folder}/${Date.now()}_${file.name}`);
    const snapshot = await withTimeout(uploadBytes(fileRef, file), 15000);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    // CORS not configured or offline — fall back to Base64
    // NOTE: Once CORS is configured on the Firebase Storage bucket,
    // this fallback will never be used and uploads will be instant.
    console.warn("Firebase Storage unavailable, using Base64 fallback:", error);
    return await readFileAsBase64(file);
  }
}

export async function deleteFile(url: string): Promise<void> {
  try {
    if (url.includes("firebasestorage.googleapis.com")) {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    }
  } catch (error) {
    console.error("Storage delete failed:", error);
  }
}

export async function uploadLogo(companyId: string, file: File): Promise<string> {
  return uploadFile(companyId, "logos", file);
}

export async function uploadReceipt(companyId: string, file: File): Promise<string> {
  return uploadFile(companyId, "receipts", file);
}
