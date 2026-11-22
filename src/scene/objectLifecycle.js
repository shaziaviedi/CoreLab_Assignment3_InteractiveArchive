// Observe topology changes once, instead of traversing the scene on a timer.
export function observeObjectTree(root, onAdd, onRemove) {
  const listeners = new Map();
  function attach(object) {
    if (listeners.has(object)) return;
    const added = ({ child }) => attach(child);
    const removed = ({ child }) => detach(child);
    listeners.set(object, { added, removed });
    object.addEventListener("childadded", added);
    object.addEventListener("childremoved", removed);
    onAdd(object);
    object.children.forEach(attach);
  }
  function detach(object) {
    const entry = listeners.get(object);
    if (!entry) return;
    object.children.forEach(detach);
    object.removeEventListener("childadded", entry.added);
    object.removeEventListener("childremoved", entry.removed);
    listeners.delete(object);
    onRemove(object);
  }
  attach(root);
  return () => detach(root);
}
