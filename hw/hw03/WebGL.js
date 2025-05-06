// WebGL.js - 3D Robot Scene

// Vertex shader program
const VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Normal;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_NormalMatrix;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    void main() {
        gl_Position = u_MvpMatrix * a_Position;
        v_PositionInWorld = (u_ModelMatrix * a_Position).xyz; 
        v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
    }
`;

// Fragment shader program
const FSHADER_SOURCE = `
    precision mediump float;
    uniform vec3 u_LightPosition;
    uniform vec3 u_ViewPosition;
    uniform float u_Ka;
    uniform float u_Kd;
    uniform float u_Ks;
    uniform float u_Shininess;
    uniform vec3 u_Color;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    void main() {
        // Define lighting colors
        vec3 ambientLightColor = u_Color;
        vec3 diffuseLightColor = u_Color;
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0);

        // Calculate ambient component
        vec3 ambient = ambientLightColor * u_Ka;

        // Calculate diffuse component
        vec3 normal = normalize(v_Normal);
        vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
        float nDotL = max(dot(lightDirection, normal), 0.0);
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;

        // Calculate specular component
        vec3 specular = vec3(0.0, 0.0, 0.0);
        if(nDotL > 0.0) {
            vec3 R = reflect(-lightDirection, normal);
            vec3 V = normalize(u_ViewPosition - v_PositionInWorld); 
            float specAngle = clamp(dot(R, V), 0.0, 1.0);
            specular = u_Ks * pow(specAngle, u_Shininess) * specularLightColor; 
        }

        // Combine all lighting components
        gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

// Global variables
let gl;
let canvas;

// Mouse interaction variables
let mouseLastX, mouseLastY;
let mouseDragging = false;
let angleX = 0, angleY = 0;

// Camera parameters
let cameraX = 3, cameraY = 3, cameraZ = 7;

// Zoom factor
let zoomFactor = 0.5;

// Light position
let lightX = 2, lightY = 5, lightZ = 3;

// Robot position
let robotX = 0, robotY = 0, robotZ = 0;

// Robot joint angles
let joint1Angle = 0, joint2Angle = 0, joint3Angle = 0;

// Object joint angles
let objJoint1Angle = 0, objJoint2Angle = 0;

// Object position
let objectX = 2, objectY = 0, objectZ = 2;

// State variables
let grabMode = false;
let touchMode = false;
let jointMode = 0;

// Matrices
let mvpMatrix;
let modelMatrix;
let normalMatrix;

// WebGL program locations
let a_Position, a_Normal;
let u_MvpMatrix, u_ModelMatrix, u_NormalMatrix;
let u_LightPosition, u_ViewPosition;
let u_Ka, u_Kd, u_Ks, u_Shininess, u_Color;

// 3D model buffers
let groundBuffer, cubeBuffer, sphereBuffer, cylinderBuffer;

// Main function (exposed globally for HTML onload)
function main() {
    // Get the canvas element
    canvas = document.getElementById('webgl');
    if (!canvas) {
        console.log('Failed to retrieve the <canvas> element');
        return;
    }

    // Get the WebGL context
    gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to initialize shaders.');
        return;
    }

    // Initialize matrices
    mvpMatrix = new Matrix4();
    modelMatrix = new Matrix4();
    normalMatrix = new Matrix4();

    // Get the attribute and uniform locations
    getLocations();

    // Initialize buffers for 3D geometries
    initBuffers();

    // Setup event listeners for controls
    setupEventListeners();

    // Enable depth test
    gl.enable(gl.DEPTH_TEST);

    // Update UI elements
    updateUIElements();

    // Draw the scene
    draw();
}

// Expose main function globally for HTML onload
window.main = main;

// Get attribute and uniform locations from the shader program
function getLocations() {
    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    
    u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
    u_ViewPosition = gl.getUniformLocation(gl.program, 'u_ViewPosition');
    u_Ka = gl.getUniformLocation(gl.program, 'u_Ka');
    u_Kd = gl.getUniformLocation(gl.program, 'u_Kd');
    u_Ks = gl.getUniformLocation(gl.program, 'u_Ks');
    u_Shininess = gl.getUniformLocation(gl.program, 'u_Shininess');
    u_Color = gl.getUniformLocation(gl.program, 'u_Color');
}

// Initialize the buffers for 3D geometries
function initBuffers() {
    // Create ground buffer (a flat cube)
    groundBuffer = createCubeBuffer(8, 0.2, 8);
    
    // Create cube buffer for robot parts
    cubeBuffer = createCubeBuffer(1, 1, 1);
    
    // Create sphere buffer for object parts and light visualization
    sphereBuffer = createSphereBuffer(0.5, 32, 32);
    
    // Create cylinder buffer for joints
    cylinderBuffer = createCylinderBuffer(0.2, 0.2, 32);
}

// Create a cube buffer with the specified dimensions
function createCubeBuffer(width, height, depth) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    
    // Define the vertices of the cube
    const vertices = new Float32Array([
        // Front face
        -halfWidth, -halfHeight,  halfDepth,   halfWidth, -halfHeight,  halfDepth,   halfWidth,  halfHeight,  halfDepth,
         halfWidth,  halfHeight,  halfDepth,  -halfWidth,  halfHeight,  halfDepth,  -halfWidth, -halfHeight,  halfDepth,
        
        // Back face
        -halfWidth, -halfHeight, -halfDepth,  -halfWidth,  halfHeight, -halfDepth,   halfWidth,  halfHeight, -halfDepth,
         halfWidth,  halfHeight, -halfDepth,   halfWidth, -halfHeight, -halfDepth,  -halfWidth, -halfHeight, -halfDepth,
        
        // Top face
        -halfWidth,  halfHeight, -halfDepth,  -halfWidth,  halfHeight,  halfDepth,   halfWidth,  halfHeight,  halfDepth,
         halfWidth,  halfHeight,  halfDepth,   halfWidth,  halfHeight, -halfDepth,  -halfWidth,  halfHeight, -halfDepth,
        
        // Bottom face
        -halfWidth, -halfHeight, -halfDepth,   halfWidth, -halfHeight, -halfDepth,   halfWidth, -halfHeight,  halfDepth,
         halfWidth, -halfHeight,  halfDepth,  -halfWidth, -halfHeight,  halfDepth,  -halfWidth, -halfHeight, -halfDepth,
        
        // Right face
         halfWidth, -halfHeight, -halfDepth,   halfWidth,  halfHeight, -halfDepth,   halfWidth,  halfHeight,  halfDepth,
         halfWidth,  halfHeight,  halfDepth,   halfWidth, -halfHeight,  halfDepth,   halfWidth, -halfHeight, -halfDepth,
        
        // Left face
        -halfWidth, -halfHeight, -halfDepth,  -halfWidth, -halfHeight,  halfDepth,  -halfWidth,  halfHeight,  halfDepth,
        -halfWidth,  halfHeight,  halfDepth,  -halfWidth,  halfHeight, -halfDepth,  -halfWidth, -halfHeight, -halfDepth
    ]);
    
    // Calculate normals
    const normals = calculateNormals(vertices);
    
    // Create and return the buffer object
    return createBuffer(vertices, normals);
}

// Create a sphere buffer
function createSphereBuffer(radius, stacks, sectors) {
    const vertices = [];
    
    // Generate vertices for the sphere
    for (let i = 0; i <= stacks; i++) {
        const stackAngle = Math.PI * i / stacks;
        const xy = radius * Math.sin(stackAngle);
        const z = radius * Math.cos(stackAngle);
        
        for (let j = 0; j <= sectors; j++) {
            const sectorAngle = 2 * Math.PI * j / sectors;
            const x = xy * Math.cos(sectorAngle);
            const y = xy * Math.sin(sectorAngle);
            
            // Add vertex position
            vertices.push(x, y, z);
        }
    }
    
    // Generate indices
    const indices = [];
    for (let i = 0; i < stacks; i++) {
        let k1 = i * (sectors + 1);
        let k2 = k1 + sectors + 1;
        
        for (let j = 0; j < sectors; j++, k1++, k2++) {
            if (i !== 0) {
                indices.push(k1, k2, k1 + 1);
            }
            
            if (i !== (stacks - 1)) {
                indices.push(k1 + 1, k2, k2 + 1);
            }
        }
    }
    
    // Create expanded vertices based on indices
    const expandedVertices = new Float32Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        expandedVertices[i * 3] = vertices[idx * 3];
        expandedVertices[i * 3 + 1] = vertices[idx * 3 + 1];
        expandedVertices[i * 3 + 2] = vertices[idx * 3 + 2];
    }
    
    // Calculate normals (for a sphere, normals are just normalized vertex positions)
    const normals = new Float32Array(expandedVertices.length);
    for (let i = 0; i < expandedVertices.length; i += 3) {
        let length = Math.sqrt(
            expandedVertices[i] * expandedVertices[i] + 
            expandedVertices[i+1] * expandedVertices[i+1] + 
            expandedVertices[i+2] * expandedVertices[i+2]
        );
        
        normals[i] = expandedVertices[i] / length;
        normals[i+1] = expandedVertices[i+1] / length;
        normals[i+2] = expandedVertices[i+2] / length;
    }
    
    // Create and return the buffer object
    return createBuffer(expandedVertices, normals);
}

// Create a cylinder buffer
function createCylinderBuffer(radius, height, segments) {
    const vertices = [];
    const halfHeight = height / 2;
    
    // Generate vertices for the cylinder
    for (let i = 0; i < segments; i++) {
        const angle = 2 * Math.PI * i / segments;
        const nextAngle = 2 * Math.PI * (i + 1) / segments;
        
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        const nextX = radius * Math.cos(nextAngle);
        const nextZ = radius * Math.sin(nextAngle);
        
        // Top face
        vertices.push(0, halfHeight, 0);
        vertices.push(x, halfHeight, z);
        vertices.push(nextX, halfHeight, nextZ);
        
        // Bottom face
        vertices.push(0, -halfHeight, 0);
        vertices.push(nextX, -halfHeight, nextZ);
        vertices.push(x, -halfHeight, z);
        
        // Side face - first triangle
        vertices.push(x, halfHeight, z);
        vertices.push(x, -halfHeight, z);
        vertices.push(nextX, -halfHeight, nextZ);
        
        // Side face - second triangle
        vertices.push(x, halfHeight, z);
        vertices.push(nextX, -halfHeight, nextZ);
        vertices.push(nextX, halfHeight, nextZ);
    }
    
    // Calculate normals
    const normals = calculateNormals(new Float32Array(vertices));
    
    // Create and return the buffer object
    return createBuffer(new Float32Array(vertices), normals);
}

// Calculate normals for given vertices (assuming groups of 3 vertices form triangles)
function calculateNormals(vertices) {
    const normals = new Float32Array(vertices.length);
    
    // For each triangle
    for (let i = 0; i < vertices.length; i += 9) {
        // Get vertices of the triangle
        const x1 = vertices[i];
        const y1 = vertices[i+1];
        const z1 = vertices[i+2];
        
        const x2 = vertices[i+3];
        const y2 = vertices[i+4];
        const z2 = vertices[i+5];
        
        const x3 = vertices[i+6];
        const y3 = vertices[i+7];
        const z3 = vertices[i+8];
        
        // Calculate vectors for two sides of the triangle
        const ux = x2 - x1;
        const uy = y2 - y1;
        const uz = z2 - z1;
        
        const vx = x3 - x1;
        const vy = y3 - y1;
        const vz = z3 - z1;
        
        // Calculate normal using cross product
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        
        // Normalize the normal
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 0) {
            nx /= length;
            ny /= length;
            nz /= length;
        }
        
        // Assign the normal to all vertices of this triangle
        normals[i]   = nx; normals[i+1] = ny; normals[i+2] = nz;
        normals[i+3] = nx; normals[i+4] = ny; normals[i+5] = nz;
        normals[i+6] = nx; normals[i+7] = ny; normals[i+8] = nz;
    }
    
    return normals;
}

// Create a buffer from vertices and normals
function createBuffer(vertices, normals) {
    // Create position buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Create normal buffer
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    
    return {
        vertexBuffer: vertexBuffer,
        normalBuffer: normalBuffer,
        numVertices: vertices.length / 3
    };
}

// Setup event listeners for UI controls
function setupEventListeners() {
    // Mouse events for scene rotation
    canvas.onmousedown = function(ev) {
        const rect = ev.target.getBoundingClientRect();
        if (rect.left <= ev.clientX && ev.clientX < rect.right &&
            rect.top <= ev.clientY && ev.clientY < rect.bottom) {
            mouseLastX = ev.clientX;
            mouseLastY = ev.clientY;
            mouseDragging = true;
        }
    };
    
    canvas.onmousemove = function(ev) {
        if (mouseDragging) {
            const factor = 100 / canvas.height;
            const dx = factor * (ev.clientX - mouseLastX);
            const dy = factor * (ev.clientY - mouseLastY);
            
            angleX += dx;
            angleY += dy;
            
            mouseLastX = ev.clientX;
            mouseLastY = ev.clientY;
            
            draw();
        }
    };
    
    canvas.onmouseup = function() {
        mouseDragging = false;
    };
    
    // Mouse wheel for zooming
    canvas.onwheel = function(ev) {
        ev.preventDefault();
        zoomFactor -= ev.deltaY * 0.001;
        zoomFactor = Math.max(0.1, Math.min(2.0, zoomFactor));
        
        document.getElementById('zoomSlider').value = zoomFactor;
        document.getElementById('zoomValue').textContent = zoomFactor.toFixed(2);
        
        draw();
    };
    
    // Robot position sliders
    document.getElementById('robotXSlider').addEventListener('input', function(ev) {
        robotX = parseFloat(ev.target.value);
        document.getElementById('robotXValue').textContent = robotX.toFixed(2);
        draw();
    });
    
    document.getElementById('robotYSlider').addEventListener('input', function(ev) {
        robotY = parseFloat(ev.target.value);
        document.getElementById('robotYValue').textContent = robotY.toFixed(2);
        draw();
    });
    
    document.getElementById('robotZSlider').addEventListener('input', function(ev) {
        robotZ = parseFloat(ev.target.value);
        document.getElementById('robotZValue').textContent = robotZ.toFixed(2);
        draw();
    });
    
    // Robot joint sliders
    document.getElementById('joint1Slider').addEventListener('input', function(ev) {
        joint1Angle = parseInt(ev.target.value);
        document.getElementById('joint1Value').textContent = joint1Angle;
        draw();
    });
    
    document.getElementById('joint2Slider').addEventListener('input', function(ev) {
        joint2Angle = parseInt(ev.target.value);
        document.getElementById('joint2Value').textContent = joint2Angle;
        draw();
    });
    
    document.getElementById('joint3Slider').addEventListener('input', function(ev) {
        joint3Angle = parseInt(ev.target.value);
        document.getElementById('joint3Value').textContent = joint3Angle;
        draw();
    });
    
    // Object joint sliders
    document.getElementById('objJoint1Slider').addEventListener('input', function(ev) {
        objJoint1Angle = parseInt(ev.target.value);
        document.getElementById('objJoint1Value').textContent = objJoint1Angle;
        draw();
    });
    
    document.getElementById('objJoint2Slider').addEventListener('input', function(ev) {
        objJoint2Angle = parseInt(ev.target.value);
        document.getElementById('objJoint2Value').textContent = objJoint2Angle;
        draw();
    });
    
    // Zoom slider
    document.getElementById('zoomSlider').addEventListener('input', function(ev) {
        zoomFactor = parseFloat(ev.target.value);
        document.getElementById('zoomValue').textContent = zoomFactor.toFixed(2);
        draw();
    });
    
    // Grab button
    document.getElementById('grabButton').addEventListener('click', function() {
        if (checkGrabbable()) {
            grabMode = !grabMode;
            this.textContent = grabMode ? 'Release Object' : 'Grab Object';
            draw();
        } else {
            alert('Robot not close enough to grab the object');
        }
    });
    
    // Keyboard controls
    document.addEventListener('keydown', function(ev) {
        switch(ev.key.toLowerCase()) {
            case 'w': moveRobot(0, 0, -0.1); break;
            case 's': moveRobot(0, 0, 0.1); break;
            case 'a': moveRobot(-0.1, 0, 0); break;
            case 'd': moveRobot(0.1, 0, 0); break;
            case '1': case '2': case '3': case '4': case '5':
                jointMode = parseInt(ev.key);
                break;
            case 'q': 
                jointMode = 0;
                break;
            case 'arrowleft':
                if (jointMode >= 1 && jointMode <= 5) {
                    rotateSelectedJoint(-10);
                }
                break;
            case 'arrowright':
                if (jointMode >= 1 && jointMode <= 5) {
                    rotateSelectedJoint(10);
                }
                break;
            case 'g':
                if (checkGrabbable()) {
                    grabMode = !grabMode;
                    document.getElementById('grabButton').textContent = 
                        grabMode ? 'Release Object' : 'Grab Object';
                }
                break;
        }
        draw();
    });
}

// Update UI elements to reflect current state
function updateUIElements() {
    document.getElementById('robotXSlider').value = robotX;
    document.getElementById('robotXValue').textContent = robotX.toFixed(2);
    
    document.getElementById('robotYSlider').value = robotY;
    document.getElementById('robotYValue').textContent = robotY.toFixed(2);
    
    document.getElementById('robotZSlider').value = robotZ;
    document.getElementById('robotZValue').textContent = robotZ.toFixed(2);
    
    document.getElementById('joint1Slider').value = joint1Angle;
    document.getElementById('joint1Value').textContent = joint1Angle;
    
    document.getElementById('joint2Slider').value = joint2Angle;
    document.getElementById('joint2Value').textContent = joint2Angle;
    
    document.getElementById('joint3Slider').value = joint3Angle;
    document.getElementById('joint3Value').textContent = joint3Angle;
    
    document.getElementById('objJoint1Slider').value = objJoint1Angle;
    document.getElementById('objJoint1Value').textContent = objJoint1Angle;
    
    document.getElementById('objJoint2Slider').value = objJoint2Angle;
    document.getElementById('objJoint2Value').textContent = objJoint2Angle;
    
    document.getElementById('zoomSlider').value = zoomFactor;
    document.getElementById('zoomValue').textContent = zoomFactor.toFixed(2);
}

// Move the robot based on the current mode
function moveRobot(dx, dy, dz) {
    robotX += dx;
    robotY += dy;
    robotZ += dz;
    
    // Update the slider values
    document.getElementById('robotXSlider').value = robotX;
    document.getElementById('robotXValue').textContent = robotX.toFixed(2);
    
    document.getElementById('robotYSlider').value = robotY;
    document.getElementById('robotYValue').textContent = robotY.toFixed(2);
    
    document.getElementById('robotZSlider').value = robotZ;
    document.getElementById('robotZValue').textContent = robotZ.toFixed(2);
}

// Rotate the currently selected joint
function rotateSelectedJoint(angle) {
    switch(jointMode) {
        case 1:
            joint1Angle += angle;
            document.getElementById('joint1Slider').value = joint1Angle;
            document.getElementById('joint1Value').textContent = joint1Angle;
            break;
        case 2:
            joint2Angle += angle;
            document.getElementById('joint2Slider').value = joint2Angle;
            document.getElementById('joint2Value').textContent = joint2Angle;
            break;
        case 3:
            joint3Angle += angle;
            document.getElementById('joint3Slider').value = joint3Angle;
            document.getElementById('joint3Value').textContent = joint3Angle;
            break;
        case 4:
            objJoint1Angle += angle;
            document.getElementById('objJoint1Slider').value = objJoint1Angle;
            document.getElementById('objJoint1Value').textContent = objJoint1Angle;
            break;
        case 5:
            objJoint2Angle += angle;
            document.getElementById('objJoint2Slider').value = objJoint2Angle;
            document.getElementById('objJoint2Value').textContent = objJoint2Angle;
            break;
    }
}

// Calculate the robot's end effector (gripper) position in world coordinates
function robotEndEffectorWorldPos() {
    // Convert joint angles to radians
    const rad1 = joint1Angle * Math.PI / 180;
    const rad2 = joint2Angle * Math.PI / 180;
    const rad3 = joint3Angle * Math.PI / 180;
    
    // First joint position (on the side of the robot)
    const joint1X = robotX + 0.5;
    const joint1Y = robotY + 1.0;
    const joint1Z = robotZ;
    
    // Second joint position (after first arm segment)
    const arm1Length = 0.5;
    const joint2X = joint1X + arm1Length * Math.cos(rad1);
    const joint2Y = joint1Y + arm1Length * Math.sin(rad1);
    const joint2Z = joint1Z;
    
    // Third joint position (after second arm segment)
    const arm2Length = 0.5;
    const joint3X = joint2X + arm2Length * Math.cos(rad1 + rad2);
    const joint3Y = joint2Y + arm2Length * Math.sin(rad1 + rad2);
    const joint3Z = joint2Z;
    
    // End effector position (after gripper)
    const gripperLength = 0.3;
    const endEffectorX = joint3X + gripperLength * Math.cos(rad1 + rad2 + rad3);
    const endEffectorY = joint3Y + gripperLength * Math.sin(rad1 + rad2 + rad3);
    const endEffectorZ = joint3Z;
    
    return [endEffectorX, endEffectorY, endEffectorZ];
}

// Calculate object grab point in world coordinates
function objectGrabPointWorldPos() {
    // For the street lamp, the grab point is at the base
    return [objectX, objectY, objectZ];
}

// Check if the robot can grab the object
function checkGrabbable() {
    // Get the position of the robot's end effector
    const gripperPos = robotEndEffectorWorldPos();
    
    // Get the position of the object's grab point
    const objectPos = objectGrabPointWorldPos();
    
    // Calculate distance between gripper and object
    const distance = Math.sqrt(
        Math.pow(gripperPos[0] - objectPos[0], 2) + 
        Math.pow(gripperPos[1] - objectPos[1], 2) + 
        Math.pow(gripperPos[2] - objectPos[2], 2)
    );
    
    // Debug output
    console.log("Gripper position:", gripperPos);
    console.log("Object position:", objectPos);
    console.log("Distance:", distance);
    
    // Check if the gripper is close enough to grab the object
    const isGrabbable = distance < 0.8;
    touchMode = isGrabbable;
    
    // If in grab mode, update object position to follow the gripper
    if (grabMode && isGrabbable) {
        objectX = gripperPos[0];
        objectY = gripperPos[1];
        objectZ = gripperPos[2];
    }
    
    return isGrabbable;
}

// Draw the scene
function draw() {
    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Check if the object is grabbable
    checkGrabbable();
    
    // Draw the ground
    drawGround();
    
    // Draw the light source
    drawLight();
    
    // Draw the robot
    drawRobot();
    
    // Draw the object
    drawObject();
}

// Draw the ground
function drawGround() {
    const transformMat = new Matrix4();
    transformMat.setTranslate(0, -0.1, 0);
    transformMat.scale(1, 1, 1);
    
    drawOneObject(groundBuffer, transformMat, [1.0, 1.0, 1.0]);
}

// Draw the light source visualization
function drawLight() {
    const transformMat = new Matrix4();
    transformMat.setTranslate(lightX, lightY, lightZ);
    transformMat.scale(0.2, 0.2, 0.2);
    
    drawOneObject(sphereBuffer, transformMat, [1.0, 1.0, 1.0]);
}

// Draw the robot
function drawRobot() {
    // Robot base/body
    let transformMat = new Matrix4();
    transformMat.setTranslate(robotX, robotY + 0.5, robotZ);
    transformMat.scale(1.0, 0.5, 0.8);
    drawOneObject(cubeBuffer, transformMat, [0.0, 0.7, 0.0]);
    
    // Robot head
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX, robotY + 1.0, robotZ);
    transformMat.scale(0.5, 0.5, 0.5);
    drawOneObject(cubeBuffer, transformMat, [0.0, 0.8, 0.0]);
    
    // Joint 1 (base joint)
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX + 0.5, robotY + 1.0, robotZ);
    transformMat.rotate(joint1Angle, 0, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.0, 0.0, 0.8]);
    
    // Arm segment 1
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX + 0.5, robotY + 1.0, robotZ);
    transformMat.rotate(joint1Angle, 0, 0, 1);
    transformMat.translate(0.25, 0, 0);
    transformMat.scale(0.5, 0.1, 0.1);
    drawOneObject(cubeBuffer, transformMat, [0.7, 0.7, 0.7]);
    
    // Calculate first joint position
    const rad1 = joint1Angle * Math.PI / 180;
    const joint1X = robotX + 0.5 + 0.5 * Math.cos(rad1);
    const joint1Y = robotY + 1.0 + 0.5 * Math.sin(rad1);
    
    // Joint 2
    transformMat = new Matrix4();
    transformMat.setTranslate(joint1X, joint1Y, robotZ);
    transformMat.rotate(joint1Angle + joint2Angle, 0, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.0, 0.0, 0.8]);
    
    // Arm segment 2
    transformMat = new Matrix4();
    transformMat.setTranslate(joint1X, joint1Y, robotZ);
    transformMat.rotate(joint1Angle + joint2Angle, 0, 0, 1);
    transformMat.translate(0.25, 0, 0);
    transformMat.scale(0.5, 0.1, 0.1);
    drawOneObject(cubeBuffer, transformMat, [0.7, 0.7, 0.7]);
    
    // Calculate second joint position
    const rad2 = joint2Angle * Math.PI / 180;
    const joint2X = joint1X + 0.5 * Math.cos(rad1 + rad2);
    const joint2Y = joint1Y + 0.5 * Math.sin(rad1 + rad2);
    
    // Joint 3
    transformMat = new Matrix4();
    transformMat.setTranslate(joint2X, joint2Y, robotZ);
    transformMat.rotate(joint1Angle + joint2Angle + joint3Angle, 0, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.0, 0.0, 0.8]);
    
    // Hand/gripper
    transformMat = new Matrix4();
    transformMat.setTranslate(joint2X, joint2Y, robotZ);
    transformMat.rotate(joint1Angle + joint2Angle + joint3Angle, 0, 0, 1);
    transformMat.translate(0.15, 0, 0);
    
    // Change color if in touch mode
    const gripperColor = touchMode ? [1.0, 0.5, 0.0] : [1.0, 0.0, 0.0];
    transformMat.scale(0.3, 0.1, 0.2);
    drawOneObject(cubeBuffer, transformMat, gripperColor);
    
    // Robot wheels - Properly oriented with respect to the robot body
    // Left front wheel
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX - 0.5, robotY + 0.2, robotZ + 0.4);
    transformMat.rotate(90, 90, 0, 1); // Rotate properly around X-axis
    drawOneObject(cylinderBuffer, transformMat, [0.3, 0.3, 0.3]);
    
    // Right front wheel
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX - 0.5, robotY + 0.2, robotZ - 0.4);
    transformMat.rotate(90, 90, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.3, 0.3, 0.3]);
    
    // Left back wheel
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX + 0.5, robotY + 0.2, robotZ + 0.4);
    transformMat.rotate(90, 90, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.3, 0.3, 0.3]);
    
    // Right back wheel
    transformMat = new Matrix4();
    transformMat.setTranslate(robotX + 0.5, robotY + 0.2, robotZ - 0.4);
    transformMat.rotate(90, 90, 0, 1);
    drawOneObject(cylinderBuffer, transformMat, [0.3, 0.3, 0.3]);
}

// Draw the object with joints (street lamp)
function drawObject() {
    let transformMat;
    
    if (grabMode && touchMode) {
        // If the lamp is grabbed, it should follow the robot's arm and rotate with it
        // First calculate the gripper's position and orientation
        const rad1 = joint1Angle * Math.PI / 180;
        const rad2 = joint2Angle * Math.PI / 180;
        const rad3 = joint3Angle * Math.PI / 180;
        
        // Second joint position
        const joint1X = robotX + 0.5 + 0.5 * Math.cos(rad1);
        const joint1Y = robotY + 1.0 + 0.5 * Math.sin(rad1);
        
        // Third joint position
        const joint2X = joint1X + 0.5 * Math.cos(rad1 + rad2);
        const joint2Y = joint1Y + 0.5 * Math.sin(rad1 + rad2);
        
        // Gripper position
        const gripperX = joint2X;
        const gripperY = joint2Y;
        const gripperZ = robotZ;
        
        // Combined rotation angle of the robot arm
        const combinedAngle = joint1Angle + joint2Angle + joint3Angle;
        
        // Base of the street lamp - positioned at the gripper
        transformMat = new Matrix4();
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        // Apply the same rotation as the robot arm
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Offset to position correctly on the gripper
        transformMat.scale(0.3, 0.5, 0.3);
        
        // Change color based on touch mode (always true when grabbed)
        const objectColor = [1.0, 0.5, 0.0]; // Orange for grabbed state
        drawOneObject(cylinderBuffer, transformMat, objectColor);
        
        // Lamp pole (tall cylinder) - attached to base, rotates with gripper
        transformMat = new Matrix4();
        const poleScale = 5;
        const poleHeight = 0.2 * poleScale;
        
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Same offset as base
        transformMat.rotate(objJoint1Angle, 0, 0, 1); // First lamp joint rotates relative to arm
        transformMat.translate(0.0, poleHeight/2, 0.0);
        transformMat.scale(0.1, poleScale, 0.1);
        drawOneObject(cylinderBuffer, transformMat, [0.4, 0.4, 0.4]);
        
        // Lamp arm joint
        transformMat = new Matrix4();
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Same offset as base
        transformMat.rotate(objJoint1Angle, 0, 0, 1);
        transformMat.translate(0.0, poleHeight, 0.0);
        transformMat.scale(0.15, 0.15, 0.15);
        drawOneObject(sphereBuffer, transformMat, [1.0, 1.0, 0.7]);
        
        // Upper lamp segment
        transformMat = new Matrix4();
        const pole2Scale = 2;
        const pole2Height = 0.2 * pole2Scale;
        
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Same offset as base
        transformMat.rotate(objJoint1Angle, 0, 0, 1);
        transformMat.translate(0.0, poleHeight, 0.0);
        transformMat.rotate(objJoint2Angle, 0, 0, 1);
        transformMat.translate(0.0, pole2Height/2, 0.0);
        transformMat.scale(0.1, pole2Scale, 0.1);
        drawOneObject(cylinderBuffer, transformMat, [0.4, 0.4, 0.4]);
        
        // Lamp head
        transformMat = new Matrix4();
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Same offset as base
        transformMat.rotate(objJoint1Angle, 0, 0, 1);
        transformMat.translate(0.0, poleHeight, 0.0);
        transformMat.rotate(objJoint2Angle, 0, 0, 1);
        transformMat.translate(0.0, pole2Height, 0.0);
        transformMat.scale(0.2, 0.2, 0.2);
        drawOneObject(sphereBuffer, transformMat, [1.0, 1.0, 0.7]);
        
        // Lamp shade
        transformMat = new Matrix4();
        transformMat.setTranslate(gripperX, gripperY, gripperZ);
        transformMat.rotate(combinedAngle, 0, 0, 1);
        transformMat.translate(0.3, 0, 0); // Same offset as base
        transformMat.rotate(objJoint1Angle, 0, 0, 1);
        transformMat.translate(0.0, poleHeight, 0.0);
        transformMat.rotate(objJoint2Angle, 0, 0, 1);
        transformMat.translate(0.0, pole2Height + 0.2, 0.0);
        transformMat.rotate(180, 1, 0, 0);
        transformMat.scale(0.3, 0.15, 0.3);
        drawOneObject(cylinderBuffer, transformMat, [0.6, 0.6, 0.6]);
    } else {
        // When not grabbed, draw the lamp at its own position
        // Base of the street lamp (cylindrical base)
        transformMat = new Matrix4();
        transformMat.setTranslate(objectX, objectY, objectZ);
        transformMat.scale(0.3, 0.5, 0.3);
        
        // Change color based on touch mode
        const objectColor = touchMode ? [1.0, 0.5, 0.0] : [0.5, 0.5, 0.5]; // Gray for the lamp base
        drawOneObject(cylinderBuffer, transformMat, objectColor);
        
        // Lamp pole (tall cylinder)
        transformMat = new Matrix4();
        const poleScale = 5;
        const poleHeight = 0.2 * poleScale;
        transformMat.translate(objectX, objectY, objectZ);
        transformMat.rotate(objJoint1Angle, 0, 0, 1); // First joint rotates the pole
        transformMat.translate(0.0, poleHeight/2, 0.0); // Move to the top of the base
        transformMat.scale(0.1, poleScale, 0.1);
        drawOneObject(cylinderBuffer, transformMat, [0.4, 0.4, 0.4]); // Dark gray for the pole
        
        // Lamp arm joint (where the lamp head attaches)
        transformMat = new Matrix4();
        transformMat.translate(objectX, objectY, objectZ);
        transformMat.rotate(objJoint1Angle, 0, 0, 1); // Second joint angle
        transformMat.translate(0.0, poleHeight, 0.0); // Move to the top of the base
        transformMat.scale(0.15, 0.15, 0.15);
        drawOneObject(sphereBuffer, transformMat, [1.0, 1.0, 0.7]); // Joint connector
        
        // Lamp pole (tall cylinder)
        transformMat = new Matrix4();
        const pole2Scale = 2;
        const pole2Height = 0.2 * pole2Scale;
        transformMat.translate(objectX, objectY, objectZ);
        transformMat.rotate(objJoint1Angle, 0, 0, 1); 
        transformMat.translate(0.0, poleHeight, 0.0); 
        transformMat.rotate(objJoint2Angle, 0, 0, 1); 
        transformMat.translate(0.0, pole2Height/2, 0.0); // Move to the top of the base
        transformMat.scale(0.1, pole2Scale, 0.1);
        drawOneObject(cylinderBuffer, transformMat, [0.4, 0.4, 0.4]); // Dark gray for the pole

        // Lamp head (the light part)
        transformMat = new Matrix4();
        transformMat.setTranslate(objectX, objectY, objectZ);
        transformMat.rotate(objJoint1Angle, 0, 0, 1); 
        transformMat.translate(0.0, poleHeight, 0.0); 
        transformMat.rotate(objJoint2Angle , 0, 0, 1);
        transformMat.translate(0.0, pole2Height, 0.0); // Move out from the joint along the arm
        transformMat.scale(0.2, 0.2, 0.2);
        drawOneObject(sphereBuffer, transformMat, [1.0, 1.0, 0.7]); // Light yellow for the lamp head

        // Lamp shade (cone-like shape)
        transformMat = new Matrix4();
        transformMat.setTranslate(objectX, objectY, objectZ);
        transformMat.rotate(objJoint1Angle, 0, 0, 1); 
        transformMat.translate(0.0, poleHeight, 0.0); // Position above the bulb
        transformMat.rotate(objJoint2Angle, 0, 0, 1);
        transformMat.translate(0.0, pole2Height + 0.2, 0.0); // Position above the bulb
        transformMat.rotate(180, 1, 0, 0); // Flip the cone upside down
        transformMat.scale(0.3, 0.15, 0.3); // Flatten for a shade shape
        drawOneObject(cylinderBuffer, transformMat, [0.6, 0.6, 0.6]); // Gray for the shade
    }
}

// Draw a single object with the specified transform and color
function drawOneObject(buffer, transform, color) {
    // Set the model matrix
    gl.uniformMatrix4fv(u_ModelMatrix, false, transform.elements);
    
    // Calculate the MVP matrix (Projection * View * Model)
    mvpMatrix.setPerspective(30, canvas.width / canvas.height, 1, 100);
    mvpMatrix.lookAt(cameraX, cameraY, cameraZ, 0, 0, 0, 0, 1, 0);
    
    // Apply scene rotation from mouse drag
    mvpMatrix.rotate(angleY, 1, 0, 0);
    mvpMatrix.rotate(angleX, 0, 1, 0);
    
    // Apply zoom
    mvpMatrix.scale(zoomFactor, zoomFactor, zoomFactor);
    
    // Multiply by the model matrix
    mvpMatrix.multiply(transform);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    
    // Calculate the normal transformation matrix
    normalMatrix.setInverseOf(transform);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    
    // Set lighting parameters
    gl.uniform3f(u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(u_ViewPosition, cameraX, cameraY, cameraZ);
    gl.uniform1f(u_Ka, 0.2);
    gl.uniform1f(u_Kd, 0.7);
    gl.uniform1f(u_Ks, 0.5);
    gl.uniform1f(u_Shininess, 30.0);
    gl.uniform3f(u_Color, color[0], color[1], color[2]);
    
    // Bind buffers and enable attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    
    // Draw the object
    gl.drawArrays(gl.TRIANGLES, 0, buffer.numVertices);
}

// Utility function for initializing shaders
function initShaders(gl, vshader, fshader) {
    const program = createProgram(gl, vshader, fshader);
    if (!program) {
        console.log('Failed to create program');
        return false;
    }
    
    gl.useProgram(program);
    gl.program = program;
    
    return true;
}

// Create shader program
function createProgram(gl, vshader, fshader) {
    // Create shader objects
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
    if (!vertexShader || !fragmentShader) {
        return null;
    }
    
    // Create program object
    const program = gl.createProgram();
    if (!program) {
        return null;
    }
    
    // Attach shaders to the program
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    // Link the program
    gl.linkProgram(program);
    
    // Check the link status
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        const error = gl.getProgramInfoLog(program);
        console.log('Failed to link program: ' + error);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
        return null;
    }
    
    return program;
}

// Load shader
function loadShader(gl, type, source) {
    // Create shader object
    const shader = gl.createShader(type);
    if (shader == null) {
        console.log('unable to create shader');
        return null;
    }
    
    // Set the shader source
    gl.shaderSource(shader, source);
    
    // Compile the shader
    gl.compileShader(shader);
    
    // Check the compile status
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        const error = gl.getShaderInfoLog(shader);
        console.log('Failed to compile shader: ' + error);
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Get WebGL context
function getWebGLContext(canvas) {
    return canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
}