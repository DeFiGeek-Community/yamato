// _import 関数をエクスポートする
export async function _import(path: string) {
  return await (await import(path)).default();
}
