import bpy
sc=bpy.context.scene
old=(sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath)
sc.render.engine='CYCLES'; sc.cycles.device='GPU'; sc.cycles.samples=48; sc.cycles.use_denoising=True
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1376, 768, 100
sc.render.filepath="D:/EDU/PE-3d/_ref/shots/match.png"
bpy.ops.render.render(write_still=True)
sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath = old
print("ok")
