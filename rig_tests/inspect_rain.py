import bpy, json, pathlib, hashlib
from mathutils import Vector
out=pathlib.Path(bpy.data.filepath).parent/'rig_tests'
out.mkdir(exist_ok=True)
def val(v):
    if isinstance(v,(str,int,float,bool)) or v is None: return v
    try: return list(v)
    except: return str(v)
def props(x): return {k:val(x[k]) for k in x.keys() if k!='_RNA_UI'}
def constraint(c):
    d={'name':c.name,'type':c.type,'influence':c.influence,'mute':c.mute}
    for p in c.bl_rna.properties:
        if p.identifier in {'rna_type','name','type','influence','mute'}: continue
        try:
            v=getattr(c,p.identifier)
            if isinstance(v,bpy.types.ID): v=v.name
            elif p.type=='POINTER': continue
            elif p.type=='COLLECTION': continue
            d[p.identifier]=val(v)
        except: pass
    return d
report={'source':bpy.data.filepath,'blender':bpy.app.version_string,'sha256':hashlib.sha256(pathlib.Path(bpy.data.filepath).read_bytes()).hexdigest(),'objects':[],'armatures':[],'texts':[t.name for t in bpy.data.texts]}
for o in bpy.data.objects:
    report['objects'].append({'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'location':list(o.location),'dimensions':list(o.dimensions),'hide_render':o.hide_render,'modifiers':[{'name':m.name,'type':m.type,'object':getattr(getattr(m,'object',None),'name',None)} for m in o.modifiers]})
    if o.type!='ARMATURE': continue
    a={'name':o.name,'matrix_world':[list(r) for r in o.matrix_world],'properties':props(o),'bones':[],'drivers':[]}
    for p in o.pose.bones:
        b=p.bone
        a['bones'].append({'name':p.name,'parent':p.parent.name if p.parent else None,'deform':b.use_deform,'collections':[c.name for c in b.collections],'shape':p.custom_shape.name if p.custom_shape else None,'head':list(p.head),'tail':list(p.tail),'matrix':[list(r) for r in p.matrix],'rest_matrix':[list(r) for r in b.matrix_local],'rotation_mode':p.rotation_mode,'location':list(p.location),'rotation':list(p.rotation_euler),'scale':list(p.scale),'lock_location':list(p.lock_location),'lock_rotation':list(p.lock_rotation),'properties':props(p),'constraints':[constraint(c) for c in p.constraints]})
    if o.animation_data:
        for f in o.animation_data.drivers:
            a['drivers'].append({'path':f.data_path,'index':f.array_index,'expression':f.driver.expression,'valid':f.driver.is_valid,'variables':[{'name':v.name,'type':v.type,'targets':[{'id':t.id.name if t.id else None,'data_path':t.data_path,'bone':t.bone_target,'transform_space':t.transform_space} for t in v.targets]} for v in f.driver.variables]})
    report['armatures'].append(a)
(out/'rig_inventory.json').write_text(json.dumps(report,indent=2))
print('ARMATURES',[(a['name'],len(a['bones'])) for a in report['armatures']])
print('Full read-only inventory written to',out/'rig_inventory.json')
