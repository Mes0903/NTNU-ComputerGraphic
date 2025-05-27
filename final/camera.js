class Camera {
  constructor(canvas) {
    this.pos    = [0.0, 1.6,  3.0];
    this.yaw    = -90.0;             // looking toward -Z
    this.pitch  =   0.0;
    this.front  = [0.0, 0.0, -1.0];
    this.up     = [0.0, 1.0,  0.0];

    this.firstMouse = true;
    this.lastX = 0;
    this.lastY = 0;
    this.canvas = canvas;

    this.view = new Matrix4();
    this.proj = new Matrix4();
  }

  deg2rad(d) { return d * Math.PI / 180; }

  processKeyboard(dt, keys) {
    // compute right = normalize(cross(front, up))
    const [fx, fy, fz] = this.front;
    const [ux, uy, uz] = this.up;
    let rx = fy * uz - fz * uy;
    let ry = fz * ux - fx * uz;
    let rz = fx * uy - fy * ux;
    const rlen = Math.hypot(rx, ry, rz);
    const right = rlen > 0 ? [rx/rlen, ry/rlen, rz/rlen] : [1,0,0];

    const speed = 2.5 * dt;
    if (keys['KeyW']) {
      this.pos[0] += fx * speed;
      this.pos[1] += fy * speed;
      this.pos[2] += fz * speed;
    }
    if (keys['KeyS']) {
      this.pos[0] -= fx * speed;
      this.pos[1] -= fy * speed;
      this.pos[2] -= fz * speed;
    }
    if (keys['KeyA']) {
      this.pos[0] -= right[0] * speed;
      this.pos[1] -= right[1] * speed;
      this.pos[2] -= right[2] * speed;
    }
    if (keys['KeyD']) {
      this.pos[0] += right[0] * speed;
      this.pos[1] += right[1] * speed;
      this.pos[2] += right[2] * speed;
    }
  }

  processMouseDelta(dx, dy) {
    const sensitivity = 0.1;       // tweak to taste
    this.yaw   += dx * sensitivity;
    this.pitch -= dy * sensitivity;

    // clamp pitch to avoid flip
    if (this.pitch >  89.0) this.pitch =  89.0;
    if (this.pitch < -89.0) this.pitch = -89.0;

    // recalc front vector from spherical angles
    const pr = this.deg2rad(this.pitch);
    const yr = this.deg2rad(this.yaw);
    const cy = Math.cos(yr), sy = Math.sin(yr);
    const cp = Math.cos(pr), sp = Math.sin(pr);

    // forward = [cos(p)*cos(y), sin(p), cos(p)*sin(y)]
    this.front[0] = cp * cy;
    this.front[1] = sp;
    this.front[2] = cp * sy;

    // normalize (just in case)
    const len = Math.hypot(this.front[0], this.front[1], this.front[2]);
    this.front[0] /= len;
    this.front[1] /= len;
    this.front[2] /= len;
  }

  processMouse(xpos, ypos) {
    if (this.firstMouse) {
      this.lastX = xpos;
      this.lastY = ypos;
      this.firstMouse = false;
      return;
    }
    let dx = xpos - this.lastX;
    let dy = this.lastY - ypos;  // inverted Y
    this.lastX = xpos;
    this.lastY = ypos;

    const sensitivity = 0.1;
    this.yaw   += dx * sensitivity;
    this.pitch += dy * sensitivity;

    // clamp pitch
    if (this.pitch > 89.0)  this.pitch = 89.0;
    if (this.pitch < -89.0) this.pitch = -89.0;

    // update front vector
    const pr = this.deg2rad(this.pitch);
    const yr = this.deg2rad(this.yaw);
    const y   = Math.sin(pr);
    const xp  = Math.cos(pr);
    const fx  = xp * Math.cos(yr);
    const fz  = xp * Math.sin(yr);
    const fl  = Math.hypot(fx, y, fz);
    this.front = [fx/fl, y/fl, fz/fl];
  }

  updateMatrices() {
    // view
    const tx = this.pos[0] + this.front[0];
    const ty = this.pos[1] + this.front[1];
    const tz = this.pos[2] + this.front[2];
    this.view.setLookAt(
      this.pos[0], this.pos[1], this.pos[2],
      tx,          ty,          tz,
      this.up[0],  this.up[1],  this.up[2]
    );
    // projection
    const aspect = this.canvas.width / this.canvas.height;
    this.proj.setPerspective(45, aspect, 0.1, 100.0);
  }
}