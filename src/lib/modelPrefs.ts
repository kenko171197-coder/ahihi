// Model người dùng chọn cho từng tác vụ (lưu trong trình duyệt, gửi kèm mỗi lần gọi server).
import { TASKS, modelInfo } from '../../shared/models';

const KEY = 'xuong_model_prefs';

export function loadModelPrefs(): Record<string, string> {
  const defaults = Object.fromEntries(TASKS.map((t) => [t.key, t.model]));
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Model đã ngừng hoặc không dùng được cho việc viết chữ → trả về mặc định
    for (const [k, v] of Object.entries(saved)) {
      const m = modelInfo(String(v));
      if (m && m.text && m.status !== 'shutdown' && k in defaults) defaults[k] = String(v);
    }
  } catch {
    /* bỏ qua */
  }
  return defaults;
}

export function saveModelPrefs(prefs: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* bỏ qua */
  }
}

export const resetModelPrefs = () => saveModelPrefs(Object.fromEntries(TASKS.map((t) => [t.key, t.model])));

export const modelPrefsHeader = () => encodeURIComponent(JSON.stringify(loadModelPrefs()));
