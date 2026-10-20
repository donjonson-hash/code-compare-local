// Versioned comparison policy. Search depth, not elapsed time, controls fallback.
// This bounds detailed search without making grouping depend on CPU load.
// Incremental comparison still takes previous chunks and the edit trace as inputs.
export const DIFF_POLICY_VERSION = 'clock-independent-v1';
export const DIFF_CONFIG = Object.freeze({ scanLimit: 1500, timeout: 0 });
