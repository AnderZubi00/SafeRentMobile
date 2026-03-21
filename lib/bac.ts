/**
 * BAC (Basic Access Control) — ICAO 9303 Part 11
 * Cryptographic primitives for ePassport NFC authentication
 */
import CryptoJS from "crypto-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MrzFields {
  /** 9-char MRZ document number (numero de soporte), right-padded with '<' */
  documentNumber: string;
  /** Date of birth YYMMDD */
  dateOfBirth: string;
  /** Date of expiry YYMMDD */
  dateOfExpiry: string;
}

export interface BacKeys {
  ka: number[]; // 16 bytes — 3DES encryption key
  kb: number[]; // 16 bytes — 3DES MAC key
}

// ---------------------------------------------------------------------------
// Helpers: WordArray ↔ number[]
// ---------------------------------------------------------------------------

function toWordArray(bytes: number[]): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
        ((bytes[i + 1] ?? 0) << 16) |
        ((bytes[i + 2] ?? 0) << 8) |
        (bytes[i + 3] ?? 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function fromWordArray(wa: CryptoJS.lib.WordArray): number[] {
  const bytes: number[] = [];
  const words = wa.words;
  const sigBytes = wa.sigBytes;
  for (let i = 0; i < sigBytes; i++) {
    bytes.push((words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Check digit — ICAO 9303 (NOT standard Luhn)
// ---------------------------------------------------------------------------

export function computeCheckDigit(str: string): number {
  const charValue = (c: string): number => {
    if (c >= "0" && c <= "9") return parseInt(c, 10);
    if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
    return 0; // '<' and anything else
  };
  const weights = [7, 3, 1];
  return (
    str
      .toUpperCase()
      .split("")
      .reduce((sum, c, i) => sum + charValue(c) * weights[i % 3], 0) % 10
  );
}

// ---------------------------------------------------------------------------
// Build 25-char key seed string
// ---------------------------------------------------------------------------

export function buildKmrz(fields: MrzFields): string {
  // Pad documentNumber to exactly 9 chars with '<'
  const docNum = fields.documentNumber.toUpperCase().padEnd(9, "<").slice(0, 9);
  const docCheck = computeCheckDigit(docNum);
  const dobCheck = computeCheckDigit(fields.dateOfBirth);
  const expCheck = computeCheckDigit(fields.dateOfExpiry);

  return `${docNum}${docCheck}${fields.dateOfBirth}${dobCheck}${fields.dateOfExpiry}${expCheck}`;
}

// ---------------------------------------------------------------------------
// 3DES key parity adjustment (odd parity)
// ---------------------------------------------------------------------------

function adjustParity(bytes: number[]): number[] {
  return bytes.map((b) => {
    // Count 1-bits in bits 7..1
    let val = b & 0xfe;
    let ones = 0;
    for (let mask = 0x02; mask <= 0x80; mask <<= 1) {
      if (val & mask) ones++;
    }
    // Set bit 0 so total 1-bits is odd
    return ones % 2 === 0 ? b | 0x01 : b & 0xfe;
  });
}

// ---------------------------------------------------------------------------
// Derive Ka and Kb from Kseed — ICAO 9303 Part 11 §9.7.3
// ---------------------------------------------------------------------------

function deriveKey(kseed: number[], counter: number): number[] {
  // D = Kseed (16 bytes) + counter (4 bytes big-endian)
  const d = [
    ...kseed,
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  ];
  const hash = fromWordArray(CryptoJS.SHA1(toWordArray(d))); // 20 bytes
  // Take bytes 0..7 and 8..15 (skip parity bytes 7 and 15 — NOT true, take all 16)
  // ICAO spec: take first 16 bytes of SHA-1, then adjust parity
  const keyBytes = hash.slice(0, 16);
  return adjustParity(keyBytes);
}

export async function deriveBacKeys(kmrz: string): Promise<BacKeys> {
  const kseed = fromWordArray(
    CryptoJS.SHA1(CryptoJS.enc.Latin1.parse(kmrz))
  ).slice(0, 16);

  return {
    ka: deriveKey(kseed, 0x00000001),
    kb: deriveKey(kseed, 0x00000002),
  };
}

// ---------------------------------------------------------------------------
// ISO 9797-1 padding method 2: append 0x80, then 0x00 to 8-byte boundary
// ---------------------------------------------------------------------------

function pad8(data: number[]): number[] {
  const padded = [...data, 0x80];
  while (padded.length % 8 !== 0) padded.push(0x00);
  return padded;
}

// ---------------------------------------------------------------------------
// Retail MAC — ISO 9797-1 Algorithm 3
// NOT HMAC. DES(k1) → DES-decrypt(k2) → DES(k1)
// ---------------------------------------------------------------------------

export function retailMac(kb: number[], data: number[]): number[] {
  const k1 = toWordArray(kb.slice(0, 8));
  const k2 = toWordArray(kb.slice(8, 16));
  const padded = pad8(data);

  const opts = {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.NoPadding,
  };

  let result = new Array(8).fill(0);

  for (let i = 0; i < padded.length; i += 8) {
    const block = padded.slice(i, i + 8);
    const xored = block.map((b, j) => b ^ result[j]);
    result = fromWordArray(
      CryptoJS.DES.encrypt(toWordArray(xored), k1, opts).ciphertext
    );
  }

  // Middle step: DES-decrypt with k2
  result = fromWordArray(
    CryptoJS.DES.decrypt(
      { ciphertext: toWordArray(result) } as CryptoJS.lib.CipherParams,
      k2,
      opts
    )
  );

  // Final step: DES-encrypt with k1
  result = fromWordArray(
    CryptoJS.DES.encrypt(toWordArray(result), k1, opts).ciphertext
  );

  return result; // 8 bytes
}

// ---------------------------------------------------------------------------
// 3DES-CBC encrypt / decrypt
// ---------------------------------------------------------------------------

function tripleDesEncrypt(key: number[], iv: number[], data: number[]): number[] {
  const opts = {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
    iv: toWordArray(iv),
  };
  return fromWordArray(
    CryptoJS.TripleDES.encrypt(toWordArray(data), toWordArray(key), opts)
      .ciphertext
  );
}

function tripleDesDecrypt(key: number[], iv: number[], data: number[]): number[] {
  const opts = {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
    iv: toWordArray(iv),
  };
  return fromWordArray(
    CryptoJS.TripleDES.decrypt(
      { ciphertext: toWordArray(data) } as CryptoJS.lib.CipherParams,
      toWordArray(key),
      opts
    )
  );
}

// ---------------------------------------------------------------------------
// Build MUTUAL AUTHENTICATE cmd_data (40 bytes)
// ---------------------------------------------------------------------------

export function buildMutualAuthData(
  rndIfd: number[], // 8 random bytes
  rndIcc: number[], // 8 bytes from GET CHALLENGE
  kIfd: number[], // 16 random bytes (our key contribution)
  keys: BacKeys
): number[] {
  const IV = new Array(8).fill(0);
  // S = rnd_ifd || rnd_icc || k_ifd  (32 bytes)
  const S = [...rndIfd, ...rndIcc, ...kIfd];
  const eIfd = tripleDesEncrypt(keys.ka, IV, S); // 32 bytes
  const mIfd = retailMac(keys.kb, eIfd); // 8 bytes
  return [...eIfd, ...mIfd]; // 40 bytes
}

// ---------------------------------------------------------------------------
// Verify MUTUAL AUTHENTICATE response (40 bytes)
// ---------------------------------------------------------------------------

export function verifyMutualAuthResponse(
  response: number[], // 40 bytes from card
  rndIfd: number[],
  keys: BacKeys
): boolean {
  if (response.length < 40) return false;

  const eIcc = response.slice(0, 32);
  const mIcc = response.slice(32, 40);

  // Verify MAC
  const expectedMac = retailMac(keys.kb, eIcc);
  if (!expectedMac.every((b, i) => b === mIcc[i])) return false;

  // Decrypt and verify rnd_ifd echo
  const IV = new Array(8).fill(0);
  const decrypted = tripleDesDecrypt(keys.ka, IV, eIcc); // 32 bytes: rnd_icc || rnd_ifd || k_icc
  const rndIfdEcho = decrypted.slice(8, 16);
  return rndIfd.every((b, i) => b === rndIfdEcho[i]);
}

// ---------------------------------------------------------------------------
// Random bytes helper
// ---------------------------------------------------------------------------

export function randomBytes(n: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(Math.floor(Math.random() * 256));
  }
  return arr;
}
