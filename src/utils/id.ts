/**
 * 幂等键生成（clientId / taskId）：uuid v4 兼容格式。
 * 不依赖 `crypto.randomUUID`（低版本小程序/H5 兼容性），用 Math.random 填充。
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}