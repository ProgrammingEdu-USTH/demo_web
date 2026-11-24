"""Move the left wall (and what hangs on it) in so the back-left room corner lands where the painting draws it (u = 743 px)."""
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
D = bpy.data; sc = bpy.context.scene; cam = sc.camera
wall = D.objects["Room_Wall_Left"]
if "pe_orig" not in wall:
    wall["pe_orig"] = list(wall.location)
x_face0 = wall["pe_orig"][0] + 0.05                     # inner face of the wall (box is 0.10 thick)
lo, hi = -2.5, -0.9
for _ in range(40):
    mid = (lo + hi) / 2
    u = world_to_camera_view(sc, cam, Vector((mid, 0.0, 1.5))).x * 2752
    lo, hi = (mid, hi) if u < 743 else (lo, mid)
x_face = (lo + hi) / 2
dx = x_face - x_face0
for n in ["Room_Wall_Left", "Room_Cornice_Left", "Curtain_Left"]:
    o = D.objects[n]
    if "pe_orig" not in o:
        o["pe_orig"] = list(o.location)
    o.location.x = o["pe_orig"][0] + dx
cb = D.objects["Interactive_Corkboard"]
if "pe_wall_dx" not in cb:
    cb["pe_wall_dx"] = 0.0
cb["pe_orig"] = [cb["pe_orig"][0] - cb["pe_wall_dx"] + dx] + list(cb["pe_orig"])[1:]
cb["pe_wall_dx"] = dx
sc["pe_left_wall_face"] = x_face
print("left wall face %.3f -> %.3f (dx %+.3f)" % (x_face0, x_face, dx))
