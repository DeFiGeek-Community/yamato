export function timeout(ms) {
  console.log(`Wainting for mining... (${ms}ms)`);
  return new Promise(resolve => setTimeout(resolve, ms));
}