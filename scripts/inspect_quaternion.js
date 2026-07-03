const { Quaternion, Vector3 } = require('three');

// APT 20 quaternion from GLTF JSON
const q = new Quaternion(
  -0.5077229142189026,
  0.49215593934059143,
  0.4921562075614929,
  0.5077226161956787
);

// Local axes unit vectors
const localX = new Vector3(1, 0, 0);
const localY = new Vector3(0, 1, 0);
const localZ = new Vector3(0, 0, 1);

// Apply quaternion to get the direction of these axes in parent space
const worldX = localX.clone().applyQuaternion(q);
const worldY = localY.clone().applyQuaternion(q);
const worldZ = localZ.clone().applyQuaternion(q);

console.log("=== APT 20 Local Axes in Parent Space ===");
console.log("Local X direction in parent space:", worldX.toArray());
console.log("Local Y direction in parent space:", worldY.toArray());
console.log("Local Z direction in parent space:", worldZ.toArray());
console.log("=========================================");
