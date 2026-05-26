import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

// Read file as Base64 helper for offline/CORS resilience
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(companyId: string, folder: string, file: File): Promise<string> {
  try {
    const fileRef = ref(storage, `companies/${companyId}/${folder}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.warn("Storage upload failed or blocked by CORS. Falling back to local Base64 storage.", error);
    // Graceful fallback to raw Base64 representation to preserve seamless design
    return await readFileAsBase64(file);
  }
}

export async function deleteFile(url: string): Promise<void> {
  try {
    // Only attempt if it is a real firebase hosting reference
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
