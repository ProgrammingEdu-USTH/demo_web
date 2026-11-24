import bpy, os, math
os.makedirs("D:/EDU/PE-3d/blender", exist_ok=True)
# backup copy of the user's scene as-is (does not change the open file's path)
bpy.ops.wm.save_as_mainfile(filepath="D:/EDU/PE-3d/blender/pe_room_backup_original.blend", copy=True)
print("backup saved")
sc = bpy.context.scene
print("engine", sc.render.engine, "res", sc.render.resolution_x, sc.render.resolution_y)
cam = bpy.data.objects["Camera"]
print("cam loc", tuple(round(v, 3) for v in cam.location), "rot", tuple(round(math.degrees(v), 2) for v in cam.rotation_euler),
      "lens", cam.data.lens, "sensor", cam.data.sensor_width, cam.data.sensor_fit)
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        l = o.data
        print("LIGHT", o.name, l.type, "E=", l.energy, "col", tuple(round(c, 2) for c in l.color),
              "size", getattr(l, "size", None), getattr(l, "shadow_soft_size", None),
              "rot", tuple(round(math.degrees(v), 1) for v in o.rotation_euler))
w = sc.world
print("world", w.name if w else None)
if w and w.use_nodes:
    for n in w.node_tree.nodes:
        print("  wnode", n.type, [(i.name, list(i.default_value) if hasattr(i.default_value, '__len__') else i.default_value) for i in n.inputs if hasattr(i, 'default_value')])
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    em = next((n for n in m.node_tree.nodes if n.type == 'EMISSION'), None)
    if b:
        bc = b.inputs['Base Color']
        es = b.inputs.get('Emission Strength')
        ec = b.inputs.get('Emission Color')
        print("MAT %-24s col=%s linked=%s emis=%s ecol=%s users=%d" % (m.name, tuple(round(c, 2) for c in bc.default_value[:3]), bc.is_linked,
              round(es.default_value, 2) if es else None, tuple(round(c, 2) for c in ec.default_value[:3]) if ec else None, m.users))
    elif em:
        print("MAT %-24s EMISSION col=%s str=%s" % (m.name, tuple(round(c, 2) for c in em.inputs[0].default_value[:3]), em.inputs[1].default_value))
    else:
        print("MAT", m.name, [n.type for n in m.node_tree.nodes])
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    cp = prefs.preferences
    try:
        cp.get_devices()
    except Exception as e:
        print("dev err", e)
    print("cycles device type", cp.compute_device_type, [(d.name, d.type, d.use) for d in cp.devices])
