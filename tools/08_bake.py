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


group, layer = PASS.split("_")
targets = props if group == "props" else room
name = ("bake_" if group == "room" else "props_") + layer
img = D.images.get(name)
if img and tuple(img.size) != (RES, RES):
    D.images.remove(img); img = None
if not img:
    img = D.images.new(name, RES, RES, alpha=False)
img.generated_color = (0, 0, 0, 1)

for m in {s.material for o in allm for s in o.material_slots if s.material}:
    n = m.node_tree.nodes.get("PE_BAKE") or m.node_tree.nodes.new("ShaderNodeTexImage")
    n.name = "PE_BAKE"
    n.location = (-700, -400)
    n.image = img
    for x in m.node_tree.nodes:
        x.select = False
    n.select = True
    m.node_tree.nodes.active = n

sc.render.engine = 'CYCLES'
cp = bpy.context.preferences.addons['cycles'].preferences
cp.compute_device_type = 'OPTIX'
cp.get_devices()
for dv in cp.devices:
    dv.use = dv.type == 'OPTIX'
sc.cycles.device = 'GPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.bake.margin = 4
sc.render.bake.use_clear = False
sc.render.bake.target = 'IMAGE_TEXTURES'
sc.render.bake.use_selected_to_active = False

L = {n: D.objects[n] for n in ["Light_Desk_Lamp", "Light_Room_Fill", "Light_Sunset_Outside", "Light_Window_Warm"]}
orig = {n: (o.data.energy, tuple(o.data.color), o.hide_render) for n, o in L.items()}
bg = sc.world.node_tree.nodes["Background"]
orig_bg = (tuple(bg.inputs[0].default_value), bg.inputs[1].default_value)
EMIS = ["Mat_Lamp_LED", "Mat_LED_Glow", "Mat_Laptop_Screen", "Mat_Phone_Screen"]


def emis(mult):
    for n in EMIS:
        m = D.materials[n]
        b = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
        if "pe_emis" not in m:
            m["pe_emis"] = b.inputs['Emission Strength'].default_value
        b.inputs['Emission Strength'].default_value = m["pe_emis"] * mult


if layer == "day":       # neutral daylight; the web tints it with the sky colour
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 0.55
    L["Light_Desk_Lamp"].hide_render = True
    L["Light_Window_Warm"].hide_render = True
    L["Light_Room_Fill"].hide_render = False
    L["Light_Room_Fill"].data.color = (1, 1, 1)
    L["Light_Room_Fill"].data.energy = 14
    L["Light_Sunset_Outside"].hide_render = False
    L["Light_Sunset_Outside"].data.color = (1, 1, 1)
    L["Light_Sunset_Outside"].data.energy = 95
    emis(0.0)
else:                    # desk lamp + fairy lights + screens
    bg.inputs[1].default_value = 0.0
    L["Light_Desk_Lamp"].hide_render = False
    L["Light_Desk_Lamp"].data.energy = 44
    L["Light_Window_Warm"].hide_render = False
    L["Light_Window_Warm"].data.energy = 8
    L["Light_Room_Fill"].hide_render = True
    L["Light_Sunset_Outside"].hide_render = True
    emis(1.0)

t = time.time()
try:
    with bpy.context.temp_override(**OV):
        select(targets)
        bpy.ops.object.bake(type='COMBINED')
    img.filepath_raw = OUT + name + ".png"
    img.file_format = 'PNG'
    img.save()
    print("baked", name, len(targets), "objects", round(time.time() - t, 1), "s")
finally:
    for n, (e, c, h) in orig.items():
        L[n].data.energy, L[n].data.color, L[n].hide_render = e, c, h
    L["Light_Desk_Lamp"].data.energy = 44
    bg.inputs[0].default_value = orig_bg[0]
    bg.inputs[1].default_value = orig_bg[1]
    sc.render.engine = 'BLENDER_EEVEE'
