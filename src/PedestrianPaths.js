const TAU = Math.PI * 2;
export const pedestrianHash = x => {
  const n = Math.sin(x * 127.1 + 14.4) * 43758.5453;
  return n - Math.floor(n);
};
const mix = (a,b,t) => a + (b-a)*t;

export function pedestrianBlocked(x,z,obstacles=[]) {
  return obstacles.some(o => o.box
    ? x > o.x-o.hx && x < o.x+o.hx && z > o.z-o.hz && z < o.z+o.hz
    : Math.hypot(x-o.x,z-o.z) < o.radius);
}

function clearPath(point,obstacles) {
  let [x,z]=point;
  for(let pass=0;pass<24;pass++) for(const o of obstacles) {
    if(o.box){
      if(x>o.x-o.hx && x<o.x+o.hx && z>o.z-o.hz && z<o.z+o.hz) x=o.x-o.hx-.005;
    } else {
      const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz);
      if(d<o.radius){const angle=d>.001 ? Math.atan2(dz,dx) : 0;x=o.x+Math.cos(angle)*(o.radius+.005);z=o.z+Math.sin(angle)*(o.radius+.005);}
    }
  }
  return [x,z];
}

function baseRoute(zone, index, progress) {
  const seed = pedestrianHash(index * 17 + 4);
  const sway = Math.sin(progress * TAU * 2 + seed * TAU) * .12;
  if (zone === "north") {
    const f = (progress % 1) * 4, edge = Math.floor(f), t = f % 1;
    const r = 6.95 + seed * .65 + sway;
    const points = [[-r,-r],[r,-r],[r,r],[-r,r]];
    const a = points[edge], b = points[(edge+1)%4];
    return [-6.42 + mix(a[0],b[0],t), -9.93 + mix(a[1],b[1],t)];
  }
  if (zone === "tree") {
    if (index % 3 === 0) return [-.1 + (seed-.5)*.3 + sway, mix(1,14.5,progress)];
    const radius = 2.95 + seed * .35 + sway;
    return [-3 + Math.cos(progress*TAU)*radius, 9.92 + Math.sin(progress*TAU)*radius];
  }
  return index % 2 === 0
    ? [mix(0,21.8,progress), 1 + (seed-.5)*1.65 + sway]
    : [21.5 + seed * 1.4 + sway, mix(-14,18,progress)];
}

// Scatter idle visitors outside the walking corridors, leaving room for shoulders.
export function pedestrianRoute(zone,index,progress,obstacles=[]) {
  return clearPath(baseRoute(zone,index,progress),obstacles);
}

export function stoppedPositions(zone, count, walkers, obstacles=[]) {
  const corridors = Array.from({length:walkers},(_,i) =>
    Array.from({length:161},(_,j) => pedestrianRoute(zone,i,j/160,obstacles))).flat();
  const points = [];
  for (let i=0;i<count;i++) {
    let chosen;
    for (let attempt=0;attempt<2000;attempt++) {
      const seed = i*2003+attempt*7+41;
      const u = pedestrianHash(seed), v = pedestrianHash(seed+1);
      let x,z;
      if (zone === "north") {
        const angle=u*TAU, r=5.95+v*.35;
        // Square rings follow the plaza rather than cutting into the pool.
        const scale=r/Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle)));
        x=-6.42+Math.cos(angle)*scale; z=-9.93+Math.sin(angle)*scale;
      } else if (zone === "tree") {
        const angle=u*TAU, r=1.05+v*1.2;
        x=-3+Math.cos(angle)*r; z=9.92+Math.sin(angle)*r;
      } else { x=mix(19.9,20.6,u); z=mix(-14,18,v); }
      if (pedestrianBlocked(x,z,obstacles)) continue;
      if (points.some(p=>Math.hypot(x-p[0],z-p[1])<.5)) continue;
      if (corridors.some(p=>Math.hypot(x-p[0],z-p[1])<.55)) continue;
      chosen=[x,z]; break;
    }
    if (!chosen) throw new Error(`No clear pedestrian space in ${zone}`);
    points.push(chosen);
  }
  return points;
}
