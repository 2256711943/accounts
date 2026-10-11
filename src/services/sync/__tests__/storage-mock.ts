/**
 * 单测用的 uni storage mock（D10）—— queue / snapshot / flush 三个单测共用。
 * vitest(node) 环境无全局 uni，这里 stub 最小 storage 子集（get/set/remove）。
 * 用 Map 模拟跨调用持久化，并可预置数据 / 注入读取异常。
 */
import { vi } from 'vitest';

export function installUniStorageMock(): {
  store: Map<string, unknown>;
  uniMock: {
    getStorageSync: ReturnType<typeof vi.fn<(key: string) => unknown>>;
    setStorageSync: ReturnType<typeof vi.fn<(key: string, value: unknown) => void>>;
    removeStorageSync: ReturnType<typeof vi.fn<(key: string) => void>>;
  };
} {
  const store = new Map<string, unknown>();
  const uniMock = {
    getStorageSync: vi.fn((key: string) => store.get(key)),
    setStorageSync: vi.fn((key: string, value: unknown) => void store.set(key, value)),
    removeStorageSync: vi.fn((key: string) => void store.delete(key)),
  };
  vi.stubGlobal('uni', uniMock);
  return { store, uniMock };
}
