// TrueLive — o ao vivo de verdade (menor atraso possível)
// © 2026 Vitor Plentz — GPL-3.0
// Based on ZeroDelay by João Gustavo França — see THIRD-PARTY-NOTICES.md

// ---------------------------------------------------------------------------
// PIX "Copia e Cola" / QR Code (BR Code, EMV-MPM standard) builder.
//
// Everything is generated locally — no network requests — so it complies with
// the Chrome MV3 "no remotely hosted code" rule.
//
// To change the recipient, edit the three constants below. Keep the name and
// city ASCII and UPPERCASE (no accents): name <= 25 chars, city <= 15 chars.
// ---------------------------------------------------------------------------
export const PIX_KEY = '22890078-d19c-4a4f-92f1-d9fc9233c2f0';  // chave aleatória (EVP) — não expõe dados pessoais no código público
export const MERCHANT_NAME = 'VITOR PLENTZ';
export const MERCHANT_CITY = 'JOACABA';

// Suggested tip amounts, in BRL, priced as round dollar equivalents
// (~US$ 1/3/5/10) so tiers feel natural to an international audience.
// The first one is the default selection. The UI also offers an OPEN amount
// chip (buildPixCode(0)): the payer types whatever they want in the bank app.
export const PIX_AMOUNTS = [5, 15, 25, 50];
export const PIX_DEFAULT_AMOUNT = 5;

// International (non-PIX) donation page in USD, for users without a Brazilian
// bank. A static link the user CLICKS is not a network request by the
// extension (zero-request policy holds). Empty string = button hidden.
export const INTL_DONATE_URL = '';

// One EMV field: ID + 2-digit length + value.
function field(id, value) {
    return id + String(value.length).padStart(2, '0') + value;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the payload including the
// "6304" tag, returned as 4 uppercase hex digits — exactly as the BR Code spec
// requires. Exported so its standard check vector can be unit-tested.
export function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Build the full "copia e cola" string. Pass a positive amount to lock the
// value, or 0/undefined to leave it open (the payer types the amount in their
// bank app).
export function buildPixCode(amount) {
    const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', PIX_KEY);
    // Upper bound keeps toFixed() in plain decimal notation (>= 1e21 would go
    // exponential and corrupt the EMV field); out-of-range -> open amount.
    const hasAmount = Number.isFinite(amount) && amount > 0 && amount < 1e9;
    const body =
        field('00', '01') +                          // Payload Format Indicator
        field('26', merchantAccount) +               // Merchant Account Info (Pix)
        field('52', '0000') +                        // Merchant Category Code
        field('53', '986') +                         // Transaction Currency = BRL
        (hasAmount ? field('54', amount.toFixed(2)) : '') + // Transaction Amount
        field('58', 'BR') +                          // Country Code
        field('59', MERCHANT_NAME) +                 // Recipient name
        field('60', MERCHANT_CITY) +                 // Recipient city
        field('62', field('05', '***')) +            // Additional data (txid = ***)
        '6304';                                      // CRC-16 tag + length
    return body + crc16(body);
}
