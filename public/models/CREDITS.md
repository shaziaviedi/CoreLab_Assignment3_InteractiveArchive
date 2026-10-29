# Model credits

- Plaza grove: Island Tree 02, Poly Haven (CC0).
  Source: https://polyhaven.com/a/island_tree_02
  Locally simplified and repackaged as plaza-tree.glb with 512px WebP PBR textures.
  Decorative broadleaf stand-in, not a botanical model of the Survivor Tree.
- Powered by Poly Haven: https://polyhaven.com (asset discovery API).
- Skyline and Oculus: custom scene geometry.
  Skyline window textures are generated locally in World3D.jsx.

Landmark positions follow the user-supplied map approximately; this is a stylized
interpretation rather than a surveyed reconstruction.

- Reference pavilion: extracted from user-supplied memorial-park-ref.glb.
  Original authorship/license not included in the supplied file; retained for this
  local project. Recoloured in ReferenceMuseum.jsx. Pool centres and scale also
  follow this reference.

- reference-pool.glb: recessed basin extracted from the same user-supplied GLB,
  reused for both pools. Original geometry retained; materials recoloured and
  water ripples added in ReferencePool.jsx; the original waterfall surfaces are
  hidden and replaced by GPU water particles in WaterfallParticles.jsx.

## User-supplied planting models

- jabami-tree-v1.glb: jabami_anime_tree_v1.glb, converted from specular/glossiness
  to metallic/roughness for current Three.js compatibility.
- jabami-tree-v4.glb: jabami_anime_tree_v4.glb.
- jabami-bush.glb: jabami_anime_bush_v1.glb; four variants reused separately.
- survivor-sakura.glb: sakura_tree_01_-_low_poly_model.glb, used for the Survivor Tree.

These replace the Poly Haven tree in the live scene. Original models supplied by
the user; authorship/license details were not supplied. Originals in Downloads
remain unchanged.

## User-supplied architecture

- oculus.glb: wtc-oculus.glb, with distant stray geometry/base planes removed,
  simplified and merged by material for browser rendering.
- city-lowpoly.glb: low-poly_city_buildings.glb, ground removed and buildings
  separated; textures resized to 512px WebP.
- city-newyork.glb: new_york_buildings.glb, individual building groups prepared
  with roof attachments preserved; textures resized to 512px WebP.
- Colours unified at runtime in UploadedArchitecture.jsx.

Original uploads remain unchanged. Original authorship/license details were not
supplied with these files.

## Latest user-supplied additions

- one-world-trade-center.glb: one_world_trade_center.glb; replaces the tower
  from the New York collection. Runtime navy-to-blue gradients within individual facade planes.
- A subset of the original Jabami trees uses pastel orange/yellow autumn shading.
  The separate yellow-anime-tree asset was removed. Sakura is unchanged.

Original files in Downloads remain unchanged.



Sun: procedural pastel-yellow disc and soft halo; uploaded sun assets removed.

## Animated visitors

- male-idle.glb: idle_1_male_free_animation_200_frames_loop.glb.
- female-idle.glb: female_idle_1_free_animation_150_frames_loop.glb.
- male-walk.glb: male_slow_walk_40_frames_loop.glb.
- female-walk.glb: female_slow_walk_40_frames_loop.glb.

User-supplied characters, with walking/idle clips crossfaded on cloned rigs.
Original uploads remain unchanged; license details were not supplied.
