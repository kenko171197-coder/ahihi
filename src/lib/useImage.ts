import { useEffect, useState } from 'react';
import { getImage } from './images';

// Nhớ tạm các ảnh vừa đọc: chuyển beat / bước rồi quay lại thì ảnh hiện ngay, không nháy trống.
const cache = new Map<string, string>();
const MAX = 80;
function remember(id: string, url: string) {
  cache.delete(id);
  cache.set(id, url);
  if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
}

/** Đọc ảnh từ kho IndexedDB theo id, trả về data URL (hoặc undefined khi chưa có). */
export function useImage(id?: string) {
  const [url, setUrl] = useState<string | undefined>(() => (id ? cache.get(id) : undefined));
  useEffect(() => {
    let alive = true;
    if (!id) {
      setUrl(undefined);
      return;
    }
    const hit = cache.get(id);
    if (hit) {
      setUrl(hit);
      return;
    }
    getImage(id)
      .then((u) => {
        if (u) remember(id, u);
        if (alive) setUrl(u);
      })
      .catch(() => alive && setUrl(undefined));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}
