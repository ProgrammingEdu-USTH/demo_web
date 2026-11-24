"""Export: room.glb (1 merged static mesh + separate nodes for things that move) and plant.glb."""
import bpy
from mathutils import Vector

D = bpy.data
sc = bpy.context.scene
OUT = "D:/EDU/PE-3d/web/public/assets/"
SKIP = {"Foreground_Plant_Left", "Window_LED_Lights", "Laptop_Screen", "Window_Glass_L", "Window_Glass_R"}
DYNAMIC_PREFIX = ("Interactive_", "Window_Sash_", "Coffee_Mug", "Desk_Plant")


def view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return dict(window=win, area=area, region=region)


OV = view3d_override()
unused = D.collections["PE_Unused"]
targets = [o for o in sc.objects if o.type == 'MESH' and o.name not in SKIP and unused not in o.users_collection
           and o.name != "Room_Static"]
for o in targets:
    for uv in [u for u in o.data.uv_layers if u.name != "Atlas"]:
        o.data.uv_layers.remove(uv)

# laptop screen: planar 0..1 UVs for the live canvas texture
scr = D.objects["Laptop_Screen"]
me = scr.data
ws = [scr.matrix_world @ v.co for v in me.vertices]
mnx, mxx = min(v.x for v in ws), max(v.x for v in ws)
mnz, mxz = min(v.z for v in ws), max(v.z for v in ws)
for uv in list(me.uv_layers):
    me.uv_layers.remove(uv)
uvl = me.uv_layers.new(name="Atlas")
for l in me.loops:
    w = ws[l.vertex_index]
    uvl.data[l.index].uv = ((w.x - mnx) / (mxx - mnx), (w.z - mnz) / (mxz - mnz))

dyn = [o for o in targets if o.name.startswith(DYNAMIC_PREFIX)]
stat = [o for o in targets if o not in dyn]
print("dynamic:", [o.name for o in dyn])
print("static merged:", len(stat))

with bpy.context.temp_override(**OV):
    bpy.ops.object.select_all(action='DESELECT')
    dups = []
    for o in stat:
        d = o.copy()
        d.data = o.data.copy()
        sc.collection.objects.link(d)
        dups.append(d)
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.name = "Room_Static"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.ops.object.select_all(action='DESELECT')
    exp = [merged, scr, D.objects["Window_Glass_L"], D.objects["Window_Glass_R"]] + dyn
    for o in exp:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT + "room.glb", export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False, export_animations=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in exp)
    print("room.glb tris:", tris, "nodes:", len(exp))
    D.objects.remove(merged, do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    fp = D.objects["Foreground_Plant_Left"]
    fp.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT + "plant.glb", export_format='GLB', use_selection=True,
                              export_image_format='WEBP', export_image_quality=80, export_apply=True,
                              export_yup=True, export_animations=False)
    bpy.ops.object.select_all(action='DESELECT')

for im in D.images:
    if im.name in ("bake_day", "bake_lamp"):
        im.pack()
bpy.ops.wm.save_as_mainfile(filepath="D:/EDU/PE-3d/blender/pe_room.blend")
print("saved blend")
