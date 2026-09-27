// 内存版云数据库 —— 供 ledger 逻辑层单测使用。
//
// 只实现 logic.js 用到的子集（cloudfunctions/ledger/logic.js 顶部有契约注释），
// 语义刻意对齐 wx-server-sdk：where 查询构造是惰性的，直到调 .get() 才过滤排序。
//
// 为何不 mock wx-server-sdk 的分子 API 来驱动 exports.main：
//   wx-server-sdk 依赖云上环境（init / getWXContext），本地无法直接 require；
//   而入口 index.js 与我们关心的「幂等 / 乐观并发 / 软删 / 游标分页」是两回事。
//   逻辑已全部下沉到 logic.createLedgerHandlers({ db })，注入本适配器即可覆盖全部业务路径。

/** 条件标记 —— 模拟 db.command 返回的操作符对象 */
const OP = {
  or: (branches) => ({ $op: 'or', branches }),
  and: (branches) => ({ $op: 'and', branches }),
  lt: (v) => ({ $op: 'lt', v }),
  lte: (v) => ({ $op: 'lte', v }),
  gt: (v) => ({ $op: 'gt', v }),
  gte: (v) => ({ $op: 'gte', v }),
  neq: (v) => ({ $op: 'neq', v }),
};

/** 判断单个字段值是否命中某条件（可能是操作符标记或字面量） */
function matchesField(actual, cond) {
  if (cond && typeof cond === 'object' && '$op' in cond) {
    switch (cond.$op) {
      case 'lt':
        return actual < cond.v;
      case 'lte':
        return actual <= cond.v;
      case 'gt':
        return actual > cond.v;
      case 'gte':
        return actual >= cond.v;
      case 'neq':
        return actual !== cond.v;
      default:
        return false;
    }
  }
  return actual === cond;
}

/**
 * 判断文档是否命中一条 where 条件。条件可能是：
 *   - 操作符标记（and / or）
 *   - 普通对象 { 字段: {...} } → 逐字段匹配
 */
function matchesWhere(doc, cond) {
  if (cond && typeof cond === 'object' && '$op' in cond) {
    if (cond.$op === 'and') return cond.branches.every((b) => matchesWhere(doc, b));
    if (cond.$op === 'or') return cond.branches.some((b) => matchesWhere(doc, b));
    return false;
  }
  return Object.keys(cond).every((k) => matchesField(doc[k], cond[k]));
}

/**
 * 构建逻辑层可用的 db 接口。
 * @param {Array} seed 初始数据集（可选）
 */
function createMemoryDb(seed = []) {
  const rows = seed.slice();

  // 惰性查询构造器
  function makeQuery(cond) {
    const state = { cond, order: [], skip: 0, limit: null };
    const c = {
      where(next) {
        state.cond = next;
        return c;
      },
      orderBy(field, dir) {
        state.order.push([field, dir]);
        return c;
      },
      skip(n) {
        state.skip = n;
        return c;
      },
      limit(n) {
        state.limit = n;
        return c;
      },
      async get() {
        let data = rows.filter((r) => !state.cond || matchesWhere(r, state.cond));
        // 按 order 排序（稳定、支持复合键）
        for (let i = state.order.length - 1; i >= 0; i -= 1) {
          const [field, dir] = state.order[i];
          data = data.sort((a, b) => {
            if (!a[field] && !b[field]) return 0;
            if (!a[field]) return 1;
            if (!b[field]) return -1;
            if (a[field] === b[field]) return 0;
            return dir === 'desc' ? (a[field] > b[field] ? -1 : 1) : a[field] > b[field] ? 1 : -1;
          });
        }
        let out = data;
        if (state.skip) out = out.slice(state.skip);
        if (state.limit != null) out = out.slice(0, state.limit);
        return { data: out };
      },
    };
    return c;
  }

  let idSeq = 1;

  return {
    command: OP,
    collection(name) {
      if (name !== 'ledger_records') throw new Error(`未预期集合：${name}`);
      return {
        where: (cond) => makeQuery(cond),
        add: async ({ data }) => {
          const _id = `mem-${idSeq++}`;
          rows.push({ _id, ...data });
          return { _id };
        },
        doc(id) {
          return {
            // 只更新已存在文档；返回 stats.updated 供判幂等/影响行数
            async update({ data }) {
              const target = rows.find((r) => r._id === id);
              if (!target) return { stats: { updated: 0 } };
              Object.assign(target, data);
              return { stats: { updated: 1 } };
            },
          };
        },
      };
    },
    // 测试读快照用
    inspect() {
      return rows.map((r) => ({ ...r }));
    },
    reset() {
      rows.length = 0;
    },
  };
}

module.exports = { createMemoryDb, OP, matchesField, matchesWhere };