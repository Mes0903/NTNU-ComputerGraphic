let draggingThird = false;

function main() {
  const canvas = document.getElementById('webgl');
  const gl     = getWebGLContext(canvas);
  if (!gl) { alert('WebGL not supported'); return; }
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

  // Clear color, enable depth test, and set viewport
  gl.clearColor(0.2, 0.2, 0.2, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Get attribute and uniform locations
  const a_Position     = gl.getAttribLocation(gl.program, 'a_Position');
  const a_Normal       = gl.getAttribLocation(gl.program, 'a_Normal');
  const u_MvpMatrix    = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  const u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  const u_LightPos     = gl.getUniformLocation(gl.program, 'u_LightPosition');
  const u_ViewPos      = gl.getUniformLocation(gl.program, 'u_ViewPosition');
  const u_Ka           = gl.getUniformLocation(gl.program, 'u_Ka');
  const u_Kd           = gl.getUniformLocation(gl.program, 'u_Kd');
  const u_Ks           = gl.getUniformLocation(gl.program, 'u_Ks');
  const u_Shininess    = gl.getUniformLocation(gl.program, 'u_Shininess');
  const u_Color        = gl.getUniformLocation(gl.program, 'u_Color');

  // Prepare matrices and buffers
  const mvpMatrix    = new Matrix4();
  const normalMatrix = new Matrix4();
  const modelMatrix  = new Matrix4();
  const vBuffer      = gl.createBuffer();
  const nBuffer      = gl.createBuffer();
  let numVertices    = 0;

  // Initialize camera and input state
  const camera = new Camera(canvas);
  const keys   = {};
  let firstPerson = document.getElementById('viewMode').checked;

  // Show or hide cursor based on mode
  function updateCursor() {
    canvas.style.cursor = firstPerson ? 'none' : 'auto';
  }
  updateCursor();

  // Handle mode toggle checkbox
  document.getElementById('viewMode').addEventListener('change', e => {
    firstPerson = e.target.checked;
    if (firstPerson) {
      canvas.requestPointerLock();   // Lock pointer in first-person
    } else {
      document.exitPointerLock();    // Release pointer in third-person
    }
    updateCursor();
  });

  // React to pointer lock changes (only cursor visibility)
  document.addEventListener('pointerlockchange', () => {
    updateCursor();
  });

  // Mouse down: in first-person lock pointer, in third-person start dragging
  canvas.addEventListener('mousedown', () => {
    if (firstPerson) {
      canvas.requestPointerLock();
    } else {
      draggingThird = true;
    }
  });

  // Mouse up: stop third-person dragging
  document.addEventListener('mouseup', () => {
    draggingThird = false;
  });

  // Mouse move: apply rotation in either mode
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
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  });

  // Handle keyboard input for movement
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup',   e => keys[e.code] = false);

  // Load OBJ and start render loop
  fetch('assets/spot/spot_triangulated_good.obj')
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(text => {
      // Parse OBJ
      const { geometries } = parseOBJ(text);
      const data      = geometries[0].data;
      const positions = new Float32Array(data.position);
      const normals   = new Float32Array(data.normal);
      numVertices = positions.length / 3;

      // Upload position buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Position);

      // Upload normal buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Normal);

      // Start animation loop
      let lastTime = performance.now();
      (function tick(now = performance.now()) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        // Update camera and matrices
        camera.processKeyboard(dt, keys);
        camera.updateMatrices();

        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Reset model matrix
        modelMatrix.setIdentity();

        // Compute MVP
        mvpMatrix.set(camera.proj)
                 .multiply(camera.view)
                 .multiply(modelMatrix);

        // Compute normal matrix
        normalMatrix.setInverseOf(modelMatrix).transpose();

        // Set shader uniforms
        gl.uniformMatrix4fv(u_MvpMatrix,    false, mvpMatrix.elements);
        gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
        gl.uniform3f(u_LightPos,   5, 5, 5);
        gl.uniform3f(u_ViewPos,    camera.pos[0], camera.pos[1], camera.pos[2]);
        gl.uniform1f(u_Ka,         0.2);
        gl.uniform1f(u_Kd,         0.7);
        gl.uniform1f(u_Ks,         0.5);
        gl.uniform1f(u_Shininess,  32);
        gl.uniform3f(u_Color,      1, 1, 1);

        // Draw geometry
        gl.drawArrays(gl.TRIANGLES, 0, numVertices);

        requestAnimationFrame(tick);
      })();
    })
    .catch(e => console.error('Failed to load OBJ:', e));
}

window.onload = main;
