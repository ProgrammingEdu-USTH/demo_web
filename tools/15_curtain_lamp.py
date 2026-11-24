"""Curtain in front of the corkboard (not over it); lamp tall enough to show above the enlarged laptop."""
import bpy
from mathutils import Vector
exec(open("D:/EDU/PE-3d/tools/12_measure.py", encoding="utf-8").read().split("if __name__")[0])   # reuse pbox()
D = bpy.data
cur = D.objects["Curtain_Left"]
cb = D.objects["Interactive_Corkboard"]
def bb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]
if "pe_cur_y" not in cur:
    cur["pe_cur_y"] = cur.location.y
cur.location.y = cur["pe_cur_y"]
bpy.context.view_layer.update()
gap = bb(cur)[1][1] - (bb(cb)[0][1] - 0.04)
cur.location.y = cur["pe_cur_y"] - gap
bpy.context.view_layer.update()
print("curtain moved %.3f m toward the camera; screen box" % -gap, [round(v) for v in pbox(cur)], "(painting curtain ~ x 330..580)")
print("corkboard screen box", [round(v) for v in pbox(cb)], "want (423, 339, 333, 754)")

lamp = D.objects["Desk_Lamp"]
s = 1.35
lamp.scale = (s, s, s)
# slide along x so the lamp's top-left matches the painted lamp head (x 845, y 830)
best = None
x0 = lamp.location.x
for i in range(41):
    lamp.location.x = x0 - 0.2 + i * 0.01
    bpy.context.view_layer.update()
    x, y, w, h = pbox(lamp)
    e = (x - 845) ** 2 + (x + w - 1045) ** 2
    if best is None or e < best[0]:
        best = (e, lamp.location.x)
lamp.location.x = max(best[1], -1.05 + 0.078 * s)      # base must stay on the desk
bpy.context.view_layer.update()
print("lamp x %.3f scale %.2f screen box" % (lamp.location.x, s), [round(v) for v in pbox(lamp)], "top z %.3f" % bb(lamp)[1][2])
