// ============================
// Global Control Variables
// ============================

// Robot translation and joint angles
let robotX = 0.0;
let robotY = -0.4;
let robotJoint1Angle = 0;   // Base arm rotation (degrees)
let robotJoint2Angle = 30;  // Forearm rotation (degrees)
let robotJoint3Angle = 0;   // Claw rotation (degrees)

// Object joint angles and root position
let objectJoint1Angle = 0;
let objectJoint2Angle = 0;
let objectX = 0.5;  // Object root position X
let objectY = 0.0;  // Object root position Y

// Scene scale (for zoom)
let sceneScale = 1.0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

// Grab related flag and threshold
let isGrabbed = false;
const GRAB_DISTANCE_THRESHOLD = 0.2;  // Increase slightly if needed

// ============================
// WebGL Variables and Shader Sources
// ============================
let gl, program;

// Vertex shader program
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  uniform mat4 u_modelMatrix;
  varying vec4 v_Color;
  void main() {
    gl_Position = u_modelMatrix * a_Position;
    v_Color = a_Color;
  }
`;

// Fragment shader program
const FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }
`;

// ============================
// Geometry Creation Functions
// ============================

// Create rectangle vertices (two triangles) centered at (0,0)
function makeRectVertices(width, height, color) {
  let w = width / 2;
  let h = height / 2;
  let vertices = [
    -w,  h,  0.0,
    -w, -h,  0.0,
     w,  h,  0.0,
     
     w,  h,  0.0,
    -w, -h,  0.0,
     w, -h,  0.0
  ];
  let colors = [];
  for (let i = 0; i < 6; i++) {
    colors.push(color[0], color[1], color[2]);
  }
  return { vertices, colors };
}

// Create triangle vertices (like a simple claw)
function makeTriangleVertices(base, height, color) {
  let b = base / 2;
  let h = height;
  let vertices = [
     0.0,  h,   0.0,
    -b,  0.0,  0.0,
     b,  0.0,  0.0
  ];
  let colors = [];
  for (let i = 0; i < 3; i++) {
    colors.push(color[0], color[1], color[2]);
  }
  return { vertices, colors };
}

// Create a circle using a fan of triangles.
function makeCircleVertices(radius, color, sides = 50) {
  let vertices = [];
  let colors = [];
  for (let i = 0; i < sides; i++) {
    let theta = (2 * Math.PI * i) / sides;
    let x = radius * Math.cos(theta);
    let y = radius * Math.sin(theta);
    
    // Triangle fan: center, current, next
    vertices.push(0.0, 0.0, 0.0);  // center
    vertices.push(x, y, 0.0);       // current point
    
    let theta2 = (2 * Math.PI * (i + 1)) / sides;
    let x2 = radius * Math.cos(theta2);
    let y2 = radius * Math.sin(theta2);
    vertices.push(x2, y2, 0.0);
    
    // Colors for the triangle vertices
    for (let j = 0; j < 3; j++) {
      colors.push(color[0], color[1], color[2]);
    }
  }
  return { vertices, colors };
}

// ============================
// Buffer Initialization Helpers
// ============================

function initVertexBufferForLaterUse(gl, vertices, colors) {
  let n = vertices.length / 3;
  let o = {};
  o.numVertices = n;

  o.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  o.vertexBuffer.itemSize = 3;

  o.colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, o.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  o.colorBuffer.itemSize = 3;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return o;
}

function initAttributeVariable(gl, attribute, buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(attribute, buffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(attribute);
}

// ============================
// Global Models (Geometry Objects)
// ============================
let robotBaseModel;
let robotArm1Model;
let robotArm2Model;
let robotClawModel;

let objectShapeA;  // e.g., base rectangle
let objectShapeB;  // e.g., triangle
let objectShapeC;  // e.g., small rectangle
let objectGrabPointModel;  // small circle marking the grab point

// ============================
// Main Program Entry
// ============================
function main() {
  // Get canvas and WebGL context
  let canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl');
  if (!gl) {
    console.error('Failed to get WebGL context.');
    return;
  }
  
  // Compile and use shaders
  program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  gl.useProgram(program);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  
  // Get attribute/uniform locations
  program.a_Position = gl.getAttribLocation(program, 'a_Position');
  program.a_Color = gl.getAttribLocation(program, 'a_Color');
  program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');

  // ----- Create Robot Geometry -----
  // Robot Base (body)
  let rb = makeRectVertices(0.2, 0.1, [0.8, 0.2, 0.2]);
  robotBaseModel = initVertexBufferForLaterUse(gl, rb.vertices, rb.colors);
  
  // Robot Arm 1 (first segment)
  let ra1 = makeRectVertices(0.05, 0.3, [0.2, 0.8, 0.2]);
  robotArm1Model = initVertexBufferForLaterUse(gl, ra1.vertices, ra1.colors);
  
  // Robot Arm 2 (forearm)
  let ra2 = makeRectVertices(0.04, 0.2, [0.2, 0.6, 0.9]);
  robotArm2Model = initVertexBufferForLaterUse(gl, ra2.vertices, ra2.colors);
  
  // Robot Claw (using a triangle)
  let claw = makeTriangleVertices(0.1, 0.1, [1.0, 0.9, 0.0]);
  robotClawModel = initVertexBufferForLaterUse(gl, claw.vertices, claw.colors);
  
  // ----- Create Object Geometry (three shapes + grab point) -----
  // Object shape A (base rectangle)
  let objA = makeRectVertices(0.15, 0.1, [0.0, 1.0, 0.0]);
  objectShapeA = initVertexBufferForLaterUse(gl, objA.vertices, objA.colors);
  
  // Object shape B (triangle)
  let objB = makeTriangleVertices(0.2, 0.15, [0.0, 0.6, 1.0]);
  objectShapeB = initVertexBufferForLaterUse(gl, objB.vertices, objB.colors);
  
  // Object shape C (small rectangle)
  let objC = makeRectVertices(0.05, 0.5, [1.0, 0.0, 1.0]);
  objectShapeC = initVertexBufferForLaterUse(gl, objC.vertices, objC.colors);
  
  // Object grab point (small circle in white)
  let grabCircle = makeCircleVertices(0.03, [1.0, 1.0, 1.0], 30);
  objectGrabPointModel = initVertexBufferForLaterUse(gl, grabCircle.vertices, grabCircle.colors);
  
  // ----- Set up UI Controls (Slider inputs and button) -----
  setupUI();
  
  // Start the animation loop.
  requestAnimationFrame(tick);
}

// ============================
// Animation Loop
// ============================
function tick() {
  drawScene();
  requestAnimationFrame(tick);
}

// ============================
// UI Setup (Slider & Button Event Listeners)
// ============================
function setupUI() {
  // Robot translation X
  const robotXSlider = document.getElementById("robotXSlider");
  const robotXValue = document.getElementById("robotXValue");
  robotXSlider.addEventListener("input", function() {
    robotX = parseFloat(this.value);
    robotXValue.textContent = robotX.toFixed(2);
  });
  
  // Robot translation Y
  const robotYSlider = document.getElementById("robotYSlider");
  const robotYValue = document.getElementById("robotYValue");
  robotYSlider.addEventListener("input", function() {
    robotY = parseFloat(this.value);
    robotYValue.textContent = robotY.toFixed(2);
  });
  
  // Robot Joint 1 (Base) angle
  const joint1Slider = document.getElementById("joint1Slider");
  const joint1Value = document.getElementById("joint1Value");
  joint1Slider.addEventListener("input", function() {
    robotJoint1Angle = parseFloat(this.value);
    joint1Value.textContent = robotJoint1Angle;
  });
  
  // Robot Joint 2 (Forearm) angle
  const joint2Slider = document.getElementById("joint2Slider");
  const joint2Value = document.getElementById("joint2Value");
  joint2Slider.addEventListener("input", function() {
    robotJoint2Angle = parseFloat(this.value);
    joint2Value.textContent = robotJoint2Angle;
  });
  
  // Robot Joint 3 (Claw) angle
  const joint3Slider = document.getElementById("joint3Slider");
  const joint3Value = document.getElementById("joint3Value");
  joint3Slider.addEventListener("input", function() {
    robotJoint3Angle = parseFloat(this.value);
    joint3Value.textContent = robotJoint3Angle;
  });
  
  // Object Joint 1 angle
  const objJoint1Slider = document.getElementById("objJoint1Slider");
  const objJoint1Value = document.getElementById("objJoint1Value");
  objJoint1Slider.addEventListener("input", function() {
    objectJoint1Angle = parseFloat(this.value);
    objJoint1Value.textContent = objectJoint1Angle;
  });
  
  // Object Joint 2 angle
  const objJoint2Slider = document.getElementById("objJoint2Slider");
  const objJoint2Value = document.getElementById("objJoint2Value");
  objJoint2Slider.addEventListener("input", function() {
    objectJoint2Angle = parseFloat(this.value);
    objJoint2Value.textContent = objectJoint2Angle;
  });
  
  // Zoom (sceneScale)
  const zoomSlider = document.getElementById("zoomSlider");
  const zoomValue = document.getElementById("zoomValue");
  zoomSlider.addEventListener("input", function() {
    sceneScale = parseFloat(this.value);
    zoomValue.textContent = sceneScale.toFixed(2);
  });
  
  // Grab button
  const grabButton = document.getElementById("grabButton");
  grabButton.addEventListener("click", function() {
    // Check the distance between the robot's claw (end-effector) and the object's grab point.
    let robotPos = robotEndEffectorWorldPos();
    let objectPos = objectGrabPointWorldPos();
    let distance = getDistance(robotPos, objectPos);
    // If object is not yet grabbed and within threshold, grab it.
    if (!isGrabbed) {
      if (distance < GRAB_DISTANCE_THRESHOLD) {
        isGrabbed = true;
        grabButton.textContent = "Release Object";
      } else {
        alert("Robot's claw is too far from the object grab point!");
      }
    } else {
      isGrabbed = false;
      grabButton.textContent = "Grab Object";
    }
  });
}

// ============================
// Drawing the Scene
// ============================
function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Create scene matrix with zoom.
  let sceneMatrix = new Matrix4();
  sceneMatrix.setIdentity();
  sceneMatrix.scale(sceneScale, sceneScale, 1);
  
  // ----------- Draw Robot -----------
  // Hierarchical transformations:
  // Base -> Joint1 -> Arm1 -> Joint2 -> Arm2 -> Joint3 -> Claw
  
  // 1. Draw robot base
  let baseMatrix = new Matrix4(sceneMatrix);
  baseMatrix.translate(robotX, robotY, 0.0);
  drawShape(robotBaseModel, baseMatrix);
  
  // 2. Joint 1 pivot -> Arm1
  let arm1Matrix = new Matrix4(baseMatrix);
  arm1Matrix.translate(0.0, 0.05, 0.0);  // Pivot at top of base
  arm1Matrix.rotate(robotJoint1Angle, 0, 0, 1);
  arm1Matrix.translate(0.0, 0.15, 0.0);  // Center of arm1
  drawShape(robotArm1Model, arm1Matrix);
  
  // 3. Joint 2 pivot -> Arm2
  let arm2Matrix = new Matrix4(arm1Matrix);
  arm2Matrix.translate(0.0, 0.15, 0.0);  // End of arm1
  arm2Matrix.rotate(robotJoint2Angle, 0, 0, 1);
  arm2Matrix.translate(0.0, 0.1, 0.0);   // Center of arm2
  drawShape(robotArm2Model, arm2Matrix);
  
  // 4. Joint 3 pivot -> Claw
  let clawMatrix = new Matrix4(arm2Matrix);
  clawMatrix.translate(0.0, 0.1, 0.0);     // Pivot for claw attachment
  clawMatrix.rotate(robotJoint3Angle, 0, 0, 1);
  // For drawing, translate so that the claw triangle is positioned correctly.
  // Here we assume the claw is drawn with a tip offset by -0.05 in y.
  clawMatrix.translate(0.0, -0.05, 0.0);    // Position of claw tip (for drawing the claw)
  drawShape(robotClawModel, clawMatrix);
  
  // ----------- Update Object Transformation -----------
  let objectRootMatrix;
  if (isGrabbed) {
    // When grabbed, attach the object to the robot's claw.
    // We start from the current clawMatrix (the robot's claw transformation)
    // and apply an offset so that the object's local white grab point (at y = -0.05)
    // coincides with the claw tip.
    objectRootMatrix = new Matrix4(clawMatrix);
    let offset = new Matrix4();
    offset.setTranslate(0.0, 0.15, 0.0);
    objectRootMatrix.multiply(offset);
  } else {
    // When not grabbed, use the object's independent transformation.
    objectRootMatrix = new Matrix4();
    objectRootMatrix.setIdentity();
    objectRootMatrix.scale(sceneScale, sceneScale, 1);
    objectRootMatrix.translate(objectX, objectY, 0.0);
  }
  
  // In both cases, we now insert a rotation about the white grab point.
  // The white grab point is defined in object-local coordinates at (0, -0.05).
  // To rotate about that point, we do:
  //   T(pivot) x R(angle) x T(-pivot)
  // where T(pivot) is a translation by (0, -0.05) and T(-pivot) by (0, 0.05).
  let T_pivot = new Matrix4();
  T_pivot.translate(0.0, -0.05, 0.0);
  T_pivot.rotate(objectJoint2Angle, 0, 0, 1); // use the slider-controlled angle
  T_pivot.translate(0.0, 0.05, 0.0);
  
  objectRootMatrix.multiply(T_pivot);
  
  // ----------- Draw Object -----------
  // The object drawing uses its own hierarchical transforms.
  
  // Draw base shape (Shape A)
  drawShape(objectShapeA, objectRootMatrix);
  
  // Continue with the subobject hierarchy:
  let objJoint1Matrix = new Matrix4(objectRootMatrix);
  objJoint1Matrix.translate(0.0, 0.05, 0.0);   // Pivot at top of shape A
  objJoint1Matrix.rotate(objectJoint1Angle, 0, 0, 1);
  objJoint1Matrix.translate(0.0, 0.075, 0.0);   // Position for shape B
  drawShape(objectShapeB, objJoint1Matrix);
  
  let objJoint2Matrix = new Matrix4(objJoint1Matrix);
  // Here adjust as needed: for example, translate for the position of shape C.
  objJoint2Matrix.translate(0.0, 0.4, 0.0);    // Position for shape C
  drawShape(objectShapeC, objJoint2Matrix);
  
  // Finally, draw the white grab point for visualization.
  // Since the white grab point should be at (0, -0.05) relative to the object root,
  // use a copy of objectRootMatrix and translate by (0, -0.05).
  let grabPointMatrix = new Matrix4(objectRootMatrix);
  grabPointMatrix.translate(0.0, -0.05, 0.0);
  drawShape(objectGrabPointModel, grabPointMatrix);
}


// ============================
// Helper Function: Drawing a Shape
// ============================
function drawShape(model, transformMatrix) {
  gl.useProgram(program);
  initAttributeVariable(gl, program.a_Position, model.vertexBuffer);
  initAttributeVariable(gl, program.a_Color, model.colorBuffer);
  gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, 0, model.numVertices);
}

// ============================
// Compute Robot Claw End-Effector World Position
// (Updated to include claw translations so the grab occurs at the claw tip.)
// ============================
function robotEndEffectorWorldPos() {
  let sceneMat = new Matrix4();
  sceneMat.setIdentity();
  sceneMat.scale(sceneScale, sceneScale, 1);
  
  // Base transformation (robot position)
  let baseMat = new Matrix4(sceneMat);
  baseMat.translate(robotX, robotY, 0.0);
  
  // Arm 1 transformation
  let arm1Mat = new Matrix4(baseMat);
  arm1Mat.translate(0.0, 0.05, 0.0);    // Pivot at top of base
  arm1Mat.rotate(robotJoint1Angle, 0, 0, 1);
  arm1Mat.translate(0.0, 0.15, 0.0);    // Center of arm1
  
  // Arm 2 transformation
  let arm2Mat = new Matrix4(arm1Mat);
  arm2Mat.translate(0.0, 0.15, 0.0);    // Pivot at end of arm1
  arm2Mat.rotate(robotJoint2Angle, 0, 0, 1);
  arm2Mat.translate(0.0, 0.1, 0.0);     // Center of arm2
  
  // Claw transformation
  let clawMat = new Matrix4(arm2Mat);
  clawMat.translate(0.0, 0.1, 0.0);      // Attach claw to arm2
  clawMat.rotate(robotJoint3Angle, 0, 0, 1);
  clawMat.translate(0.0, 0.05, 0.0);     // Final translation (as used for drawing)

  // Use the tip vertex for the claw triangle. Adjust this value if your geometry changes.
  let tipVertex = new Vector4([0, 0.1, 0, 1]);
  let worldPos = clawMat.multiplyVector4(tipVertex);
  return [worldPos.elements[0], worldPos.elements[1]];
}

// ============================
// Compute the Object Grab Point World Position
// ============================
function objectGrabPointWorldPos() {
  let sceneMatrix = new Matrix4();
  sceneMatrix.setIdentity();
  sceneMatrix.scale(sceneScale, sceneScale, 1);
  
  let objectRootMatrix = new Matrix4(sceneMatrix);
  objectRootMatrix.translate(objectX, objectY, 0.0);
  
  // Grab point is placed at the bottom center of shape A
  let gpMatrix = new Matrix4(objectRootMatrix);
  gpMatrix.translate(0.0, -0.05, 0.0);
  
  let pos = new Vector4([0, 0, 0, 1]);
  let worldPos = gpMatrix.multiplyVector4(pos);
  return [worldPos.elements[0], worldPos.elements[1]];
}

// ============================
// Utility: Compute Distance Between Two Points (2D)
// ============================
function getDistance(p1, p2) {
  let dx = p1[0] - p2[0];
  let dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================
// Shader Compilation Helper
// ============================
function compileShader(gl, vShaderText, fShaderText) {
  // Compile vertex shader
  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vShaderText);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
    return null;
  }
  
  // Compile fragment shader
  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fShaderText);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
    return null;
  }
  
  // Create program and attach shaders
  let prog = gl.createProgram();
  gl.attachShader(prog, vertexShader);
  gl.attachShader(prog, fragmentShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  
  return prog;
}
