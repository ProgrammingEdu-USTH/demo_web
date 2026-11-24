"""Export room.glb: one merged static mesh + one node per thing that moves. Also writes scene-data.json."""
import bpy, json
from mathutils import Vector

D = bpy.data
sc = bpy.context.scene
OUT = "D:/EDU/PE-3d/web/public/assets/"
SKIP = {"Window_LED_Lights", "Laptop_Screen", "Window_Glass_L", "Window_Glass_R"}
DYNAMIC_PREFIX = ("Interactive_", "Window_Sash_", "Coffee_Mug")


def view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                return dict(window=win, area=area, region=next(r for r in area.regions if r.type == 'WINDOW'))


OV = view3d_override()
unused = D.collections["PE_Unused"]
targets = [o for o in sc.objects if o.type == 'MESH' and o.name not in SKIP and unused not in o.users_collection
           and o.visible_get() and not o.hide_render and not o.name.startswith("_") and o.name != "Room_Static"]
dyn = [o for o in targets if o.name.startswith(DYNAMIC_PREFIX)]
stat = [o for o in targets if o not in dyn]

with bpy.context.temp_override(**OV):
    bpy.ops.object.select_all(action='DESELECT')
    dups = []
    for o in stat:
        d = o.copy()
        d.data = o.data.copy()
        sc.collection.objects.link(d)
        d.select_set(True)
        dups.append(d)
    bpy.context.view_layer.objects.active = dups[0]
    for d in dups:   # bake modifiers (weighted normals) so the join keeps geometry identical
        with bpy.context.temp_override(**OV, object=d, active_object=d):
            for m in list(d.modifiers):
                bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.name = "Room_Static"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action='DESELECT')
    exp = [merged, D.objects["Laptop_Screen"], D.objects["Window_Glass_L"], D.objects["Window_Glass_R"]] + dyn
    for o in exp:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT + "room.glb", export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_apply=True, export_yup=True,
                              export_cameras=False, export_lights=False, export_animations=False)
    print("room.glb tris:", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in exp), "nodes:", len(exp))
    D.objects.remove(merged, do_unlink=True)

# ---- data the web needs: fairy-light bulbs (kept), LED strip, mug, lamp light
data = json.load(open(OUT + "scene-data.json"))
lt = D.objects["Light_Desk_Lamp"]
M = lt.matrix_world
half = lt.data.size / 2
data["led"] = {"a": list(M @ Vector((-half, 0, 0))), "b": list(M @ Vector((half, 0, 0))), "down": list((M.to_3x3() @ Vector((0, 0, -1))).normalized())}
mug = D.objects["Coffee_Mug"]
data["mugTop"] = list(mug.matrix_world @ Vector((0, 0, 0.09)))
data.pop("Desk_Lamp", None)
json.dump(data, open(OUT + "scene-data.json", "w"), indent=1)
print("led", data["led"], "mug", data["mugTop"])

for im in D.images:
    if im.name in ("bake_day", "bake_lamp", "props_day", "props_lamp"):
        im.pack()
bpy.ops.wm.save_as_mainfile(filepath="D:/EDU/PE-3d/blender/pe_room.blend")
print("saved")
