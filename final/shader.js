const VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec4 a_Normal;
uniform mat4 u_MvpMatrix;
uniform mat4 u_NormalMatrix;
varying vec3 v_Normal;
void main() {
  gl_Position = u_MvpMatrix * a_Position;
  v_Normal = normalize((u_NormalMatrix * a_Normal).xyz);
}`;

const FSHADER_SOURCE = `
precision mediump float;
uniform vec3 u_LightPosition;
uniform vec3 u_ViewPosition;
uniform float u_Ka, u_Kd, u_Ks, u_Shininess;
uniform vec3 u_Color;
varying vec3 v_Normal;
void main() {
  vec3 N = normalize(v_Normal);
  vec3 L = normalize(u_LightPosition);
  float nDotL = max(dot(N, L), 0.0);
  vec3 ambient = u_Ka * u_Color;
  vec3 diffuse = u_Kd * u_Color * nDotL;
  vec3 V = normalize(u_ViewPosition);
  vec3 R = reflect(-L, N);
  float spec = (nDotL>0.0) ? pow(max(dot(R, V),0.0), u_Shininess) : 0.0;
  vec3 specular = u_Ks * spec * vec3(1.0);
  gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
}`;

function compileShader(gl, vShaderText, fShaderText){
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    //compile vertex shader
    gl.compileShader(vertexShader)
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
        console.log('vertex shader ereror');
        var message = gl.getShaderInfoLog(vertexShader); 
        console.log(message);//print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader)
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
        console.log('fragment shader ereror');
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message);//print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }

    return program;
}

// Utility functions (initShaders, createProgram, loadShader, getWebGLContext)
function initShaders(gl, vs, fs) {
  const prog = createProgram(gl, vs, fs);
  if (!prog) return false;
  gl.useProgram(prog);
  gl.program = prog;
  return true;
}

function createProgram(gl, vs, fs) {
  const v = loadShader(gl, gl.VERTEX_SHADER, vs);
  const f = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v||!f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p)); return null;
  }
  return p;
}

function loadShader(gl, t, s) {
  const sh = gl.createShader(t);
  gl.shaderSource(sh, s);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh)); return null;
  }
  return sh;
}

function getWebGLContext(canvas){
  return canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
}