"""Quick Cycles previews: main camera + two close-ups. Edit SHOTS to choose."""
import bpy, math
from mathutils import Vector

D = bpy.data
sc = bpy.context.scene
SHOTS = globals().get("SHOTS", ["main", "desk", "shelf"])
OUT = "D:/EDU/PE-3d/_ref/shots/"

old = (sc.render.engine, sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'GPU'
sc.cycles.samples = 96
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.image_settings.file_format = 'PNG'

main = D.objects["Camera"]
tmp = D.objects.get("_PreviewCam") or D.objects.new("_PreviewCam", D.cameras.new("_PreviewCam"))
if tmp.name not in sc.collection.objects:
    sc.collection.objects.link(tmp)


def look(cam, eye, target, lens):
    cam.location = eye
    cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens


views = {
    "main": None,
    "desk": ((-0.15, -1.45, 1.25), (-0.35, -0.42, 0.85), 32),
    "shelf": ((0.55, -1.25, 1.45), (1.35, -0.18, 1.45), 26),
    "lamp": ((-0.35, -1.0, 1.05), (-0.72, -0.33, 1.0), 30),
}
LAMP_ONLY = globals().get("LAMP_ONLY", False)
saved = {}
if LAMP_ONLY:   # what the "lamp" bake layer will see
    for o in sc.objects:
        if o.type == 'LIGHT':
            saved[o.name] = (o.hide_render, o.data.energy)
            o.hide_render = o.name not in ("Light_Desk_Lamp", "Light_Window_Warm")
            if o.name == "Light_Window_Warm":
                o.data.energy = 12
    bg = sc.world.node_tree.nodes["Background"]
    saved["_bg"] = bg.inputs[1].default_value
    bg.inputs[1].default_value = 0.0
for s in SHOTS:
    if views[s] is None:
        sc.camera = main
    else:
        look(tmp, *views[s])
        sc.camera = tmp
    sc.render.filepath = OUT + "prev_" + s + ("_lamp" if LAMP_ONLY else "") + ".png"
    bpy.ops.render.render(write_still=True)
    print("wrote", sc.render.filepath)

for n, v in saved.items():
    if n == "_bg":
        sc.world.node_tree.nodes["Background"].inputs[1].default_value = v
    else:
        D.objects[n].hide_render, D.objects[n].data.energy = v
sc.render.engine, sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath = old
