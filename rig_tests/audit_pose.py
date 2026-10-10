import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(bpy.data.filepath).parent
scene=bpy.context.scene; scene.frame_set(48); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
def mesh(name):
 o=bpy.data.objects[name].evaluated_get(deps); m=o.to_mesh(); return o,m
btrees={}
for name in ['GEO-rain-head','GEO-rain-hair_main']:
 o,m=mesh(name); btrees[name]=BVHTree.FromPolygons([o.matrix_world@v.co for v in m.vertices],[list(p.vertices) for p in m.polygons]); o.to_mesh_clear()
body=bpy.data.objects['GEO-rain-body']; o,m=mesh(body.name)
groups={g.index:g.name for g in body.vertex_groups}
points=[]
for v in m.vertices:
 if any(g.weight>.25 and groups.get(g.group,'').endswith('.L') and any(x in groups[g.group] for x in ['Hand','Index','Middle','Ring','Pinky','Thumb']) for g in v.groups): points.append(o.matrix_world@v.co)
audit={'hand_vertex_count':len(points),'surfaces':{}}
for name,tree in btrees.items():
 signed=[]
 for p in points:
  nearest,n,_,d=tree.find_nearest(p); signed.append((p-nearest).dot(n))
 audit['surfaces'][name]={'min_signed_distance_m':min(signed),'vertices_deeper_than_2mm':sum(d<-.002 for d in signed)}
o.to_mesh_clear()
rig=bpy.data.objects['RIG-rain']; audit['invalid_drivers']=[f.data_path for f in rig.animation_data.drivers if not f.driver.is_valid]
audit['armature_constraint_spaces']={}
for name in ['IK-P-Hand_Parent.L','IK-P-Pole-Forearm.L']:
 p=rig.pose.bones[name]; audit['armature_constraint_spaces'][name]=[{'name':c.name,'targets':[{'bone':t.subtarget,'weight':t.weight} for t in c.targets]} for c in p.constraints if c.type=='ARMATURE']
(root/'mesh_audit.json').write_text(json.dumps(audit,indent=2)); print(json.dumps(audit))
