"""Synthetic Rain rig tests. Run with Blender --background SOURCE --python THIS -- --target forehead.
Names below come from rig_inventory.json, never from assumed Rigify naming.
No source save; all outputs go to rig_tests/output/. Not gesture reconstruction.
"""
import bpy, sys, json, math, hashlib, argparse
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parent
RIG='RIG-rain'
WRIST='IK-Hand_Parent.L'
POLE='IK-Pole-Forearm.L'
TARGETS={
 'forehead': {'mesh':'GEO-rain-head','landmark':'DEF-Forehead_4_2.L','out':(0,-1,0),'fingers':(0,0,1)},
 'cheek': {'mesh':'GEO-rain-head','landmark':'DEF-Cheek_3_2.L','out':(0.65,-0.76,0),'fingers':(0,0,1)},
 'head_top': {'mesh':'GEO-rain-hair_main','landmark':'DEF-Head','out':(0,0,1),'fingers':(-1,0,0)},
 'foot_grab': {'mesh':'GEO-rain-shoes','landmark':'IK-Foot.L','out':(0,0,1),'fingers':(0,-1,0)},
}

def update():
    bpy.context.view_layer.update()
    return bpy.context.evaluated_depsgraph_get()

def evaluated_rig(): return rig.evaluated_get(update())
def position(name,tail=False):
    p=evaluated_rig().pose.bones[name]
    return rig.matrix_world @ (p.tail if tail else p.head)
def world_matrix(name): return rig.matrix_world @ evaluated_rig().pose.bones[name].matrix

def set_world(name,m):
    # PoseBone.matrix is armature space. Blender resolves parent/rest transform
    # into matrix_basis; never interpret local location channels as world XYZ.
    rig.pose.bones[name].matrix=rig.matrix_world.inverted() @ m
    update()

def move(name,p):
    m=world_matrix(name); m.translation=p; set_world(name,m)

def bvh(name):
    obj=bpy.data.objects[name]; ev=obj.evaluated_get(update()); mesh=ev.to_mesh()
    verts=[ev.matrix_world@v.co for v in mesh.vertices]
    polys=[list(p.vertices) for p in mesh.polygons]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts,polys),verts

def surface_target(kind):
    cfg=TARGETS[kind]; tree,verts=bvh(cfg['mesh']); landmark=position(cfg['landmark'])
    outward=Vector(cfg['out']).normalized()
    if kind=='head_top':
        landmark=Vector((landmark.x,landmark.y,max(v.z for v in verts)-0.03))
    elif kind=='foot_grab':
        left=[v for v in verts if v.x>0]
        lo=min(v.y for v in left); hi=max(v.y for v in left)
        landmark=Vector(((min(v.x for v in left)+max(v.x for v in left))/2,
                         lo+.45*(hi-lo),max(v.z for v in left)))
    hit,normal,_,_=tree.ray_cast(landmark+outward*.5,-outward,1.0)
    if hit is None: raise RuntimeError(f'No evaluated surface hit for {kind}')
    if normal.dot(outward)<0: normal=-normal
    # Use measured surface normal, rather than a hard-coded wrist orientation.
    return hit,normal.normalized(),tree

def orientation(palm_normal, finger_direction):
    x=palm_normal.normalized()
    y=(finger_direction-x*Vector(finger_direction).dot(x)).normalized()
    z=x.cross(y).normalized()
    return Matrix((x,y,z)).transposed()

def hand_matrix(point,outward,finger_direction,offset):
    rot=orientation(-outward,Vector(finger_direction)); m=rot.to_4x4()
    m.translation=point-rot@offset
    return m

def smooth(x): return x*x*(3-2*x)
def mix_matrix(a,b,t):
    m=a.to_quaternion().slerp(b.to_quaternion(),t).to_matrix().to_4x4()
    m.translation=a.translation.lerp(b.translation,t)
    return m

def palm_surface(predicted,normal):
    tree,_=bvh('GEO-rain-body')
    hit,_,_,_=tree.ray_cast(predicted+normal*.025,-normal,.06)
    if hit is None:
        print('PALM DEBUG predicted',list(predicted),'normal',list(normal),'wrist',list(position('DEF-Hand.L')),'nearest',tree.find_nearest(predicted),flush=True)
        raise RuntimeError('Cannot locate evaluated palm surface')
    return hit

def hand_clearance(tree):
    obj=bpy.data.objects['GEO-rain-body']; ev=obj.evaluated_get(update()); mesh=ev.to_mesh()
    names={g.index:g.name for g in obj.vertex_groups}
    distances=[]
    for v in mesh.vertices:
        if any(g.weight>.25 and names.get(g.group,'').endswith('.L') and
               any(n in names[g.group] for n in ['Hand','Index','Middle','Ring','Pinky','Thumb']) for g in v.groups):
            point=ev.matrix_world@v.co; nearest,normal,_,_=tree.find_nearest(point)
            distances.append((point-nearest).dot(normal))
    ev.to_mesh_clear()
    return min(distances)


def key(name,frame):
    p=rig.pose.bones[name]
    p.keyframe_insert('location',frame=frame,group=name)
    p.keyframe_insert('rotation_euler',frame=frame,group=name)
    p.keyframe_insert('scale',frame=frame,group=name)


def prepare_scene(out,kind):
    scene=bpy.context.scene
    # Keep procedural shading scripts disabled; use a texture-free Workbench view.
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.color_type='OBJECT'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.background_type='WORLD'
    scene.world.color=(.12,.12,.12)
    scene.display.shading.show_specular_highlight=True
    for o in bpy.data.objects:
        if not o.name.startswith('GEO-'): continue
        o.color=(.65,.43,.29,1)
        if any(x in o.name for x in ['hair','eyebrow','eyelash']): o.color=(.065,.04,.03,1)
        elif 'top' in o.name: o.color=(.15,.34,.45,1)
        elif 'jeans' in o.name: o.color=(.12,.18,.26,1)
        elif 'scarf' in o.name: o.color=(.42,.13,.1,1)
        elif 'eye' in o.name: o.color=(.72,.73,.7,1)
        elif 'shoe' in o.name: o.color=(.09,.09,.09,1)
    # Render simpler solid eyes rather than a solid opaque cornea shell.
    bpy.data.objects['GEO-rain-eye_cornea'].hide_render=True
    camera=bpy.data.objects.new('TEST-Camera',bpy.data.cameras.new('TEST-Camera'))
    scene.collection.objects.link(camera)
    camera.location=(2.35,-4.4,2.0)
    aim=Vector((0,-.03,1.12 if kind!='foot_grab' else .82))
    camera.rotation_euler=(aim-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=1.85 if kind!='foot_grab' else 2.0
    scene.camera=camera
    scene.render.resolution_x=640; scene.render.resolution_y=640; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.fps=24
    scene.frame_start=1; scene.frame_end=96
    scene.render.filepath=str(out/'frames'/'frame_')
    (out/'frames').mkdir(exist_ok=True)
    # Store a target marker in the file but hide it from the preview.
    marker=bpy.data.objects.new('TEST-ContactTarget',None); scene.collection.objects.link(marker)
    marker.empty_display_type='SPHERE'; marker.empty_display_size=.008
    marker.location=contact; marker.hide_render=True
    scene['synthetic_rig_test']='Not a reconstruction or validation of recorded gestures.'


def run(args):
    global rig,contact
    source=Path(bpy.data.filepath).resolve(); source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    rig=bpy.data.objects[RIG]; props=rig.pose.bones['Properties_IKFK']
    # Preserve drivers; remove only action/NLA animation on this output copy.
    if rig.animation_data:
        rig.animation_data.action=None
        for track in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(track)
    for p in rig.pose.bones: p.matrix_basis=Matrix.Identity(4)
    for k in ['ik_arm_left','ik_arm_right','ik_spine','ik_leg_left','ik_leg_right']: props[k]=1.0
    props['ik_fingers_left']=0.0; props['ik_fingers_right']=0.0
    props['ik_stretch_arms']=0.0; props['ik_pole_follow_hands']=0.0
    props['ik_parents_arm_left']=0; props['ik_parents_arm_right']=0
    rig.update_tag(); update()
    # Rest-pose geometry calibration: palm surface and fingertip offsets.
    rest=world_matrix(WRIST); wrist=rest.translation
    mid=position('FK-Middle1.L')
    palm_n=rest.to_3x3().col[0].normalized()
    approx=wrist.lerp(mid,.55)
    tree,_=bvh('GEO-rain-body')
    palm,_,_,_=tree.ray_cast(approx+palm_n*.05,-palm_n,.1)
    if palm is None: raise RuntimeError('Rest-pose palm calibration failed')
    offset=rest.inverted()@palm
    tips={f:rest.inverted()@position('DEF-'+f+'4.L',True) for f in ['Index','Middle','Ring','Pinky']}
    # Neutral is a reproducible relaxed arms-down pose, not the source T-pose.
    neutral=orientation(Vector((-1,0,0)),Vector((0,0,-1))).to_4x4()
    neutral.translation=Vector((.19,-.065,.93))
    right=orientation(Vector((1,0,0)),Vector((0,0,-1))).to_4x4()
    # Right rest axes are mirrored; a basis flip retains a proper rotation.
    right.translation=Vector((-.19,-.065,.93))
    set_world('IK-Hand_Parent.R',right)
    move('IK-Pole-Forearm.R',Vector((-.4,-.3,1.0)))
    set_world(WRIST,neutral); move(POLE,Vector((.4,-.3,1.0)))
    torso_names=['MSTR-Pelvis_Parent','MSTR-Chest_Parent','MSTR-Clavicle.L','IK-Pole-Shin.L','IK-Pole-Shin.R','MSTR-Foot_Parent.L']
    neutral_body={n:world_matrix(n) for n in torso_names}
    if args.target=='foot_grab':
        # Crouch through pelvis/chest IK, keep feet planted, move knee poles.
        m=neutral_body['MSTR-Pelvis_Parent'].copy(); m.translation+=Vector((0,.04,-.48)); set_world('MSTR-Pelvis_Parent',m)
        m=world_matrix('MSTR-Chest_Parent'); m.translation+=Vector((0,-.22,-.16))
        m=Matrix.Translation(m.translation)@Matrix.Rotation(math.radians(50),4,'X')@m.to_3x3().to_4x4()
        set_world('MSTR-Chest_Parent',m)
        for side in ['L','R']:
            move('IK-Pole-Shin.'+side,Vector((.14 if side=='L' else -.14,-.6,.28)))
    if args.target=='head_top':
        clavicle=world_matrix('MSTR-Clavicle.L'); clavicle.translation.z+=.055
        set_world('MSTR-Clavicle.L',clavicle)
    goal_body={n:world_matrix(n) for n in torso_names}
    contact,normal,head_tree=surface_target(args.target)
    desired=contact+normal*.002
    goal=hand_matrix(desired,normal,TARGETS[args.target]['fingers'],offset)
    if args.target=='foot_grab':
        # Derive a reachable crouch from the actual shoulder and arm lengths.
        arm_length=(position('IK-Upperarm.L',True)-position('IK-Upperarm.L')).length + (position('IK-Forearm.L',True)-position('IK-Forearm.L')).length
        for _ in range(12):
            shoulder=position('Root_Upperarm.L')
            if (goal.translation-shoulder).length < arm_length*.95: break
            pelvis=world_matrix('MSTR-Pelvis_Parent'); pelvis.translation.z-=.025
            set_world('MSTR-Pelvis_Parent',pelvis)
        goal_body={n:world_matrix(n) for n in torso_names}
        print('FOOT REACH',list(position('Root_Upperarm.L')),list(goal.translation),arm_length,flush=True)
    hold_pole=Vector((.4,-.30,1.22)) if args.target!='foot_grab' else Vector((.38,-.48,.48))
    move(POLE,hold_pole); set_world(WRIST,goal)
    if args.target=='foot_grab':
        for finger in ['Index','Middle','Ring','Pinky']:
            for joint in [1,2,3]:
                rig.pose.bones[f'FK-{finger}{joint}.L'].rotation_euler.x=math.radians(15 if joint==1 else 25)
        update()
    # Refine against the deformed palm surface, not just the wrist bone position.
    for _ in range(5):
        actual=palm_surface(world_matrix(WRIST)@offset,world_matrix(WRIST).to_3x3().col[0].normalized())
        delta=desired-actual
        if delta.length<.0001: break
        goal.translation+=delta; set_world(WRIST,goal)
    actual=palm_surface(world_matrix(WRIST)@offset,world_matrix(WRIST).to_3x3().col[0].normalized())
    print('CONTACT',args.target,'surface',list(contact),'palm',list(actual),'error', (actual-desired).length,flush=True)
    if args.target in TARGETS:
        original_rotation=goal.to_3x3().copy()
        candidates=[]
        # Small rotations about palm tangents keep the contact point fixed while
        # finding a hand plane that clears the curved face (no mesh warping).
        for axis in [original_rotation.col[1],original_rotation.col[2]]:
            for degrees in [0,-8,8,-16,16,-24,24]:
                rot=Matrix.Rotation(math.radians(degrees),3,axis)@original_rotation
                candidate=rot.to_4x4(); candidate.translation=desired-rot@offset
                set_world(WRIST,candidate)
                for _ in range(2):
                    pt=palm_surface(world_matrix(WRIST)@offset,world_matrix(WRIST).to_3x3().col[0].normalized())
                    candidate.translation+=desired-pt; set_world(WRIST,candidate)
                clearance=hand_clearance(head_tree)
                candidates.append((clearance,abs(degrees),candidate.copy()))
        viable=[c for c in candidates if c[0]>.0003]
        chosen=min(viable,key=lambda c:c[1]) if viable else max(candidates,key=lambda c:c[0])
        goal=chosen[2]; set_world(WRIST,goal)
        # A cupped palm is not planar. Preserve contact at the nearest actual
        # skin point instead of forcing the palm centre through the forehead.
        for _ in range(12):
            clearance=hand_clearance(head_tree)
            if clearance>=.0008: break
            shift=normal*(.001-clearance)
            goal.translation+=shift; desired+=shift; set_world(WRIST,goal)
        print('HAND MESH clearance',hand_clearance(head_tree),'tilt degrees',chosen[1],flush=True)
    # Mid-path bends away from the face before reaching contact.
    waypoint=mix_matrix(neutral,goal,.58)
    waypoint.translation=Vector((.31,-.32,1.24)) if args.target!='foot_grab' else Vector((.3,-.37,.62))
    out=ROOT/'output'/args.target; out.mkdir(parents=True,exist_ok=True)
    report={'source':str(source),'source_sha256':source_hash,'target':args.target,'armature':RIG,
            'wrist':WRIST,'pole':POLE,'surface_target':list(contact),'surface_normal':list(normal),
            'palm_standoff_m':(desired-contact).length,'palm_offset_wrist_local':list(offset),'fingertip_offsets_wrist_local':{k:list(v) for k,v in tips.items()},
            'hold_frames':[37,60],'samples':[],'limitations':['Synthetic rig test only; not a reconstruction of recorded gestures.',
            'Contact distances use evaluated mesh surfaces; no physics or soft-tissue deformation.',
            'Texture-free Workbench preview; embedded UI/shading scripts remain disabled.']}
    for frame in range(1,97):
        if frame<=12: t=0
        elif frame<=36: t=smooth((frame-12)/24)
        elif frame<=60: t=1
        elif frame<=84: t=1-smooth((frame-60)/24)
        else: t=0
        bpy.context.scene.frame_set(frame)
        for n in torso_names:
            set_world(n,mix_matrix(neutral_body[n],goal_body[n],t)); key(n,frame)
        if t<.55: m=mix_matrix(neutral,waypoint,t/.55)
        else: m=mix_matrix(waypoint,goal,(t-.55)/.45)
        set_world(WRIST,m); move(POLE,Vector((.4,-.3,1.0)).lerp(hold_pole,t))
        key(WRIST,frame); key(POLE,frame)
        key('IK-Hand_Parent.R',frame); key('IK-Pole-Forearm.R',frame)
        if args.target=='foot_grab':
            for finger in ['Index','Middle','Ring','Pinky']:
                for joint in [1,2,3]:
                    n=f'FK-{finger}{joint}.L'; p=rig.pose.bones[n]
                    p.rotation_euler.x=math.radians(15 if joint==1 else 25)*t
                    key(n,frame)
        if frame in range(37,61):
            update(); wm=world_matrix(WRIST)
            pt=palm_surface(wm@offset,wm.to_3x3().col[0].normalized())
            nearest,n,_,dist=head_tree.find_nearest(pt)
            tip_samples={f:list(position('DEF-'+f+'4.L',True)) for f in tips}
            report['samples'].append({'frame':frame,'palm_world':list(pt),'target_error_m':(pt-desired).length,
                'surface_distance_m':dist,'signed_surface_distance_m':(pt-nearest).dot(n),
                'wrist_world':list(position('DEF-Hand.L')),'fingertips_world':tip_samples,
                'fingertip_surface_distances_m':{f:head_tree.find_nearest(Vector(p))[3] for f,p in tip_samples.items()}})
        if frame%24==0: print('Baked frame',frame,flush=True)
    prepare_scene(out,args.target)
    report['invalid_drivers']=[f.data_path for f in rig.animation_data.drivers if not f.driver.is_valid]
    report['max_hold_error_m']=max(s['target_error_m'] for s in report['samples'])
    report['min_hold_clearance_m']=min(s['signed_surface_distance_m'] for s in report['samples'])
    bpy.context.scene.frame_set(48); update()
    report['hand_mesh_min_signed_distance_m']=hand_clearance(head_tree)
    report['status']='contact_pass' if report['max_hold_error_m']<.005 and report['min_hold_clearance_m']>-.002 and report['hand_mesh_min_signed_distance_m']>-.002 else 'needs_review'
    (out/'contact_report.json').write_text(json.dumps(report,indent=2))
    bpy.context.scene.frame_set(48)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/f'rain_{args.target}_test.blend'))
    if hashlib.sha256(source.read_bytes()).hexdigest()!=source_hash: raise RuntimeError('Source changed!')
    print('SAVED',out,'STATUS',report['status'],flush=True)
    if args.render:
        bpy.context.scene.render.filepath=str(out/'hold.png'); bpy.ops.render.render(write_still=True)
        bpy.context.scene.frame_set(1); bpy.context.scene.render.filepath=str(out/'neutral.png'); bpy.ops.render.render(write_still=True)
        if args.render=='animation':
            bpy.context.scene.render.filepath=str(out/'frames'/'frame_'); bpy.ops.render.render(animation=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--target',choices=TARGETS,default='forehead')
    parser.add_argument('--render',choices=['stills','animation'])
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    run(args)
