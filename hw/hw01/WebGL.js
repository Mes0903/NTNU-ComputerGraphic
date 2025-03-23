// Vertex shader: now uses attributes for both position and color.
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  varying vec4 v_Color;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = 5.0;
    v_Color = a_Color;
  }
`;

// Fragment shader: outputs the per-vertex color.
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }
`;

// Global shape and color flags.
var shapeFlag = 'p'; // shapes: 'p', 'h', 'v', 't', 'q', 'c'
var colorFlag = 'r'; // colors: 'r', 'g', 'b'

// For each shape type we store an array of shapes.
// Each shape is represented by a flat array of numbers. Each vertex has 6 numbers: 
// (x, y, r, g, b, a).
var g_points      = []; // for points (1 vertex each)
var g_horiLines   = []; // for horizontal lines (2 vertices each)
var g_vertiLines  = []; // for vertical lines (2 vertices each)
var g_triangles   = []; // for triangles (3 vertices each)
var g_squares     = []; // for squares (drawn as 2 triangles, 6 vertices each)
var g_circles     = []; // for circles (approximated with triangles)

// We'll create a separate buffer for each type.
var bufferPoints, bufferHoriLines, bufferVertiLines, bufferTriangles, bufferSquares, bufferCircles;

// Helper function to convert colorFlag to RGBA values.
function getColorFromFlag() {
  switch(colorFlag) {
    case 'r': return [1.0, 0.0, 0.0, 1.0];
    case 'g': return [0.0, 1.0, 0.0, 1.0];
    case 'b': return [0.0, 0.0, 1.0, 1.0];
    default: return [1.0, 1.0, 1.0, 1.0];
  }
}

// Helper function to convert mouse event coordinates to normalized device coordinates.
function getNDCCoordinates(ev, canvas) {
  var rect = canvas.getBoundingClientRect();
  var x = ev.clientX - rect.left;
  var y = ev.clientY - rect.top;
  var ndcX = (x - canvas.width / 2) / (canvas.width / 2);
  var ndcY = (canvas.height / 2 - y) / (canvas.height / 2);
  return [ndcX, ndcY];
}

function main(){
  // Get canvas and WebGL context.
  var canvas = document.getElementById('webgl');
  var gl = canvas.getContext('webgl2');
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Compile shaders and link the program.
  var renderProgram = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  gl.useProgram(renderProgram);

  // Get attribute locations.
  renderProgram.a_Position = gl.getAttribLocation(renderProgram, 'a_Position');
  renderProgram.a_Color = gl.getAttribLocation(renderProgram, 'a_Color');

  // Create buffers for each shape type.
  bufferPoints     = gl.createBuffer();
  bufferHoriLines  = gl.createBuffer();
  bufferVertiLines = gl.createBuffer();
  bufferTriangles  = gl.createBuffer();
  bufferSquares    = gl.createBuffer();
  bufferCircles    = gl.createBuffer();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Set up event handlers.
  canvas.onmousedown = function(ev){ click(ev, gl, canvas, renderProgram); };
  document.onkeydown = function(ev){ keydown(ev); };

  // Start the animation loop.
  function tick() {
    draw(gl, renderProgram);
    requestAnimationFrame(tick);
  }
  tick();
}

function keydown(ev){ 
  // Change the current color or shape based on key pressed.
  switch(ev.key) {
    case 'r': colorFlag = 'r'; break;
    case 'g': colorFlag = 'g'; break;
    case 'b': colorFlag = 'b'; break;
    case 'p': shapeFlag = 'p'; break;
    case 'h': shapeFlag = 'h'; break;
    case 'v': shapeFlag = 'v'; break;
    case 't': shapeFlag = 't'; break;
    case 'q': shapeFlag = 'q'; break;
    case 'c': shapeFlag = 'c'; break;
    default:
      console.log('non support key');
      break;
  }
}

function click(ev, gl, canvas, program){ 
  // Call the appropriate handler based on the current shape flag.
  switch(shapeFlag) {
    case 'p':
      handlePoint(ev, canvas);
      break;
    case 'h':
      handleHorizontalLine(ev, canvas);
      break;
    case 'v':
      handleVerticalLine(ev, canvas);
      break;
    case 't':
      handleTriangle(ev, canvas);
      break;
    case 'q':
      handleSquare(ev, canvas);
      break;
    case 'c':
      handleCircle(ev, canvas);
      break;
    default:
      console.log('non support key');
      break;
  }
}

function handlePoint(ev, canvas) {
  var [x, y] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  var vertex = [x, y, color[0], color[1], color[2], color[3]];
  g_points.push(vertex);
  if(g_points.length > 5) {
    g_points.shift();
  }
}

function handleHorizontalLine(ev, canvas) {
  var [_, y] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  // Horizontal line crosses the whole canvas: from x=-1 to x=1.
  var left = [-1, y];
  var right = [1, y];
  var vertices = left.concat(color, right.concat(color));
  g_horiLines.push(vertices);
  if(g_horiLines.length > 5) {
    g_horiLines.shift();
  }
}

function handleVerticalLine(ev, canvas) {
  var [x, _] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  // Vertical line crosses the whole canvas: from y=-1 to y=1.
  var bottom = [x, -1];
  var top = [x, 1];
  var vertices = bottom.concat(color, top.concat(color));
  g_vertiLines.push(vertices);
  if(g_vertiLines.length > 5) {
    g_vertiLines.shift();
  }
}

function handleTriangle(ev, canvas) {
  var [x, y] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  var offset = 0.1;
  // Define a simple triangle: top, bottom-left, bottom-right.
  var top = [x, y + offset];
  var bottomLeft = [x - offset, y - offset];
  var bottomRight = [x + offset, y - offset];
  var vertices = top.concat(color, bottomLeft.concat(color), bottomRight.concat(color));
  g_triangles.push(vertices);
  if(g_triangles.length > 5) {
    g_triangles.shift();
  }
}

function handleSquare(ev, canvas) {
  var [x, y] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  var half = 0.1;
  // Calculate the four corners.
  var bl = [x - half, y - half]; // bottom-left
  var br = [x + half, y - half]; // bottom-right
  var tr = [x + half, y + half]; // top-right
  var tl = [x - half, y + half]; // top-left
  // Two triangles to form a square.
  var vertices = [].concat(
    bl, color,
    br, color,
    tr, color,
    bl, color,
    tr, color,
    tl, color
  );
  g_squares.push(vertices);
  if(g_squares.length > 5) {
    g_squares.shift();
  }
}

function handleCircle(ev, canvas) {
  var [x, y] = getNDCCoordinates(ev, canvas);
  var color = getColorFromFlag();
  var radius = 0.1;
  var segments = 20;
  var vertices = [];
  // Approximate the circle using a triangle fan (each triangle: center, point i, point i+1).
  for (var i = 0; i < segments; i++){
    var theta1 = (i / segments) * 2 * Math.PI;
    var theta2 = ((i + 1) / segments) * 2 * Math.PI;
    var x1 = x + radius * Math.cos(theta1);
    var y1 = y + radius * Math.sin(theta1);
    var x2 = x + radius * Math.cos(theta2);
    var y2 = y + radius * Math.sin(theta2);
    vertices = vertices.concat(
      [x, y], color,       // center
      [x1, y1], color,     // first point on circumference
      [x2, y2], color      // next point on circumference
    );
  }
  g_circles.push(vertices);
  if(g_circles.length > 5) {
    g_circles.shift();
  }
}

// Helper: flatten an array of arrays.
function flatten(arr) {
  return new Float32Array(arr.flat());
}

function draw(gl, program) {
  gl.clear(gl.COLOR_BUFFER_BIT);
  var FSIZE;

  // Draw points (gl.POINTS)
  if(g_points.length > 0) {
    var pts = flatten(g_points);
    FSIZE = pts.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferPoints);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.POINTS, 0, pts.length / 6);
  }

  // Draw horizontal lines (gl.LINES)
  if(g_horiLines.length > 0) {
    var hori = flatten(g_horiLines);
    FSIZE = hori.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferHoriLines);
    gl.bufferData(gl.ARRAY_BUFFER, hori, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.LINES, 0, hori.length / 6);
  }

  // Draw vertical lines (gl.LINES)
  if(g_vertiLines.length > 0) {
    var verti = flatten(g_vertiLines);
    FSIZE = verti.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferVertiLines);
    gl.bufferData(gl.ARRAY_BUFFER, verti, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.LINES, 0, verti.length / 6);
  }

  // Draw triangles (gl.TRIANGLES)
  if(g_triangles.length > 0) {
    var tris = flatten(g_triangles);
    FSIZE = tris.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferTriangles);
    gl.bufferData(gl.ARRAY_BUFFER, tris, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.TRIANGLES, 0, tris.length / 6);
  }

  // Draw squares (gl.TRIANGLES)
  if(g_squares.length > 0) {
    var sq = flatten(g_squares);
    FSIZE = sq.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferSquares);
    gl.bufferData(gl.ARRAY_BUFFER, sq, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.TRIANGLES, 0, sq.length / 6);
  }

  // Draw circles (gl.TRIANGLES)
  if(g_circles.length > 0) {
    var cir = flatten(g_circles);
    FSIZE = cir.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferCircles);
    gl.bufferData(gl.ARRAY_BUFFER, cir, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.a_Position, 2, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(program.a_Position);
    gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, FSIZE * 6, FSIZE * 2);
    gl.enableVertexAttribArray(program.a_Color);
    gl.drawArrays(gl.TRIANGLES, 0, cir.length / 6);
  }
}

// Shader compilation and linking.
function compileShader(gl, vShaderText, fShaderText) {
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  gl.shaderSource(vertexShader, vShaderText);
  gl.compileShader(vertexShader);
  if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.log('vertex shader compile failed');
    var message = gl.getShaderInfoLog(vertexShader);
    console.log(message);
  }
  
  gl.shaderSource(fragmentShader, fShaderText);
  gl.compileShader(fragmentShader);
  if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log('fragment shader compile failed');
    var message = gl.getShaderInfoLog(fragmentShader);
    console.log(message);
  }

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log('program link failed');
    var message = gl.getProgramInfoLog(program);
    console.log(message);
    gl.deleteProgram(program);
  }

  return program;
}
