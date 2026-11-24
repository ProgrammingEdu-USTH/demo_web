"""Atlas-unwrap every room mesh and bake two lighting layers with Cycles:
   day  = neutral daylight through the window + ambient (tinted by the sky colour on the web)
   lamp = desk lamp + fairy lights + screens (faded in at dusk/night on the web)
Web shader: final = day * skyTint + lamp * lampLevel   (linear light adds up, so this is physically fine)
"""
import bpy, time

D = bpy.data
sc = bpy.context.scene
OUT = "D:/EDU/PE-3d/web/public/assets/"
RES = 2048
SAMPLES = 160
SKIP = {"Foreground_Plant_Left", "Window_LED_Lights", "Laptop_Screen", "Window_Glass_L", "Window_Glass_R"}


def view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return dict(window=win, area=area, region=region)


OV = view3d_override()
unused = D.collections["PE_Unused"]
targets = [o for o in sc.objects if o.type == 'MESH' and o.name not in SKIP and unused not in o.users_collection]
print("bake targets:", len(targets))

# ---------- UV atlas ----------
with bpy.context.temp_override(**OV):
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for o in targets:
        if o.data.users > 1:
            o.data = o.data.copy()
        uv = o.data.uv_layers.get("Atlas") or o.data.uv_layers.new(name="Atlas")
        o.data.uv_layers.active = uv
        uv.active_render = True
    for o in targets:
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in targets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(margin=0.0035, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
print("uv packed")

# ---------- bake target image node on every material ----------
def get_img(name):
    img = D.images.get(name)
    if img and tuple(img.size) != (RES, RES):
        D.images.remove(img)
        img = None
    if not img:
        img = D.images.new(name, RES, RES, alpha=False, float_buffer=False)
    img.generated_color = (0, 0, 0, 1)
    return img


mats = {s.material for o in targets for s in o.material_slots if s.material}
nodes = []
for m in mats:
    m.use_nodes = True
    n = m.node_tree.nodes.get("PE_BAKE") or m.node_tree.nodes.new("ShaderNodeTexImage")
    n.name = "PE_BAKE"
    n.location = (-600, -400)
    for x in m.node_tree.nodes:
        x.select = False
    n.select = True
    m.node_tree.nodes.active = n
    nodes.append(n)

# ---------- cycles ----------
sc.render.engine = 'CYCLES'
try:
    cp = bpy.context.preferences.addons['cycles'].preferences
    cp.compute_device_type = 'OPTIX'
    cp.get_devices()
    for d in cp.devices:
        d.use = d.type == 'OPTIX'
    sc.cycles.device = 'GPU'
except Exception as e:
    print("gpu setup failed, cpu:", e)
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
EMIS = ["Mat_Lamp_Bulb", "Mat_LED_Glow", "Mat_Laptop_Screen", "Mat_Phone_Screen"]


def emis(mult):
    for n in EMIS:
        b = next(x for x in D.materials[n].node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
        if "pe_emis" not in D.materials[n]:
            D.materials[n]["pe_emis"] = b.inputs['Emission Strength'].default_value
        b.inputs['Emission Strength'].default_value = D.materials[n]["pe_emis"] * mult


def bake(name):
    img = get_img(name)
    for n in nodes:
        n.image = img
    t = time.time()
    with bpy.context.temp_override(**OV):
        bpy.ops.object.select_all(action='DESELECT')
        for o in targets:
            o.select_set(True)
        bpy.context.view_layer.objects.active = targets[0]
        bpy.ops.object.bake(type='COMBINED')
    img.filepath_raw = OUT + name + ".png"
    img.file_format = 'PNG'
    img.save()
    print("baked", name, round(time.time() - t, 1), "s")


# pass 1: neutral daylight
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 0.55
L["Light_Desk_Lamp"].hide_render = True
L["Light_Window_Warm"].hide_render = True
L["Light_Room_Fill"].hide_render = False
L["Light_Room_Fill"].data.color = (1, 1, 1)
L["Light_Room_Fill"].data.energy = 14
L["Light_Sunset_Outside"].hide_render = False
L["Light_Sunset_Outside"].data.color = (1, 1, 1)
L["Light_Sunset_Outside"].data.energy = 150
emis(0.0)
bake("bake_day")

# pass 2: lamp + fairy lights + screens only
bg.inputs[1].default_value = 0.0
L["Light_Desk_Lamp"].hide_render = False
L["Light_Window_Warm"].hide_render = False
L["Light_Room_Fill"].hide_render = True
L["Light_Sunset_Outside"].hide_render = True
emis(1.0)
bake("bake_lamp")

# restore
for n, (e, c, h) in orig.items():
    L[n].data.energy = e
    L[n].data.color = c
    L[n].hide_render = h
bg.inputs[0].default_value = orig_bg[0]
bg.inputs[1].default_value = orig_bg[1]
sc.render.engine = 'BLENDER_EEVEE'
print("done")
