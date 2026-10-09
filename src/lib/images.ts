// Kho ảnh tham chiếu. Dùng IndexedDB vì localStorage chỉ chứa được vài MB.
const DB_NAME = 'xuong-phim-ai';
const STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Không mở được kho ảnh của trình duyệt.'));
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const request = run(d.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Lưu ảnh (data URL), trả về id. */
export async function putImage(dataUrl: string, id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`) {
  await tx('readwrite', (s) => s.put(dataUrl, id));
  return id;
}

export const getImage = (id: string) => tx<string | undefined>('readonly', (s) => s.get(id));
export const deleteImage = (id: string) => tx('readwrite', (s) => s.delete(id));

/** Đọc file ảnh và thu nhỏ cạnh dài về `max` px (giữ tỉ lệ). */
export function readAndResize(file: File, max = 1536, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}.`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`File ${file.name} không phải ảnh hợp lệ.`));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
        ctx.fillStyle = '#fff'; // ảnh PNG trong suốt → nền trắng
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Thu nhỏ một data URL có sẵn (dùng khi gửi ảnh đi quét cho nhẹ). */
export function shrinkDataUrl(dataUrl: string, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Ảnh hỏng.'));
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

export const splitDataUrl = (dataUrl: string) => {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  return m ? { mime: m[1], data: m[2] } : { mime: 'image/jpeg', data: dataUrl };
};

/** Tải ảnh về máy với tên @tag. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
