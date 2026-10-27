/**
 * امضای رمزنگاری‌شده روی دستگاه با ECDSA P-256 (Web Crypto).
 * کلید خصوصی در IndexedDB همین برنامه ساخته و نگه‌داری می‌شود و از برنامه خارج نمی‌شود.
 * این امضا برای تشخیص تغییر سند و انتساب بهتر است؛ هنوز گواهی مرکز صدور گواهی (CA) نیست.
 */
import { sha256 } from "./hash";

const DB_NAME = "kishavar-keys";
const STORE = "keys";
const KEY_ID = "primary-ecdsa";

export interface CryptoSignature {
  algorithm: string;
  publicKey: string;
  signature: string;
  keyFingerprint: string;
}

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]);
  return btoa(text);
}

function fromBase64(value: string): Uint8Array {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("پایگاه کلید محلی باز نشد."));
  });
}

async function readKey(): Promise<CryptoKeyPair | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKeyPair | undefined) ?? null);
    request.onerror = () => reject(new Error("خواندن کلید ممکن نشد."));
  });
}

async function writeKey(pair: CryptoKeyPair): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(pair, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("ذخیره کلید ممکن نشد."));
  });
}

async function ensureKeys(): Promise<CryptoKeyPair> {
  if (!globalThis.crypto?.subtle) throw new Error("این دستگاه از امضای رمزنگاری‌شده پشتیبانی نمی‌کند.");
  const existing = await readKey();
  if (existing) return existing;
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  await writeKey(pair);
  return pair;
}

export async function devicePublicKeyInfo(): Promise<{ publicKey: string; keyFingerprint: string } | null> {
  try {
    const pair = await ensureKeys();
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    const publicKey = base64(raw);
    return { publicKey, keyFingerprint: sha256(publicKey).slice(0, 20).toUpperCase() };
  } catch {
    return null;
  }
}

export async function signPayloadCrypto(payload: string): Promise<CryptoSignature> {
  try {
    const pair = await ensureKeys();
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    const publicKey = base64(raw);
    const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(payload));
    return {
      algorithm: "ECDSA-P256-SHA256",
      publicKey,
      signature: base64(signature),
      keyFingerprint: sha256(`${publicKey}|${payload}`).slice(0, 24).toUpperCase(),
    };
  } catch {
    return { algorithm: "unavailable", publicKey: "", signature: "", keyFingerprint: "" };
  }
}

export async function verifyPayloadCrypto(payload: string, record: { publicKey: string; signature: string }): Promise<boolean> {
  try {
    if (!record.publicKey || !record.signature || !globalThis.crypto?.subtle) return false;
    const key = await crypto.subtle.importKey("raw", toArrayBuffer(fromBase64(record.publicKey)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, toArrayBuffer(fromBase64(record.signature)), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}
