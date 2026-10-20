// Versioned comparison policy. Search depth, not elapsed time, controls fallback.
// This bounds detailed search without making grouping depend on CPU load.
// The guarded build adapter makes MergeView rebuild all chunks after each edit.
export const DIFF_POLICY_VERSION = 'canonical-full-v1';
export const DIFF_CONFIG = Object.freeze({ scanLimit: 1500, timeout: 0 });
