// Danh sách mọi tác vụ AI của app. Thêm tác vụ mới: viết def trong defs/, thêm vào đây, thêm file prompt.
import type { TaskDef } from './framework';
import { hoiLai, logline } from './defs/brief';
import { nhanVat } from './defs/nhanVat';
import { treatment } from './defs/treatment';

export const TASK_DEFS: Record<string, TaskDef<any, any>> = {
  [hoiLai.id]: hoiLai,
  [logline.id]: logline,
  [nhanVat.id]: nhanVat,
  [treatment.id]: treatment,
};
