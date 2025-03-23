//This tempalte is just for your reference
//You do not have to follow this template 
//You are very welcome to write your program from scratch

//shader
var VSHADER_SOURCE = `

    `;

var FSHADER_SOURCE = `

    `;



var shapeFlag = 'p'; //p: point, h: hori line: v: verti line, t: triangle, q: square, c: circle
var colorFlag = 'r'; //r g b 
var g_points = [];
var g_horiLines = [];
var g_vertiLines = [];
var g_triangles = [];
var g_squares = [];
var g_circles = [];
//var ... of course you may need more variables


function main(){
    //////Get the canvas context
    var canvas = document.getElementById('webgl');
    //var gl = canvas.getContext('webgl') || canvas.getContext('exprimental-webgl') ;
    var gl = canvas.getContext('webgl2');
    if(!gl){
        console.log('Failed to get the rendering context for WebGL');
        return ;
    }

    // compile shader and use program

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // mouse and key event...
    canvas.onmousedown = function(ev){click(ev)};
    document.onkeydown = function(ev){keydown(ev)};
}



function keydown(ev){ //you may want to define more arguments for this function
    //implment keydown event here

    if(ev.key == 'r'){ //an example for user press 'r'... 
        //......  
    }
}

function click(ev){ //you may want to define more arguments for this function
    //mouse click: recall our quiz1 in calss
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();

    x = ((x - rect.left) - canvas.height/2)/(canvas.height/2)
    y = (canvas.width/2 - (y - rect.top))/(canvas.height/2)

    //you might want to do something here

    //self-define draw() function
    //I suggest that you can clear the canvas
    //and redraw whole frame(canvas) after any mouse click
    draw();
}


function draw(){ //you may want to define more arguments for this function
    //redraw whole canvas here
    //Note: you are only allowed to same shapes of this frame by single gl.drawArrays() call
}
