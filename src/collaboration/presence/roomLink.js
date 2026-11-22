export function memorialRoomUrl(currentUrl, roomId) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId ?? "")) throw new Error("This room link is invalid.");
  const url = new URL(currentUrl);
  // Preserve a GitHub Pages repo path, without sharing diagnostics or identity.
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", roomId);
  return url.toString();
}
