let draggingThird = false;
let renderingMode = 'texture'; // Current rendering mode
let lightingParams = {
  ambient: 0.005,  
  diffuse: 0.7,
  specular: 0.7937, 
  shininess: 150    
};

let reflectionParams = {
  enabled: true,
  strength: 0.3
};

let bumpParams = {
  enabled: false,
  strength: 0.2
};

let shadowParams = {
  enabled: true,
  lightPos: [15, 20, 15] // Light position for shadow mapping
};

function main() {
  const canvas = document.getElementById('webgl');
  const gl = getWebGLContext(canvas);
  if (!gl) { alert('WebGL not supported'); return; }

  // Check for depth texture extension (needed for shadow mapping)
  const depthTextureExt = gl.getExtension('WEBGL_depth_texture');
  if (!depthTextureExt) {
    console.warn('WEBGL_depth_texture not supported. Shadows may not work properly.');
  }

  // Initialize main shader program
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;
  const mainProgram = gl.program;

  // Initialize shadow shader program
  const shadowProgram = createProgram(gl, SHADOW_VSHADER, SHADOW_FSHADER);
  if (!shadowProgram) return;

  // Initialize skybox shader program
  const skyboxProgram = createProgram(gl, SKYBOX_VSHADER, SKYBOX_FSHADER);
  if (!skyboxProgram) return;

  // Create shadow framebuffer with higher resolution to reduce aliasing
  const shadowFramebuffer = createShadowFramebuffer(gl, 2048);

  // Clear color, enable depth test, and set viewport
  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Get attribute and uniform locations for main program
  gl.useProgram(mainProgram);
  const mainLocations = {
    a_Position: gl.getAttribLocation(mainProgram, 'a_Position'),
    a_Normal: gl.getAttribLocation(mainProgram, 'a_Normal'),
    a_TexCoord: gl.getAttribLocation(mainProgram, 'a_TexCoord'),
    a_Color: gl.getAttribLocation(mainProgram, 'a_Color'),
    u_MvpMatrix: gl.getUniformLocation(mainProgram, 'u_MvpMatrix'),
    u_ModelMatrix: gl.getUniformLocation(mainProgram, 'u_ModelMatrix'),
    u_NormalMatrix: gl.getUniformLocation(mainProgram, 'u_NormalMatrix'),
    u_LightMvpMatrix: gl.getUniformLocation(mainProgram, 'u_LightMvpMatrix'),
    u_LightPosition: gl.getUniformLocation(mainProgram, 'u_LightPosition'),
    u_ViewPosition: gl.getUniformLocation(mainProgram, 'u_ViewPosition'),
    u_EyePosition: gl.getUniformLocation(mainProgram, 'u_EyePosition'),
    u_Ka: gl.getUniformLocation(mainProgram, 'u_Ka'),
    u_Kd: gl.getUniformLocation(mainProgram, 'u_Kd'),
    u_Ks: gl.getUniformLocation(mainProgram, 'u_Ks'),
    u_Shininess: gl.getUniformLocation(mainProgram, 'u_Shininess'),
    u_Color: gl.getUniformLocation(mainProgram, 'u_Color'),
    u_Texture: gl.getUniformLocation(mainProgram, 'u_Texture'),
    u_BumpTexture: gl.getUniformLocation(mainProgram, 'u_BumpTexture'),
    u_ShadowMap: gl.getUniformLocation(mainProgram, 'u_ShadowMap'),
    u_CubeMap: gl.getUniformLocation(mainProgram, 'u_CubeMap'),
    u_UseTexture: gl.getUniformLocation(mainProgram, 'u_UseTexture'),
    u_UseReflection: gl.getUniformLocation(mainProgram, 'u_UseReflection'),
    u_ShowNormals: gl.getUniformLocation(mainProgram, 'u_ShowNormals'),
    u_UseVertexColors: gl.getUniformLocation(mainProgram, 'u_UseVertexColors'),
    u_UseBumpMapping: gl.getUniformLocation(mainProgram, 'u_UseBumpMapping'),
    u_UseShadow: gl.getUniformLocation(mainProgram, 'u_UseShadow'),
    u_ReflectionStrength: gl.getUniformLocation(mainProgram, 'u_ReflectionStrength'),
    u_BumpStrength: gl.getUniformLocation(mainProgram, 'u_BumpStrength'),
    u_ShowHeightMap: gl.getUniformLocation(mainProgram, 'u_ShowHeightMap')
  };

  // Get attribute and uniform locations for shadow program
  gl.useProgram(shadowProgram);
  const shadowLocations = {
    a_Position: gl.getAttribLocation(shadowProgram, 'a_Position'),
    u_MvpMatrix: gl.getUniformLocation(shadowProgram, 'u_MvpMatrix'),
    u_ModelMatrix: gl.getUniformLocation(shadowProgram, 'u_ModelMatrix')
  };

  // Get attribute and uniform locations for skybox program
  gl.useProgram(skyboxProgram);
  const skyboxLocations = {
    a_Position: gl.getAttribLocation(skyboxProgram, 'a_Position'),
    u_ViewMatrix: gl.getUniformLocation(skyboxProgram, 'u_ViewMatrix'),
    u_ProjMatrix: gl.getUniformLocation(skyboxProgram, 'u_ProjMatrix'),
    u_CubeMap: gl.getUniformLocation(skyboxProgram, 'u_CubeMap')
  };

  // Prepare matrices and buffers
  const mvpMatrix = new Matrix4();
  const modelMatrix = new Matrix4();
  const normalMatrix = new Matrix4();
  const lightMvpMatrix = new Matrix4();
  const lightViewMatrix = new Matrix4();
  const lightProjMatrix = new Matrix4();
  
  // Object buffers
  const vBuffer = gl.createBuffer();
  const nBuffer = gl.createBuffer();
  const tBuffer = gl.createBuffer();
  const cBuffer = gl.createBuffer(); // Color buffer
  let numVertices = 0;

  // Skybox buffers
  const skyboxGeometry = createSkyboxGeometry();
  const skyboxVertexBuffer = gl.createBuffer();
  const skyboxIndexBuffer = gl.createBuffer();

  // Setup skybox buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, skyboxGeometry.vertices, gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyboxIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, skyboxGeometry.indices, gl.STATIC_DRAW);

  // For cube surround model
  const cubeCount = 8;
  const cubePos = new Float32Array([
    // positions              // normals
    // +X
    0.5,-0.5,-0.5,  1,0,0,   0.5, 0.5,-0.5, 1,0,0,   0.5, 0.5, 0.5, 1,0,0,
    0.5,-0.5,-0.5,  1,0,0,   0.5, 0.5, 0.5, 1,0,0,   0.5,-0.5, 0.5, 1,0,0,
    // -X
    -0.5,-0.5,-0.5, -1,0,0,  -0.5, 0.5, 0.5,-1,0,0,  -0.5, 0.5,-0.5,-1,0,0,
    -0.5,-0.5,-0.5, -1,0,0,  -0.5,-0.5, 0.5,-1,0,0,  -0.5, 0.5, 0.5,-1,0,0,
    // +Y
    -0.5, 0.5,-0.5,  0,1,0,   0.5, 0.5,-0.5, 0,1,0,   0.5, 0.5, 0.5, 0,1,0,
    -0.5, 0.5,-0.5,  0,1,0,   0.5, 0.5, 0.5, 0,1,0,  -0.5, 0.5, 0.5, 0,1,0,
    // -Y
    -0.5,-0.5,-0.5,  0,-1,0,  0.5,-0.5, 0.5,0,-1,0,   0.5,-0.5,-0.5,0,-1,0,
    -0.5,-0.5,-0.5,  0,-1,0, -0.5,-0.5, 0.5,0,-1,0,   0.5,-0.5, 0.5,0,-1,0,
    // +Z
    -0.5,-0.5, 0.5,  0,0,1,   0.5, 0.5, 0.5,0,0,1,    0.5,-0.5, 0.5,0,0,1,
    -0.5,-0.5, 0.5,  0,0,1,  -0.5, 0.5, 0.5,0,0,1,    0.5, 0.5, 0.5,0,0,1,
    // -Z
    -0.5,-0.5,-0.5,  0,0,-1,  0.5,-0.5,-0.5,0,0,-1,   0.5, 0.5,-0.5,0,0,-1,
    -0.5,-0.5,-0.5,  0,0,-1,   0.5, 0.5,-0.5,0,0,-1, -0.5, 0.5,-0.5,0,0,-1,
  ]);
  const cubeVtx = cubePos.length / 6;          // 36
  const cubeVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
  gl.bufferData(gl.ARRAY_BUFFER, cubePos, gl.STATIC_DRAW);

  /* Utility: tiny HSV→RGB so we can sweep the hue easily */
  function hsvToRgb(h, s = 1, v = 1) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const mod = i % 6;
    return [
      [v, q, p, p, t, v][mod],
      [t, v, v, q, p, p][mod],
      [p, p, t, v, v, q][mod]
    ];
  }

  /* Spherical-orbit parameters
   *    θ (theta) = longitude  angle in [0, 2π)
   *    φ (phi)   = latitude   angle in [0, π]
   * Each cube owns an independent dθ/dt & dφ/dt so the paths look unique. 
   */
  const cubes = Array.from({ length: cubeCount }, (_, i) => ({
    theta: i * Math.PI * 2 / cubeCount,
    phi  : (Math.PI / cubeCount) * (i + 1),
    dTheta: 0.6 + 0.1 * i * Math.random(),
    dPhi  : 0.3 + 0.1 * i * Math.random(),
    spin  : 0,
    radius: 3.0,
    color : hsvToRgb(i / cubeCount)        // evenly-spaced rainbow
  }));

  // Load cube map texture
  const cubeMapFaces = [
    'assets/Yokohama2/posx.jpg', // +X
    'assets/Yokohama2/negx.jpg', // -X
    'assets/Yokohama2/posy.jpg', // +Y
    'assets/Yokohama2/negy.jpg', // -Y
    'assets/Yokohama2/posz.jpg', // +Z
    'assets/Yokohama2/negz.jpg'  // -Z
  ];
  const cubeMapTexture = loadCubeMap(gl, cubeMapFaces);

  // Load object texture
  const objectTexture = gl.createTexture();
  const textureImage = new Image();
  textureImage.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, objectTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  textureImage.src = 'assets/spot/spot_texture.png';

  // Load bump texture (height map) - using the hmap.jpg from GAMES101
  const bumpTexture = gl.createTexture();
  const bumpImage = new Image();
  bumpImage.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, bumpTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bumpImage);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    console.log('Bump texture loaded successfully');
  };
  bumpImage.src = 'assets/spot/hmap.png';

  // Initialize camera and input state
  const camera = new Camera(canvas);
  const keys = {};
  let firstPerson = document.getElementById('viewMode').checked;

  // Setup UI controls
  setupUIControls();

  // Show or hide cursor based on mode
  function updateCursor() {
    canvas.style.cursor = firstPerson ? 'none' : 'auto';
  }
  updateCursor();

  // Handle mode toggle checkbox
  document.getElementById('viewMode').addEventListener('change', e => {
    firstPerson = e.target.checked;
    if (firstPerson) {
      canvas.requestPointerLock();
    } else {
      document.exitPointerLock();
    }
    updateCursor();
  });

  // React to pointer lock changes
  document.addEventListener('pointerlockchange', () => {
    updateCursor();
  });

  // Mouse events
  canvas.addEventListener('mousedown', () => {
    if (firstPerson) {
      canvas.requestPointerLock();
    } else {
      draggingThird = true;
    }
  });

  document.addEventListener('mouseup', () => {
    draggingThird = false;
  });

  canvas.addEventListener('mousemove', e => {
    if (firstPerson) {
      if (document.pointerLockElement === canvas) {
        camera.processMouseDelta(e.movementX, e.movementY);
      }
    } else if (draggingThird) {
      camera.processMouseDelta(e.movementX, e.movementY);
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  });

  // Handle keyboard input
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup', e => keys[e.code] = false);

  // Function to setup light matrices for shadow mapping
  function setupLightMatrices() {
    // Set up light's view matrix (looking at origin from light position)
    lightViewMatrix.setLookAt(
      shadowParams.lightPos[0], shadowParams.lightPos[1], shadowParams.lightPos[2], // eye
      0, 0, 0,                                                                      // target
      0, 1, 0                                                                       // up
    );
    
    // Set up light's projection matrix (orthographic projection for better shadow coverage)
    // Increased the projection size to cover more of the scene and reduce aliasing
    lightProjMatrix.setOrtho(-12, 12, -12, 12, 1, 40);
    
    // Combine light projection and view matrices
    lightMvpMatrix.set(lightProjMatrix).multiply(lightViewMatrix);
  }

  // Function to render shadow map (depth pass)
  function renderShadowMap() {
    // Bind shadow framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer.framebuffer);
    gl.viewport(0, 0, shadowFramebuffer.size, shadowFramebuffer.size);
    
    // Clear depth buffer
    gl.clear(gl.DEPTH_BUFFER_BIT);
    
    // Use shadow shader program
    gl.useProgram(shadowProgram);
    
    // Setup light matrices
    setupLightMatrices();
    
    // Render main object to shadow map
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.vertexAttribPointer(shadowLocations.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shadowLocations.a_Position);
    
    modelMatrix.setIdentity();
    modelMatrix.rotate(180, 0, 1, 0);
    mvpMatrix.set(lightMvpMatrix).multiply(modelMatrix);
    
    gl.uniformMatrix4fv(shadowLocations.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(shadowLocations.u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);
    
    // Render cubes to shadow map
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
    gl.vertexAttribPointer(shadowLocations.a_Position, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(shadowLocations.a_Position);
    
    cubes.forEach(c => {
      const x = c.radius * Math.sin(c.phi) * Math.cos(c.theta);
      const y = c.radius * Math.cos(c.phi);
      const z = c.radius * Math.sin(c.phi) * Math.sin(c.theta);
      
      modelMatrix.setIdentity();
      modelMatrix.translate(x, y + 0.7, z);
      modelMatrix.rotate(c.spin, 1, 1, 0);
      mvpMatrix.set(lightMvpMatrix).multiply(modelMatrix);
      
      gl.uniformMatrix4fv(shadowLocations.u_MvpMatrix, false, mvpMatrix.elements);
      gl.uniformMatrix4fv(shadowLocations.u_ModelMatrix, false, modelMatrix.elements);
      gl.drawArrays(gl.TRIANGLES, 0, cubeVtx);
    });
    
    // Unbind shadow framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // Function to render skybox
  function renderSkybox() {
    gl.useProgram(skyboxProgram);
    gl.depthFunc(gl.LEQUAL);
    
    // Create view matrix without translation for skybox
    const skyboxViewMatrix = new Matrix4();
    skyboxViewMatrix.set(camera.view);
    skyboxViewMatrix.elements[12] = 0;
    skyboxViewMatrix.elements[13] = 0;
    skyboxViewMatrix.elements[14] = 0;

    // Set uniforms
    gl.uniformMatrix4fv(skyboxLocations.u_ViewMatrix, false, skyboxViewMatrix.elements);
    gl.uniformMatrix4fv(skyboxLocations.u_ProjMatrix, false, camera.proj.elements);
    
    // Bind cube map texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
    gl.uniform1i(skyboxLocations.u_CubeMap, 0);

    // Bind skybox geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
    gl.vertexAttribPointer(skyboxLocations.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(skyboxLocations.a_Position);

    // Draw skybox
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyboxIndexBuffer);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    
    gl.depthFunc(gl.LESS);
  }

  // Function to render main object
  function renderObject() {
    gl.useProgram(mainProgram);
    
    // Update matrices
    modelMatrix.setIdentity();
    modelMatrix.rotate(180, 0, 1, 0);   // face camera (Y-axis)
    mvpMatrix.set(camera.proj).multiply(camera.view).multiply(modelMatrix);
    normalMatrix.setInverseOf(modelMatrix).transpose(); // used to transform normal into world space

    // Set uniforms based on rendering mode
    gl.uniformMatrix4fv(mainLocations.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(mainLocations.u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(mainLocations.u_NormalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(mainLocations.u_LightMvpMatrix, false, lightMvpMatrix.elements);
    gl.uniform3fv(mainLocations.u_LightPosition, shadowParams.lightPos);
    gl.uniform3f(mainLocations.u_ViewPosition, camera.pos[0], camera.pos[1], camera.pos[2]);
    gl.uniform3f(mainLocations.u_EyePosition, camera.pos[0], camera.pos[1], camera.pos[2]);
    
    // Apply lighting parameters
    gl.uniform1f(mainLocations.u_Ka, lightingParams.ambient);
    gl.uniform1f(mainLocations.u_Kd, lightingParams.diffuse);
    gl.uniform1f(mainLocations.u_Ks, lightingParams.specular);
    gl.uniform1f(mainLocations.u_Shininess, lightingParams.shininess);
    
    // Set rendering mode specific parameters
    switch(renderingMode) {
      case 'texture':
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, true);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, false);
        gl.uniform1i(mainLocations.u_UseVertexColors, false);
        gl.uniform1i(mainLocations.u_UseBumpMapping, false);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1i(mainLocations.u_UseShadow, shadowParams.enabled);
        break;
      case 'normal':
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, true);
        gl.uniform1i(mainLocations.u_UseVertexColors, false);
        gl.uniform1i(mainLocations.u_UseBumpMapping, false);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1i(mainLocations.u_UseShadow, false); // No shadow in normal mode
        break;
      case 'phong':
        gl.uniform3f(mainLocations.u_Color, 0.8, 0.8, 0.9);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, false);
        gl.uniform1i(mainLocations.u_UseVertexColors, true);
        gl.uniform1i(mainLocations.u_UseBumpMapping, false);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1i(mainLocations.u_UseShadow, shadowParams.enabled);
        break;
      case 'bump':
        // This matches the C++ bump_fragment_shader exactly
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, true); // Show modified normals as colors
        gl.uniform1i(mainLocations.u_UseVertexColors, false);
        gl.uniform1i(mainLocations.u_UseBumpMapping, true);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1f(mainLocations.u_BumpStrength, bumpParams.strength);
        gl.uniform1i(mainLocations.u_UseShadow, false); // No shadow in bump mode
        break;
      case 'heightMap':
        // Show the height map texture directly
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, false);
        gl.uniform1i(mainLocations.u_UseVertexColors, false);
        gl.uniform1i(mainLocations.u_UseBumpMapping, true);
        gl.uniform1i(mainLocations.u_ShowHeightMap, true);
        gl.uniform1i(mainLocations.u_UseShadow, false); // No shadow in height map mode
        break;
      case 'reflection':
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, reflectionParams.enabled);
        gl.uniform1i(mainLocations.u_ShowNormals, false);
        gl.uniform1i(mainLocations.u_UseVertexColors, false);
        gl.uniform1i(mainLocations.u_UseBumpMapping, false);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1f(mainLocations.u_ReflectionStrength, reflectionParams.strength);
        gl.uniform1i(mainLocations.u_UseShadow, shadowParams.enabled);
        break;
      case 'shadow':
        // New shadow visualization mode
        gl.uniform3f(mainLocations.u_Color, 0.8, 0.8, 0.9);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        gl.uniform1i(mainLocations.u_ShowNormals, false);
        gl.uniform1i(mainLocations.u_UseVertexColors, true);
        gl.uniform1i(mainLocations.u_UseBumpMapping, false);
        gl.uniform1i(mainLocations.u_ShowHeightMap, false);
        gl.uniform1i(mainLocations.u_UseShadow, true); // Always show shadow in this mode
        break;
    }

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, objectTexture);
    gl.uniform1i(mainLocations.u_Texture, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bumpTexture);
    gl.uniform1i(mainLocations.u_BumpTexture, 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
    gl.uniform1i(mainLocations.u_CubeMap, 2);
    
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, shadowFramebuffer.depthTexture);
    gl.uniform1i(mainLocations.u_ShadowMap, 3);

    // Bind vertex buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.vertexAttribPointer(mainLocations.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(mainLocations.a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.vertexAttribPointer(mainLocations.a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(mainLocations.a_Normal);

    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.vertexAttribPointer(mainLocations.a_TexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(mainLocations.a_TexCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.vertexAttribPointer(mainLocations.a_Color, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(mainLocations.a_Color);

    // Draw object
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);
  }

  function renderCubes(dt) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
    // stride = 6 * 4 bytes; pos offset 0, normal offset 12
    gl.vertexAttribPointer(mainLocations.a_Position, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(mainLocations.a_Position);
    gl.vertexAttribPointer(mainLocations.a_Normal, 3, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(mainLocations.a_Normal);

    // Disable texturing / reflection for cubes, but keep shadow
    gl.uniform1i(mainLocations.u_UseTexture,     false);
    gl.uniform1i(mainLocations.u_UseReflection,  false);
    gl.uniform1i(mainLocations.u_ShowNormals,    false);
    gl.uniform1i(mainLocations.u_UseVertexColors,false);
    gl.uniform1i(mainLocations.u_UseBumpMapping, false);
    gl.uniform1i(mainLocations.u_ShowHeightMap,  false);
    gl.uniform1i(mainLocations.u_UseShadow, shadowParams.enabled);

    cubes.forEach(c => {
      // ---- advance spherical coordinates ----
      c.theta += c.dTheta * dt;
      c.phi   += c.dPhi   * dt;

      // keep angles in [0, 2π) for numeric stability
      c.theta %= Math.PI * 2;
      c.phi   %= Math.PI * 2;

      // ---- convert spherical → Cartesian ----
      const x = c.radius * Math.sin(c.phi) * Math.cos(c.theta);
      const y = c.radius * Math.cos(c.phi);          // vertical component
      const z = c.radius * Math.sin(c.phi) * Math.sin(c.theta);

      // ---- self-spin (optional) ----
      c.spin += 120 * dt;                            // deg/s

      // ---- build model matrix ----
      modelMatrix.setIdentity();
      modelMatrix.translate(x, y + 0.7, z);          // 0.7 = Spot's torso height
      modelMatrix.rotate(c.spin, 1, 1, 0);           // arbitrary axis
      mvpMatrix.set(camera.proj).multiply(camera.view).multiply(modelMatrix);
      normalMatrix.setInverseOf(modelMatrix).transpose();

      // ---- push uniforms & draw ----
      gl.uniform3fv(mainLocations.u_Color, c.color);

      gl.uniformMatrix4fv(mainLocations.u_MvpMatrix,    false, mvpMatrix.elements);
      gl.uniformMatrix4fv(mainLocations.u_ModelMatrix,  false, modelMatrix.elements);
      gl.uniformMatrix4fv(mainLocations.u_NormalMatrix, false, normalMatrix.elements);
      gl.uniformMatrix4fv(mainLocations.u_LightMvpMatrix, false, lightMvpMatrix.elements);
      gl.drawArrays(gl.TRIANGLES, 0, cubeVtx);
    });
  }

  // Load OBJ and start render loop
  fetch('assets/spot/spot_triangulated_good.obj')
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(text => {
      // Parse OBJ
      const { geometries } = parseOBJ(text);
      const data = geometries[0].data;
      const positions = new Float32Array(data.position);
      const normals = new Float32Array(data.normal);
      const texCoords = new Float32Array(data.texcoord || []);
      numVertices = positions.length / 3;

      // Generate vertex colors to match GAMES101 version (brownish colors)
      const colors = new Float32Array(numVertices * 3);
      for (let i = 0; i < numVertices; i++) {
        colors[i * 3] = 148.0 / 255.0;     // R
        colors[i * 3 + 1] = 121.0 / 255.0; // G  
        colors[i * 3 + 2] = 92.0 / 255.0;  // B
      }

      // Handle texture coordinates - use existing ones or generate simple planar mapping
      let finalTexCoords = texCoords;
      if (texCoords.length === 0) {
        console.log("No texture coordinates found, generating simple planar mapping");
        finalTexCoords = new Float32Array(numVertices * 2);
        
        // Find bounding box for normalization
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (let i = 0; i < numVertices; i++) {
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        
        // Generate simple planar UV mapping
        for (let i = 0; i < numVertices; i++) {
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          
          // Normalize to 0-1 range
          const u = (x - minX) / (maxX - minX);
          const v = (y - minY) / (maxY - minY);
          
          finalTexCoords[i * 2] = u;
          finalTexCoords[i * 2 + 1] = v;
        }
      } else {
        console.log("Using existing texture coordinates from OBJ file");
        // The OBJ file has texture coordinates, but let's check if they need adjustment
        // Sometimes V coordinates are flipped
        const adjustedTexCoords = new Float32Array(texCoords.length);
        for (let i = 0; i < texCoords.length; i += 2) {
          adjustedTexCoords[i] = texCoords[i];       // U coordinate
          adjustedTexCoords[i + 1] = 1.0 - texCoords[i + 1]; // Flip V coordinate
        }
        finalTexCoords = adjustedTexCoords;
      }

      // Upload buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, finalTexCoords, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

      // Start animation loop
      let lastTime = performance.now();
      (function tick(now = performance.now()) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        // Update camera
        camera.processKeyboard(dt, keys);
        camera.updateMatrices();

        // First pass - render shadow map (only if shadows enabled)
        if (shadowParams.enabled) {
          renderShadowMap();
        }

        // Second pass - render scene
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderSkybox();
        renderObject();
        renderCubes(dt); 

        requestAnimationFrame(tick);
      })();
    })
    .catch(e => console.error('Failed to load OBJ:', e));
}

// Setup UI controls
function setupUIControls() {
  // Rendering mode radio buttons
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        renderingMode = e.target.value;
      }
    });
  });

  // Reflection strength slider
  const reflectionSlider = document.getElementById('reflectionStrength');
  const reflectionValue = document.getElementById('reflectionValue');
  reflectionSlider.addEventListener('input', e => {
    reflectionParams.strength = parseFloat(e.target.value);
    reflectionValue.textContent = e.target.value;
  });

  // Reflection enable checkbox
  document.getElementById('enableReflection').addEventListener('change', e => {
    reflectionParams.enabled = e.target.checked;
  });

  // Shadow enable checkbox
  document.getElementById('enableShadow').addEventListener('change', e => {
    shadowParams.enabled = e.target.checked;
  });

  // Bump mapping controls
  const bumpSlider = document.getElementById('bumpStrength');
  const bumpValue = document.getElementById('bumpValue');
  bumpParams.strength = parseFloat(bumpSlider.value); 
  bumpValue.textContent = bumpSlider.value;  
  bumpSlider.addEventListener('input', e => {
    bumpParams.strength = parseFloat(e.target.value);
    bumpValue.textContent = e.target.value;
  });

  // Lighting parameter sliders
  const ambientSlider = document.getElementById('ambientStrength');
  const ambientValue = document.getElementById('ambientValue');
  lightingParams.ambient = parseFloat(ambientSlider.value);
  ambientValue.textContent = ambientSlider.value;
  ambientSlider.addEventListener('input', e => {
    lightingParams.ambient = parseFloat(e.target.value);
    ambientValue.textContent = e.target.value;
  });

  const diffuseSlider = document.getElementById('diffuseStrength');
  const diffuseValue = document.getElementById('diffuseValue');
  lightingParams.diffuse = parseFloat(diffuseSlider.value);
  diffuseValue.textContent = diffuseSlider.value;
  diffuseSlider.addEventListener('input', e => {
    lightingParams.diffuse = parseFloat(e.target.value);
    diffuseValue.textContent = e.target.value;
  });

  const specularSlider = document.getElementById('specularStrength');
  const specularValue = document.getElementById('specularValue');
  lightingParams.specular = parseFloat(specularSlider.value);
  specularValue.textContent = specularSlider.value;
  specularSlider.addEventListener('input', e => {
    lightingParams.specular = parseFloat(e.target.value);
    specularValue.textContent = e.target.value;
  });

  const shininessSlider = document.getElementById('shininess');
  const shininessValue = document.getElementById('shininessValue');
  lightingParams.shininess = parseFloat(shininessSlider.value);
  shininessValue.textContent = shininessSlider.value;
  shininessSlider.addEventListener('input', e => {
    lightingParams.shininess = parseFloat(e.target.value);
    shininessValue.textContent = e.target.value;
  });
}

window.onload = main;