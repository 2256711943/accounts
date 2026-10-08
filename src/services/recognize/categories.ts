/**
 * 内置分类 + L0 规则识别关键词映射（亮/识别）。
 *
 * 内置分类随 app 进包（避免首屏依赖网络，SPEC.md §5.2）。分类的 `key` 是云端与
 * 本地账单的唯一标识（`LedgerRecord.categoryId`），`name/icon/color` 仅供 UI 展示。
 *
 * `KEYWORDS` 是 L0 规则识别的分类映射表：每类一组高频词，识别时对输入文本做
 * 子串匹配，命中最多的分类即结果（`services/recognize/rule.ts`）。
 */
import type { Category } from '@/types/model';

/** 内置分类清单（sort 升序即默认展示顺序） */
export const CATEGORIES: Category[] = [
  { key: 'food', name: '餐饮', icon: '🍜', color: '#F0A32B', sort: 1 },
  { key: 'transport', name: '交通', icon: '🚇', color: '#4C86F5', sort: 2 },
  { key: 'shopping', name: '购物', icon: '🛍️', color: '#6C4BFF', sort: 3 },
  { key: 'daily', name: '日用', icon: '🧻', color: '#12A594', sort: 4 },
  { key: 'medicine', name: '医疗', icon: '💊', color: '#E0464B', sort: 5 },
  { key: 'housing', name: '居住', icon: '🏠', color: '#F0A32B', sort: 6 },
  { key: 'entertainment', name: '娱乐', icon: '🎮', color: '#4C86F5', sort: 7 },
  { key: 'income', name: '收入', icon: '💰', color: '#12A594', sort: 8 },
  { key: 'other', name: '其他', icon: '📦', color: '#8A8F98', sort: 99 },
];

/** 默认分类：未命中任何关键词时兜底 */
export const DEFAULT_CATEGORY_KEY = 'other';

/**
 * 关键词 → 分类映射（L0）。命中数量越多置信越高，`rule.ts` 据此取最高票分类。
 * 词条尽量用「收据/菜单/账单上高频出现」的片语，命中率优先。
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ['餐厅', '食堂', '外卖', '奶茶', '咖啡', '小吃', '面', '饭', '汉堡', '肯德基', '麦当劳',
    '必胜客', '火锅', '烧烤', '早餐', '午餐', '晚餐', '美食', '甜点', '蛋糕', '水果', '超市零食'],
  transport: ['地铁', '公交', '打车', '出租车', '滴滴', '高铁', '火车', '机票', '加油', '停车', '高速',
    '单车', '共享单车', '车票', '里程'],
  shopping: ['天猫', '淘宝', '京东', '拼多多', '商城', '百货', '服饰', '鞋', '包', '数码', '手机',
    '电器', '化妆品', '超市', '便利店'],
  daily: ['毛巾', '纸巾', '牙膏', '洗护', '日用品', '洗衣', '清洁', '垃圾袋', '厨具', '五金'],
  medicine: ['药', '药店', '医院', '门诊', '挂号', '体检', '诊所', '康复'],
  housing: ['房租', '物业', '水电', '燃气', '宽带', '维修', '装修'],
  entertainment: ['电影', '影院', '游戏', 'KTV', '演出', '门票', '游乐园', '视频会员', '音乐'],
  income: ['工资', '奖金', '补贴', '报销', '退款', '转账', '红包', '稿费', '分红'],
};