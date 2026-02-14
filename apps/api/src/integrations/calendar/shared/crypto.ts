// Re-export token encryption from QuickBooks module
// Uses same AES-256-GCM key (QBO_ENCRYPTION_KEY env var)
// TODO: Rename env var to ENCRYPTION_KEY in Phase 12 when consolidating
export { encryptToken, decryptToken } from '../../quickbooks/crypto.js';
