"""Create photo-textured 3D face geometry locally; source photographs stay unchanged.
Requires mediapipe==0.10.21, scipy, Pillow, and numpy. No network inference.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.spatial import Delaunay
import mediapipe as mp

ROOT = Path(__file__).resolve().parents[1]
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.35) as detector:
    for index in (3,):
        path = ROOT / 'dist' / 'drivers' / f'driver-{index:02d}.png'
        rgb = np.asarray(Image.open(path).convert('RGB'))
        height, width = rgb.shape[:2]
        result = detector.process(rgb)
        if not result.multi_face_landmarks:
            raise RuntimeError(f'No face landmarks found in {path.name}')
        landmarks = result.multi_face_landmarks[0].landmark[:468]
        pixels = np.array([[p.x * width, p.y * height] for p in landmarks])
        points = np.array([[p.x * width, -p.y * height, -p.z * width] for p in landmarks])
        right = points[263] - points[33]
        right /= np.linalg.norm(right)
        up = points[10] - points[152]
        up /= np.linalg.norm(up)
        front = np.cross(right, up)
        front /= np.linalg.norm(front)
        up = np.cross(front, right)
        local = points @ np.stack((right, up, front), axis=1)
        scale = .34 / (local[10, 1] - local[152, 1])
        center = np.array([(local[234,0] + local[454,0]) / 2, (local[10,1] + local[152,1]) / 2, (local[234,2] + local[454,2]) / 2])
        local = (local - center) * scale
        # Weak-perspective landmark depth needs a conservative scale for the game head.
        local[:,2] = local[:,2] * .60 + .014
        uv = pixels / np.array([width, height])
        uv[:,1] = 1 - uv[:,1]
        triangles = []
        for face in Delaunay(pixels).simplices:
            a,b,c = map(int,face)
            normal = np.cross(local[b]-local[a],local[c]-local[a])
            if normal[2] < 0: b,c = c,b
            triangles.extend((a,b,c))
        samples=[]
        for point in (50,101,280,330):
            x,y=np.rint(pixels[point]).astype(int)
            samples.extend(rgb[max(0,y-2):y+3,max(0,x-2):x+3].reshape(-1,3))
        skin=np.median(samples,axis=0).astype(int)
        output={'positions':np.round(local,6).ravel().tolist(),'uv':np.round(uv,6).ravel().tolist(),'indices':triangles,'skin':int(skin[0])*65536+int(skin[1])*256+int(skin[2]),'halfWidth':round(float(np.max(np.abs(local[:,0]))),6),'sourceSize':[width,height],'vertexCount':len(local)}
        destination=path.with_suffix('.json')
        destination.write_text(json.dumps(output,separators=(',',':'))+'\n')
        print(path.name,':',len(local),'vertices,',len(triangles)//3,'triangles; depth',round(float(np.ptp(local[:,2])),3),'m')
