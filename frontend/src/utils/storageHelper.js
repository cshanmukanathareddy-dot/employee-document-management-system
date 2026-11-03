/**
 * Storage Helper Utilities & Standards
 * 
 * Implements enterprise standards for storage units (MB/GB),
 * dynamic human-readable formatting, and preset tiers.
 */

export const BYTES_PER_MB = 1024 * 1024;
export const BYTES_PER_GB = 1024 * 1024 * 1024;

export const STANDARD_STORAGE_PRESETS = [
  {
    id: "500mb",
    label: "500 MB",
    sublabel: "0.5 GB",
    gb: 0.5,
    bytes: 500 * BYTES_PER_MB,
    description: "Lightweight documents, IDs, and receipts",
  },
  {
    id: "1gb",
    label: "1 GB",
    sublabel: "Standard",
    gb: 1.0,
    bytes: 1 * BYTES_PER_GB,
    description: "Standard employee document quota",
  },
  {
    id: "2gb",
    label: "2 GB",
    sublabel: "Maximum Initial",
    gb: 2.0,
    bytes: 2 * BYTES_PER_GB,
    description: "Extended quota for high-volume uploads",
  },
];

export const REQUEST_STORAGE_PRESETS = [
  { label: "+500 MB", gb: 0.5 },
  { label: "+1 GB", gb: 1.0 },
  { label: "+2 GB", gb: 2.0 },
  { label: "+5 GB", gb: 5.0 },
];

/**
 * Format raw bytes into human-readable MB or GB
 * E.g., 524288000 -> "500 MB", 1073741824 -> "1 GB", 2684354560 -> "2.5 GB"
 */
export function formatStorageBytes(bytes) {
  const num = Number(bytes);
  if (!num || num <= 0) return "0 MB";

  if (num < BYTES_PER_GB) {
    const mb = Math.round(num / BYTES_PER_MB);
    return `${mb} MB`;
  }

  const gb = num / BYTES_PER_GB;
  const cleanGb = gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(2);
  return `${cleanGb} GB`;
}

/**
 * Format a GB number into human-readable MB or GB
 * E.g., 0.5 -> "500 MB", 1 -> "1 GB", 1.5 -> "1.5 GB"
 */
export function formatStorageGb(gb) {
  const num = Number(gb);
  if (!num || num <= 0) return "0 MB";

  if (num < 1) {
    // 0.5 GB -> 500 MB or 512 MB, round to nearest 10 or exact MB
    const mb = Math.round(num * 1024);
    // If it's close to standard decimal 500MB
    if (Math.abs(num - 0.5) < 0.02) return "500 MB";
    if (Math.abs(num - 0.25) < 0.02) return "250 MB";
    if (Math.abs(num - 0.1) < 0.02) return "100 MB";
    return `${mb} MB`;
  }

  const cleanGb = num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  return `${cleanGb} GB`;
}

/**
 * Convert an input value with a unit ("MB" or "GB") into numeric GB
 */
export function convertToGb(value, unit = "GB") {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 0;

  if (String(unit).toUpperCase() === "MB") {
    return parseFloat((num / 1024).toFixed(4));
  }

  return parseFloat(num.toFixed(4));
}
