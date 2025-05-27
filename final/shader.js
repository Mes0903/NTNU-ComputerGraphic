// Vertex shader for regular objects with cube mapping support
const VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec4 a_Normal;
attribute vec2 a_TexCoord;
uniform mat4 u_MvpMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;
uniform vec3 u_EyePosition;
varying vec3 v_Normal;
varying vec3 v_Position;
varying vec3 v_Reflect;
varying vec2 v_TexCoord;
void main() {
  gl_Position = u_MvpMatrix * a_Position;
  v_Position = (u_ModelMatrix * a_Position).xyz;
  v_Normal = normalize((u_NormalMatrix * a_Normal).xyz);
  v_TexCoord = a_TexCoord;
  
  // Calculate reflection vector for cube mapping
  vec3 eyeDirection = normalize(v_Position - u_EyePosition);
  v_Reflect = reflect(eyeDirection, v_Normal);
}`;

// Fragment shader for regular objects
const FSHADER_SOURCE = `
precision mediump float;
uniform vec3 u_LightPosition;
uniform vec3 u_ViewPosition;
uniform float u_Ka, u_Kd, u_Ks, u_Shininess;
uniform vec3 u_Color;
uniform sampler2D u_Texture;
uniform samplerCube u_CubeMap;
uniform bool u_UseTexture;
uniform bool u_UseReflection;
uniform float u_ReflectionStrength;
varying vec3 v_Normal;
varying vec3 v_Position;
varying vec3 v_Reflect;
varying vec2 v_TexCoord;

void main() {
  vec3 N = normalize(v_Normal);
  vec3 L = normalize(u_LightPosition - v_Position);
  float nDotL = max(dot(N, L), 0.0);
  
  // Base color from texture or uniform color
  vec3 baseColor = u_Color;
  if (u_UseTexture) {
    baseColor = texture2D(u_Texture, v_TexCoord).rgb;
  }
  
  // Lighting calculations
  vec3 ambient = u_Ka * baseColor;
  vec3 diffuse = u_Kd * baseColor * nDotL;
  
  vec3 V = normalize(u_ViewPosition - v_Position);
  vec3 R = reflect(-L, N);
  float spec = (nDotL > 0.0) ? pow(max(dot(R, V), 0.0), u_Shininess) : 0.0;
  vec3 specular = u_Ks * spec * vec3(1.0);
  
  vec3 finalColor = ambient + diffuse + specular;
  
  // Add reflection if enabled
  if (u_UseReflection) {
    vec3 reflectionColor = textureCube(u_CubeMap, v_Reflect).rgb;
    finalColor = mix(finalColor, reflectionColor, u_ReflectionStrength);
  }
  
  gl_FragColor = vec4(finalColor, 1.0);
}`;

// Vertex shader for skybox
const SKYBOX_VSHADER = `
attribute vec4 a_Position;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjMatrix;
varying vec3 v_TexCoord;
void main() {
  vec4 pos = u_ProjMatrix * u_ViewMatrix * a_Position;
  gl_Position = pos.xyww;  // Set z = w for far plane
  v_TexCoord = a_Position.xyz;
}`;

// Fragment shader for skybox
const SKYBOX_FSHADER = `
precision mediump float;
uniform samplerCube u_CubeMap;
varying vec3 v_TexCoord;
void main() {
  gl_FragColor = textureCube(u_CubeMap, v_TexCoord);
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

// Function to load cube map texture
function loadCubeMap(gl, faces) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceTargets = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X, // +X (right)
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // -X (left)
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // +Y (top)
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // -Y (bottom)
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // +Z (front)
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z  // -Z (back)
  ];

  let loadedImages = 0;
  const totalImages = 6;

  for (let i = 0; i < 6; i++) {
    const image = new Image();
    image.onload = function() {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texImage2D(faceTargets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      
      loadedImages++;
      if (loadedImages === totalImages) {
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    };
    image.src = faces[i];
  }

  return texture;
}

// Function to create skybox geometry (cube)
function createSkyboxGeometry() {
  // Skybox vertices (cube from -1 to 1)
  const vertices = new Float32Array([
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,
    
    // Back face
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0, -1.0, -1.0,
    
    // Top face
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,
    
    // Bottom face
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,
    
    // Right face
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,
    
    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0
  ]);

  const indices = new Uint16Array([
    0,  1,  2,    0,  2,  3,    // front
    4,  5,  6,    4,  6,  7,    // back
    8,  9,  10,   8,  10, 11,   // top
    12, 13, 14,   12, 14, 15,   // bottom
    16, 17, 18,   16, 18, 19,   // right
    20, 21, 22,   20, 22, 23    // left
  ]);

  return { vertices, indices };
}