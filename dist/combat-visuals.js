import * as T from './vendor/three.module.js';

// Fixed pools keep GPU allocations bounded on tablets, including long online races.
export class CombatVisuals {
  constructor(scene){
    const body=new T.CylinderGeometry(.16,.16,1.2,8),nose=new T.ConeGeometry(.17,.45,8),tail=new T.ConeGeometry(.22,.9,8);
    const metal=new T.MeshStandardMaterial({color:0xd5e1e7,metalness:.65,roughness:.35}),red=new T.MeshStandardMaterial({color:0xd4472d}),fire=new T.MeshBasicMaterial({color:0xffbf40});
    this.missiles=Array.from({length:18},()=>{
      const root=new T.Group(),rocket=new T.Group();rocket.rotation.x=Math.PI/2;
      rocket.add(new T.Mesh(body,metal));const tip=new T.Mesh(nose,red);tip.position.y=.825;rocket.add(tip);
      const flame=new T.Mesh(tail,fire);flame.position.y=-1;flame.rotation.z=Math.PI;rocket.add(flame);root.add(rocket);scene.add(root);root.visible=false;return root;
    });
    const geometry=new T.IcosahedronGeometry(1,1);
    this.explosions=Array.from({length:12},()=>{const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xff8a32,transparent:true,depthWrite:false}));mesh.visible=false;scene.add(mesh);return mesh;});
  }
  update(race){
    this.missiles.forEach((mesh,i)=>{const m=race.missiles[i];mesh.visible=!!m;if(m){mesh.position.set(m.x,m.y,m.z);mesh.rotation.y=m.heading;}});
    this.explosions.forEach((mesh,i)=>{const e=race.explosions[i];mesh.visible=!!e;if(e){const age=Math.max(0,race.time-e.at);mesh.position.set(e.x,e.y,e.z);mesh.scale.setScalar(.7+age*6);mesh.material.opacity=Math.max(0,1-age);mesh.rotation.set(age*2,age*3,age);}});
  }
}
