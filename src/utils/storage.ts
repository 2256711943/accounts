/**
 * 本地存储工具。跨端统一读取缓存占用并格式化为可读字节。
 */

/** 统计本机 storage 占用的字节数（MP 用 `getStorageInfoSync`；H5 遍历 localStorage）。 */
export function getStorageSizeBytes(): number {
  // #ifdef MP-WEIXIN
  try {
    const info = uni.getStorageInfoSync();
    return info.currentSize || 0; // KB
  } catch {
    return 0;
  }
  // #endif
  // #ifndef MP-WEIXIN
  try {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k: string = localStorage.key(i) ?? '';
      if (!k) continue;
      const v: string = localStorage.getItem(k) ?? '';
      bytes += (k.length + v.length) * 2;
    }
    return bytes;
  } catch {
    return 0;
  }
  // #endif
}

/** 可读的缓存占用：MP 返回 KB → `12.5 KB`；H5 按字节 → `1.2 MB`。 */
export function getStorageSizeLabel(): string {
  // #ifdef MP-WEIXIN
  const kb = getStorageSizeBytes();
  return `${(kb / 1024).toFixed(1)} KB`;
  // #endif
  // #ifndef MP-WEIXIN
  const bytes = getStorageSizeBytes();
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // #endif
}