"""Estimate 3D face geometry and photographic UV coordinates from a local reference.
Usage: python tools/reconstruct-marshal.py REFERENCE_IMAGE
Requires mediapipe 0.10.21, numpy, scipy, Pillow. Single-image depth is approximate.
"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import Delaunay
import mediapipe as mp
image=np.asarray(Image.open(sys.argv[1]).convert('RGB'));h,w=image.shape[:2]
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=.3) as detector:
 result=detector.process(image)
 if not result.multi_face_landmarks:raise RuntimeError('Face not detected')
 points=np.array([[p.x*w,-p.y*h,-p.z*w] for p in result.multi_face_landmarks[0].landmark[:468]])
 right=points[263]-points[33];right/=np.linalg.norm(right)
 up=points[10]-points[152];up/=np.linalg.norm(up)
 front=np.cross(right,up);front/=np.linalg.norm(front);up=np.cross(front,right)
 local=points@np.stack((right,up,front),axis=1)
 center=(local[234]+local[454])/2
 center[1]=(local[10,1]+local[152,1])/2
 scale=.325/(local[10,1]-local[152,1]);local=(local-center)*scale
 local[:,2]*=.85;local[:,2]+=.035
 eyes=[[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]]
 mouth=[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]
 lips=[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185]
 def inside(pt,ids):
  poly=local[ids,:2];x,y=pt;hit=False
  for a,b in zip(poly,np.roll(poly,-1,axis=0)):
   if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
  return hit
 triangles=[];groups=[]
 for tri in Delaunay(local[:,:2]).simplices:
  a,b,c=map(int,tri);center=local[tri,:2].mean(axis=0)
  # Keep eyes and mouth triangles so the photo covers the entire sculpted face.
  if np.cross(local[b]-local[a],local[c]-local[a])[2]<0:b,c=c,b
  triangles.extend([a,b,c]);groups.append(1 if inside(center,lips) else 0)
 data={'positions':np.round(local,6).ravel().tolist(),'indices':triangles,'groups':groups,'eyes':eyes,'mouth':mouth,'brows':[[70,63,105,66,107],[336,296,334,293,300]],'vertexCount':468,'photoTexture':True,'uv':np.round(np.array([[p.x,1-p.y] for p in result.multi_face_landmarks[0].landmark[:468]]),6).ravel().tolist()}
 dest=Path(__file__).resolve().parents[1]/'dist/marshal-face.js'
 dest.write_text('// Reference-fitted 3D geometry. Photo UV coordinates on reference-fitted 3D geometry.\nexport const marshalFace='+json.dumps(data,separators=(',',':'))+';\n')
 print('Vertices:',len(local),'triangles:',len(triangles)//3,'bounds:',local.min(axis=0),local.max(axis=0))
 print('eye centers:',[local[ids].mean(axis=0).tolist() for ids in eyes])
