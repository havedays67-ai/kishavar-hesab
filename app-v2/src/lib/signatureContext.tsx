import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayJalali, type JDate } from "./format";
import { entityPayloadHash, computeSignatureHash, auditEntity, type SignatureRecord, type SignableEntity, type SignatureRole, type SignatureMethod, type SignatureAudit } from "./signatures";
import { signPayloadCrypto } from "./crypto";

const STORAGE_KEY = "kishavar.signatures.v2";

interface SignatureContextValue {
  records: SignatureRecord[];
  sign: (input: {
    entity: SignableEntity;
    role: SignatureRole;
    signerName: string;
    signerPhone: string;
    signerNationalId?: string;
    method: SignatureMethod;
    image: string;
    note?: string;
  }) => Promise<SignatureRecord>;
  remove: (id: string) => void;
  audit: (entity: SignableEntity) => SignatureAudit;
  auditById: (entity: SignableEntity) => SignatureAudit;
}

const SignatureContext = createContext<SignatureContextValue | null>(null);

function loadRecords(): SignatureRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SignatureRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SignatureProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<SignatureRecord[]>(loadRecords);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      /* ignore */
    }
  }, [records]);

  const value = useMemo<SignatureContextValue>(() => {
    const audit = (entity: SignableEntity) => auditEntity(entity, records);
    return {
      records,
      audit,
      auditById: audit,
      sign: async ({ entity, role, signerName, signerPhone, signerNationalId = "", method, image, note = "" }) => {
        const payloadHash = entityPayloadHash(entity.payload);
        const previousRecords = [...records.filter((record) => record.entityId === entity.id)].sort((a, b) => a.signedAtIso.localeCompare(b.signedAtIso));
        const previousHash = previousRecords.length ? previousRecords[previousRecords.length - 1].signatureHash : payloadHash;
        const signedAtIso = new Date().toISOString();
        const signatureHash = computeSignatureHash({
          entityType: entity.type,
          entityId: entity.id,
          role,
          signerName,
          signedAtIso,
          payloadHash,
          previousHash,
        });
        const signedAt: JDate = todayJalali();
        const cryptoResult = await signPayloadCrypto(JSON.stringify({ entityId: entity.id, entityType: entity.type, role, signerName, signerPhone, payloadHash, previousHash, signedAtIso }));
        const record: SignatureRecord = {
          id: `sig-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          entityType: entity.type,
          entityId: entity.id,
          role,
          signerName: signerName.trim(),
          signerPhone,
          signerNationalId,
          method,
          image,
          crypto: cryptoResult,
          signedAt,
          signedAtIso,
          payloadHash,
          previousHash,
          signatureHash,
          verifyCode: signatureHash.slice(0, 12).toUpperCase(),
          note,
        };
        setRecords((current) => [...current, record]);
        return record;
      },
      remove: (id: string) => setRecords((current) => current.filter((record) => record.id !== id)),
    };
  }, [records]);

  return <SignatureContext.Provider value={value}>{children}</SignatureContext.Provider>;
}

export function useSignatures(): SignatureContextValue {
  const context = useContext(SignatureContext);
  if (!context) throw new Error("useSignatures must be used inside SignatureProvider");
  return context;
}
