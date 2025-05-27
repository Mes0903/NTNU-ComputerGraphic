let draggingThird = false;
let renderingMode = 'texture'; // Current rendering mode
let lightingParams = {
  ambient: 0.2,
  diffuse: 0.7,
  specular: 0.5,
  shininess: 32
};
let reflectionParams = {
  enabled: true,
  strength: 0.3
};

function main() {
  const canvas = document.getElementById('webgl');
  const gl = getWebGLContext(canvas);
  if (!gl) { alert('WebGL not supported'); return; }

  // Initialize main shader program
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;
  const mainProgram = gl.program;

  // Initialize skybox shader program
  const skyboxProgram = createProgram(gl, SKYBOX_VSHADER, SKYBOX_FSHADER);
  if (!skyboxProgram) return;

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
    u_MvpMatrix: gl.getUniformLocation(mainProgram, 'u_MvpMatrix'),
    u_ModelMatrix: gl.getUniformLocation(mainProgram, 'u_ModelMatrix'),
    u_NormalMatrix: gl.getUniformLocation(mainProgram, 'u_NormalMatrix'),
    u_LightPosition: gl.getUniformLocation(mainProgram, 'u_LightPosition'),
    u_ViewPosition: gl.getUniformLocation(mainProgram, 'u_ViewPosition'),
    u_EyePosition: gl.getUniformLocation(mainProgram, 'u_EyePosition'),
    u_Ka: gl.getUniformLocation(mainProgram, 'u_Ka'),
    u_Kd: gl.getUniformLocation(mainProgram, 'u_Kd'),
    u_Ks: gl.getUniformLocation(mainProgram, 'u_Ks'),
    u_Shininess: gl.getUniformLocation(mainProgram, 'u_Shininess'),
    u_Color: gl.getUniformLocation(mainProgram, 'u_Color'),
    u_Texture: gl.getUniformLocation(mainProgram, 'u_Texture'),
    u_CubeMap: gl.getUniformLocation(mainProgram, 'u_CubeMap'),
    u_UseTexture: gl.getUniformLocation(mainProgram, 'u_UseTexture'),
    u_UseReflection: gl.getUniformLocation(mainProgram, 'u_UseReflection'),
    u_ReflectionStrength: gl.getUniformLocation(mainProgram, 'u_ReflectionStrength')
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
  
  // Object buffers
  const vBuffer = gl.createBuffer();
  const nBuffer = gl.createBuffer();
  const tBuffer = gl.createBuffer();
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
    mvpMatrix.set(camera.proj).multiply(camera.view).multiply(modelMatrix);
    normalMatrix.setInverseOf(modelMatrix).transpose();

    // Set uniforms based on rendering mode
    gl.uniformMatrix4fv(mainLocations.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(mainLocations.u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(mainLocations.u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform3f(mainLocations.u_LightPosition, 5, 5, 5);
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
        break;
      case 'normal':
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        break;
      case 'phong':
        gl.uniform3f(mainLocations.u_Color, 0.8, 0.8, 0.9);
        gl.uniform1i(mainLocations.u_UseTexture, false);
        gl.uniform1i(mainLocations.u_UseReflection, false);
        break;
      case 'reflection':
        gl.uniform3f(mainLocations.u_Color, 1, 1, 1);
        gl.uniform1i(mainLocations.u_UseTexture, true);
        gl.uniform1i(mainLocations.u_UseReflection, reflectionParams.enabled);
        gl.uniform1f(mainLocations.u_ReflectionStrength, reflectionParams.strength);
        break;
    }

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, objectTexture);
    gl.uniform1i(mainLocations.u_Texture, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
    gl.uniform1i(mainLocations.u_CubeMap, 1);

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

    // Draw object
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);
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

      // Start animation loop
      let lastTime = performance.now();
      (function tick(now = performance.now()) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        // Update camera
        camera.processKeyboard(dt, keys);
        camera.updateMatrices();

        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Render skybox first
        renderSkybox();

        // Render main object
        renderObject();

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

  // Lighting parameter sliders
  const ambientSlider = document.getElementById('ambientStrength');
  const ambientValue = document.getElementById('ambientValue');
  ambientSlider.addEventListener('input', e => {
    lightingParams.ambient = parseFloat(e.target.value);
    ambientValue.textContent = e.target.value;
  });

  const diffuseSlider = document.getElementById('diffuseStrength');
  const diffuseValue = document.getElementById('diffuseValue');
  diffuseSlider.addEventListener('input', e => {
    lightingParams.diffuse = parseFloat(e.target.value);
    diffuseValue.textContent = e.target.value;
  });

  const specularSlider = document.getElementById('specularStrength');
  const specularValue = document.getElementById('specularValue');
  specularSlider.addEventListener('input', e => {
    lightingParams.specular = parseFloat(e.target.value);
    specularValue.textContent = e.target.value;
  });

  const shininessSlider = document.getElementById('shininess');
  const shininessValue = document.getElementById('shininessValue');
  shininessSlider.addEventListener('input', e => {
    lightingParams.shininess = parseFloat(e.target.value);
    shininessValue.textContent = e.target.value;
  });
}

window.onload = main;