"""Two atlases (room + props) x two light layers (day + lamp).
Run once with PASS="uv", then once per bake: room_day, room_lamp, props_day, props_lamp (each call < 10 min).
Web shader: colour = day * skyTint + lamp * lampLevel.
"""
import bpy, time

D = bpy.data
sc = bpy.context.scene
PASS = globals().get("PASS", "uv")
OUT = "D:/EDU/PE-3d/web/public/assets/"
RES = 2048
SAMPLES = 128
SKIP = {"Window_LED_Lights", "Laptop_Screen", "Window_Glass_L", "Window_Glass_R"}
ROOM_INTERACTIVE = {"Interactive_Corkboard", "Interactive_Calendar"}   # big flat things: keep them in the room atlas


def view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                return dict(window=win, area=area, region=next(r for r in area.regions if r.type == 'WINDOW'))


OV = view3d_override()
unused = D.collections["PE_Unused"]
allm = [o for o in sc.objects if o.type == 'MESH' and o.name not in SKIP and unused not in o.users_collection
        and not o.name.startswith("_") and o.visible_get() and not o.hide_render]
is_prop = lambda o: (o.name.startswith("Interactive_") or o.name == "Coffee_Mug") and o.name not in ROOM_INTERACTIVE
props = [o for o in allm if is_prop(o)]
room = [o for o in allm if not is_prop(o)]


def select(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]



with bpy.context.temp_override(**OV):
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in allm:
        if o.data.users > 1:
            o.data = o.data.copy()
        for uv in [u for u in o.data.uv_layers if u.name != "Atlas"]:
            o.data.uv_layers.remove(uv)
        uv = o.data.uv_layers.get("Atlas") or o.data.uv_layers.new(name="Atlas")
        o.data.uv_layers.active = uv
        uv.active_render = True
        select([o])
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    for grp in (room, props):
        select(grp)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.average_islands_scale()
        bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
        bpy.ops.object.mode_set(mode='OBJECT')
print("uv packed: room", len(room), "props", len(props))
import json
json.dump({"props": sorted(o.name for o in props)}, open(OUT + "atlas-groups.json", "w"), indent=1)
