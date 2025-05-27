# The question

In this final project, you are going to create a nice-looking scene which includes multiple 3D objects.

Required User Interaction:
• One of the 3D objects is the ”player”. Users can move the player and rotate the player by the mouse and keyboard.
• By default, your camera should move/rotate along with the ”player”. This is so called the first person view angle.
• Allow users to switch between the first person view angle and the third person view angle (by pressing the mouse button or a key). The third person view angle can be just a fixed camera position which can cover most of the region of your scene.

Technical Requirements: 
• 1 point light and implement the local illumination (ambient+difusse+specular and phong shading)
• At least, 1 of the 3D objects with nice texture mapping
• Use an environment cube map to have the environment background
• Cube map reflection or refraction on at least one object (If you implement the dynamic reflection or reflection described in the ”options” section, you automatically satisfy this requirement)
• Make some of your objects keep moving or rotating. This is an example, http://math.hws.edu/graphicsbook/source/webgl/cube-camera.html
• At the bottom of your webpage, write some texts to shortly introduce your work and tell users how to play your work

Pick 2 out of 3:
• shadow
• dynamic reflection
• bump mapping

You are not allowed to use high-level 3D rendering library, such as three.js. You can use the cuon-matrix.js for matrix/vector computation

# My impl

Generally, I just transformed the GAMES101 HW3 I wrote before([link](https://github.com/Mes0903/GAMES101-Windows)) into javascript, and then fetch up the requirement that didnt be asked in GAMES101, like the cubemap.
