import { Box3, Vector3 } from "three";
import { observeObjectTree } from "./objectLifecycle.js";

export function createCameraObstacles(scene) {
  const roots = new Set();
  let dirty = true;
  let boxes = [];
  let treeBoxes = [];
  const dispose = observeObjectTree(scene, (object) => {
    if (object.userData.cameraObstacle) roots.add(object);
    dirty = true;
  }, (object) => {
    roots.delete(object);
    dirty = true;
  });
  return {
    getBoxes(treeView = false) {
      if (!dirty) return treeView ? treeBoxes : boxes;
      scene.updateMatrixWorld(true);
      // Padding includes the existing vegetation sway; no per-frame bounds needed.
      const objects = [...roots];
      boxes = objects.map((object) => new Box3().setFromObject(object).expandByScalar(0.3));
      // In the close tree view, collide with trunks rather than empty
      // bounding boxes spanning canopies. Buildings and bushes stay intact.
      treeBoxes = objects.map((object, index) => {
        if (!object.userData.treeTrunk) return boxes[index];
        const center = object.getWorldPosition(new Vector3());
        const radius = object.userData.survivorTree ? 0.55 : 0.35;
        return new Box3(
          center.clone().add(new Vector3(-radius, 0, -radius)),
          center.clone().add(new Vector3(radius, 2.6, radius)),
        );
      });
      dirty = false;
      return treeView ? treeBoxes : boxes;
    },
    dispose,
  };
}
