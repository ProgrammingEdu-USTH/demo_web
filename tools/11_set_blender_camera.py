import bpy, json, math
from mathutils import Vector
c = json.load(open("D:/EDU/PE-3d/web/public/assets/camera-2d.json"))
cam = bpy.data.objects["Camera"]
cam.location = c["pos"]
cam.rotation_euler = (Vector(c["target"]) - Vector(c["pos"])).to_track_quat('-Z', 'Y').to_euler()
hf = 2 * math.atan(math.tan(math.radians(c["vfov"]) / 2) * c["aspect"])
cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36
cam.data.lens = 18 / math.tan(hf / 2)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 1920, 1072
bpy.ops.wm.save_mainfile()
print("camera lens %.2f mm" % cam.data.lens, "saved")
