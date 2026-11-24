"""Project each object's bounding box through the (2D-matched) camera and compare with its box in the PE illustration."""
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

D = bpy.data
sc = bpy.context.scene
cam = sc.camera
W, H = 2752, 1536
# PE cut-out boxes (x, y, w, h) in room.webp pixels; plant/lamp/chair read off the plate
TARGET = globals().get("TARGET") or {
    "Interactive_Laptop": (753, 1015, 533, 404), "Coffee_Mug": (1216, 1154, 172, 172), "Interactive_Phone": (1652, 1269, 225, 153),
    "Interactive_Notebook": (1246, 1237, 409, 180), "Interactive_Calendar": (732, 510, 254, 310), "Interactive_Corkboard": (423, 339, 333, 754),
    "Interactive_Trophy_CupTop": (1925, 334, 171, 190), "Interactive_Trophy_MedalTop": (2040, 335, 142, 188),
    "Interactive_Trophy_CupLow": (1952, 791, 165, 194), "Interactive_Trophy_MedalLow": (2050, 786, 148, 198),
    "Interactive_Trophy_MedalHang": (1875, 456, 130, 264), "Desk_Plant": (1705, 1050, 230, 210),
    "Desk_Lamp": (845, 830, 200, 430), "Desk_Chair": (578, 1190, 482, 346),
}


def pbox(o):
    dg = bpy.context.evaluated_depsgraph_get()
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    pts = [world_to_camera_view(sc, cam, oe.matrix_world @ v.co) for v in me.vertices]
    oe.to_mesh_clear()
    us = [p.x * W for p in pts]
    vs = [(1 - p.y) * H for p in pts]
    return min(us), min(vs), max(us) - min(us), max(vs) - min(vs)


if __name__ == "__main__" or True:
    for n, (x, y, w, h) in TARGET.items():
        o = D.objects.get(n)
        if not o:
            print("missing", n); continue
        bx, by, bw, bh = pbox(o)
        print("%-30s now (%5.0f,%5.0f %4.0fx%4.0f)  want (%5.0f,%5.0f %4.0fx%4.0f)  size ratio w %.2f h %.2f" % (
            n, bx, by, bw, bh, x, y, w, h, w / bw, h / bh))
