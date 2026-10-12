/**
 * 账单列表 store —— D5 首页数据源 + D10 离线优先（亮点 H3）。
 *
 * 归口职责：
 * - 列表 + 游标分页 + 分类筛选 + 加载状态机（首拉 / 加载更多 / 错误）。
 * - 缓存直出：init 先用 `sl:records:cache` 快照渲染首屏，再静默拉服务端。
 * - 乐观增删改：新增/编辑/删除先落本地（快照 + 同步队列）立即上屏，
 *   在线则触发 flush 自动同步（ARCHITECTURE.md §4.2）。
 * - 待同步状态：`pendingCount` 供首页待同步条 / 我的页「立即同步」。
 *
 * 依赖方向：store → services/sync → api → adapters。
 */

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { ApiCallError, call } from '@/api/client';
import { monthStartTicks } from '@/utils/format';
import { generateId } from '@/utils/id';
import { getNetworkState, onNetworkChange } from '@/adapters/system';
import * as queue from '@/services/sync/queue';
import * as snapshot from '@/services/sync/snapshot';
import { flush as flushQueue, type FlushSummary } from '@/services/sync/flush';
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

  /** 是否在线（网络监听维护；驱动「恢复网络自动同步」）。 */
  const online = ref(true);
  /** 待同步的账单条数（不同 clientId 计数），>0 时首页显示待同步条。 */
  const pendingCount = ref(0);
  /** 待同步的 clientId 集合（列表项「待同步」徽标用）。 */
  const pendingIds = ref<Set<string>>(new Set());
  /** 同步失败（tries > MAX_TRIES）的 clientId 集合（列表项「同步失败·重试」用，D11）。 */
  const failedIds = ref<Set<string>>(new Set());

  let unlisten: (() => void) | null = null;

  /** 由快照 + 待同步队列重建列表视图：服务端为准，本地 pending 记录覆盖，pending delete 移除。 */
  function rebuildList(serverList: LedgerRecord[]): void {
    const snap = snapshot.loadSnapshot();
    const snapById = new Map(snap.map((r) => [r.clientId, r]));
    const pending = queue.getAll();
    const pendingById = new Map(pending.map((t) => [t.clientId, t]));
    const deleting = new Set(pending.filter((t) => t.op === 'delete').map((t) => t.clientId));
    const cid = categoryId.value;
    const seen = new Set<string>();
    const out: LedgerRecord[] = [];

    const pass = (r: LedgerRecord): boolean =>
      !!r && !r.deleted && !deleting.has(r.clientId) && (!cid || r.categoryId === cid);

    for (const r of serverList) {
      if (!pass(r)) continue;
      const merged = snapById.get(r.clientId) ?? r;
      if (!pass(merged)) continue;
      out.push(merged);
      seen.add(r.clientId);
    }
    // 补上「本地新增/编辑但服务端还没有」的 pending 记录（离线新增立即上屏）
    for (const r of snap) {
      const p = pendingById.get(r.clientId);
      if (!p || p.op === 'delete' || seen.has(r.clientId) || !pass(r)) continue;
      out.push(r);
      seen.add(r.clientId);
    }
    out.sort((a, b) => b.happenedAt - a.happenedAt);
    list.value = out;
  }

  function refreshPending(): void {
    pendingIds.value = new Set(queue.pendingClientIds());
    pendingCount.value = pendingIds.value.size;
    failedIds.value = new Set(queue.getAll().filter(queue.isFailed).map((t) => t.clientId));
  }

  /** 重试某条失败账单（D11）：重试计数归零后立即触发补传。 */
  function retry(clientId: string): void {
    if (!queue.resetTries(clientId)) return;
    refreshPending();
    if (online.value) void flush();
  }

  /** 同步当前队列；完成后用服务端回执后的快照重绘列表。 */
  async function flush(): Promise<FlushSummary | null> {
    if (queue.count() === 0) return null;
    const summary = await flushQueue();
    refreshPending();
    rebuildList(list.value);
    return summary;
  }

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
      rebuildList(data.list);
      nextCursor.value = data.nextCursor;
      hasMore.value = data.hasMore;
      offline.value = false;
    } catch (err) {
      const e = catchError(err);
      error.value = e;
      offline.value = e.code === 'NETWORK';
      // 拉取失败（如断网）：保底用本地快照渲染，不让首屏空
      if (e.code === 'NETWORK' && list.value.length === 0) rebuildList(snapshot.loadSnapshot());
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
      rebuildList(list.value);
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

  /**
   * 启动接线（App.vue onLaunch）：
   * 1. 快照缓存直出首屏；2. 网络状态初始化 + 监听恢复触发同步；3. 静默拉服务端。
   * 返回退订函数（H5/测试可用）。
   */
  function init(): () => void {
    refreshPending();
    rebuildList(snapshot.loadSnapshot());

    getNetworkState((nowOnline) => {
      online.value = nowOnline;
      if (nowOnline) void flush();
    });
    unlisten = onNetworkChange((nowOnline) => {
      const prev = online.value;
      online.value = nowOnline;
      if (nowOnline && !prev) void flush();
    });

    void fetch();
    return () => {
      unlisten?.();
      unlisten = null;
    };
  }

  /** 乐观新增：先落本地立即上屏，在线则触发同步。返回补全 clientId 的记录。 */
  function createLocal(record: LedgerRecord, baseVersion = 0): LedgerRecord {
    const final = { ...record };
    if (!final.clientId) final.clientId = generateId();
    queue.enqueue({ clientId: final.clientId, op: 'create', payload: final, baseVersion });
    snapshot.upsertRecord(final);
    rebuildList(list.value);
    refreshPending();
    if (online.value) void flush();
    return final;
  }

  /** 乐观更新：字段级补丁入队，快照合并，在线触发同步。 */
  function updateLocal(clientId: string, patch: Partial<LedgerRecord>, baseVersion: number): void {
    const cur = snapshot.loadSnapshot().find((r) => r.clientId === clientId);
    if (!cur) return; // 本地无此条（已被删），忽略
    const merged: LedgerRecord = { ...cur, ...patch };
    snapshot.upsertRecord(merged);
    queue.enqueue({ clientId, op: 'update', payload: patch, baseVersion });
    rebuildList(list.value);
    refreshPending();
    if (online.value) void flush();
  }

  /** 乐观删除：软删任务入队，列表立即移除，在线触发同步。 */
  function removeLocal(clientId: string): void {
    snapshot.removeRecord(clientId);
    queue.enqueue({ clientId, op: 'delete', payload: {}, baseVersion: 0 });
    rebuildList(list.value);
    refreshPending();
    if (online.value) void flush();
  }

  /** 清空本地缓存后调用（我的页）：重建视图 + 刷新待同步计数。 */
  function resetLocal(): void {
    refreshPending();
    rebuildList(snapshot.loadSnapshot());
  }

  return {
    list,
    nextCursor,
    hasMore,
    loading,
    loadingMore,
    error,
    categoryId,
    since,
    offline,
    online,
    pendingCount,
    pendingIds,
    failedIds,
    fetch,
    loadMore,
    setCategory,
    init,
    flush,
    retry,
    createLocal,
    updateLocal,
    removeLocal,
    resetLocal,
  };
});
