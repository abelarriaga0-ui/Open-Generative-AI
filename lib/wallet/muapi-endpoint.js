// Muapi endpoint slugs legitimately contain version dots (e.g. wan2.2).
// Reject slashes, protocol URLs, query strings, traversal and doubled separators.
export function isAllowedMuapiEndpoint(value) {
  return typeof value==='string' && value.length>=3 && value.length<=100 &&
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}
