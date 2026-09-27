/**
 * 账单列表 store —— D5 首页数据源。
 *
 * 归口职责：列表 + 游标分页 + 分类筛选 + 加载状态机（首拉 / 加载更多 / 错误）。
 * 数据来自云函数 `record.list`（已含 `_openid` 强制隔离与软删滤除），经统一通道 `call()`。
 *
 * 依赖方向：store → api（不经过 components/UI，也不读全局 store）。
 */

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { ApiCallError, call } from '@/api/client';
import { monthStartTicks } from '@/utils/format';
import type { LedgerRecord } from '@/types/model';

const PAGE_SIZE = 20;

export interface RecordStoreError {
  code: string;
  message: string;
}

export const useRecordStore = defineStore('record', () => {
  const list = ref<LedgerRecord[]>([]);
  const nextCursor = ref<string | null>(null);
  const hasMore = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<RecordStoreError | null>(null);
  const categoryId = ref<string | null>(null);
  /** 默认只拉本月（首页总支出 = 本月列表合计，占位待 stats.monthly）。 */
  const since = ref<number>(monthStartTicks(0));

  /** 通道级失败（网络断 / SDK 不可用）→ 前端判「离线」。 */
  const offline = ref(false);

  function catchError(err: unknown): RecordStoreError {
    if (err instanceof ApiCallError) {
      return { code: err.code, message: err.message };
    }
    return { code: 'UNKNOWN', message: String(err) };
  }

  async function fetch(reset = true): Promise<void> {
    if (reset) {
      list.value = [];
      nextCursor.value = null;
      hasMore.value = false;
    }
    loading.value = true;
    loadingMore.value = false;
    error.value = null;
    try {
      const data = await call('record.list', {
        limit: PAGE_SIZE,
        since: since.value,
        ...(categoryId.value ? { categoryId: categoryId.value } : {}),
      });
      list.value = data.list;
      nextCursor.value = data.nextCursor;
      hasMore.value = data.hasMore;
      offline.value = false;
    } catch (err) {
      const e = catchError(err);
      error.value = e;
      offline.value = e.code === 'NETWORK';
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || loading.value || loadingMore.value || nextCursor.value === null) return;
    loadingMore.value = true;
    try {
      const data = await call('record.list', {
        limit: PAGE_SIZE,
        since: since.value,
        cursor: nextCursor.value,
        ...(categoryId.value ? { categoryId: categoryId.value } : {}),
      });
      list.value = [...list.value, ...data.list];
      nextCursor.value = data.nextCursor;
      hasMore.value = data.hasMore;
      offline.value = false;
    } catch (err) {
      const e = catchError(err);
      error.value = e;
      offline.value = e.code === 'NETWORK';
    } finally {
      loadingMore.value = false;
    }
  }

  /** 切换分类筛选：更新条件并从第一页重拉。入参 `null` 表示「全部」。 */
  async function setCategory(id: string | null): Promise<void> {
    if (categoryId.value === id) return;
    categoryId.value = id;
    await fetch(true);
  }

  return { list, nextCursor, hasMore, loading, loadingMore, error, categoryId, since, offline, fetch, loadMore, setCategory };
});