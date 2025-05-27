function main() {
  const canvas = document.getElementById('webgl');
  const gl     = getWebGLContext(canvas);
  if (!gl) { alert('WebGL not supported'); return; }
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

  // clear, depth, viewport
  gl.clearColor(0.2,0.2,0.2,1);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0,0,canvas.width,canvas.height);

  // locations
  const a_Position     = gl.getAttribLocation(gl.program,'a_Position');
  const a_Normal       = gl.getAttribLocation(gl.program,'a_Normal');
  const u_MvpMatrix    = gl.getUniformLocation(gl.program,'u_MvpMatrix');
  const u_NormalMatrix = gl.getUniformLocation(gl.program,'u_NormalMatrix');
  const u_LightPos     = gl.getUniformLocation(gl.program,'u_LightPosition');
  const u_ViewPos      = gl.getUniformLocation(gl.program,'u_ViewPosition');
  const u_Ka           = gl.getUniformLocation(gl.program,'u_Ka');
  const u_Kd           = gl.getUniformLocation(gl.program,'u_Kd');
  const u_Ks           = gl.getUniformLocation(gl.program,'u_Ks');
  const u_Shininess    = gl.getUniformLocation(gl.program,'u_Shininess');
  const u_Color        = gl.getUniformLocation(gl.program,'u_Color');

  // matrices, buffers
  const mvpMatrix    = new Matrix4();
  const normalMatrix = new Matrix4();
  const modelMatrix  = new Matrix4();
  const vBuffer      = gl.createBuffer();
  const nBuffer      = gl.createBuffer();
  let numVertices    = 0;

  // camera & input
  const camera = new Camera(canvas);
  const keys   = {};
  let firstPerson = document.getElementById('firstPerson').checked;

  // sync cursor visibility
  const updateCursor = () => {
    canvas.style.cursor = firstPerson ? 'none' : 'auto';
    canvas.requestPointerLock();
  };
  updateCursor();

  // checkbox to toggle FPS/3PS
  document.getElementById('firstPerson')
    .addEventListener('change', e => {
      firstPerson = e.target.checked;
      camera.firstMouse = true;  // reset mouse on switch
      updateCursor();
    });

  // keyboard movement
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup',   e => keys[e.code] = false);

  // mouse only in 3PS (drag-to-rotate)
  canvas.addEventListener('mousedown', e => {
    if (!firstPerson) camera.firstMouse = true;
    dragging = true;
  });
  canvas.addEventListener('mousemove', e => {
    if (!firstPerson && dragging) {
      camera.processMouse(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('mouseup',   () => { dragging = false; });
  canvas.addEventListener('mouseleave',() => { dragging = false; });

  // handle resize
  window.addEventListener('resize', () => {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0,0,canvas.width,canvas.height);
  });

  // load OBJ and start loop
  fetch('assets/spot/spot_triangulated_good.obj')
    .then(r=> r.ok? r.text(): Promise.reject(r.status))
    .then(text=>{
      const { geometries } = parseOBJ(text);
      const data      = geometries[0].data;
      const positions = new Float32Array(data.position);
      const normals   = new Float32Array(data.normal);
      numVertices = positions.length/3;

      // upload pos
      gl.bindBuffer(gl.ARRAY_BUFFER,vBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
      gl.vertexAttribPointer(a_Position,3,gl.FLOAT,false,0,0);
      gl.enableVertexAttribArray(a_Position);

      // upload norm
      gl.bindBuffer(gl.ARRAY_BUFFER,nBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,normals,gl.STATIC_DRAW);
      gl.vertexAttribPointer(a_Normal,3,gl.FLOAT,false,0,0);
      gl.enableVertexAttribArray(a_Normal);

      let lastTime = performance.now();
      (function tick(now=performance.now()){
        const dt = (now - lastTime)/1000; lastTime = now;

        camera.processKeyboard(dt, keys);
        camera.updateMatrices();

        // clear
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

        // model = identity
        modelMatrix.setIdentity();

        // mvp = proj * view * model
        mvpMatrix.set(camera.proj)
                 .multiply(camera.view)
                 .multiply(modelMatrix);

        normalMatrix.setInverseOf(modelMatrix).transpose();

        // upload uniforms
        gl.uniformMatrix4fv(u_MvpMatrix,   false, mvpMatrix.elements);
        gl.uniformMatrix4fv(u_NormalMatrix,false, normalMatrix.elements);
        gl.uniform3f(u_LightPos,   5,5,5);
        gl.uniform3f(u_ViewPos,    camera.pos[0], camera.pos[1], camera.pos[2]);
        gl.uniform1f(u_Ka,         0.2);
        gl.uniform1f(u_Kd,         0.7);
        gl.uniform1f(u_Ks,         0.5);
        gl.uniform1f(u_Shininess,  32);
        gl.uniform3f(u_Color,      1,1,1);

        gl.drawArrays(gl.TRIANGLES, 0, numVertices);

        requestAnimationFrame(tick);
      })();
    })
    .catch(e => console.error('OBJ load error:', e));
}

window.onload = main;