In this final project, you are going to create a nice-looking scene which includes multiple 3D objects.

Required User Interaction:
• One of the 3D objects is the ”player”. Users can move the player and rotate the player by the mouse and keyboard.
• By default, your camera should move/rotate along with the ”player”. This is so called the first person view angle.
• Allow users to switch between the first person view angle and the third person view angle (by pressing the mouse button or a key). The third person view angle can be just a fixed camera position which can cover most of the region of your scene.

Technical Requirements: 
• 1 point light and implement the local illumination (ambient+difusse+specular and phong shading)
• At least, 1 of the 3D objects with nice texture mapping
• Use an environment cube map to have the environment background
• Cube map reflection or refraction on at least one object (If you implement the dynamic reflection or reflection described in the ”options” section, you automatically satisfy this requirement)
• Make some of your objects keep moving or rotating. This is an example, http://math.hws.edu/graphicsbook/source/webgl/cube-camera.html
• At the bottom of your webpage, write some texts to shortly introduce your work and tell users how to play your work

Pick 2 out of 3:
• shadow
• dynamic reflection
• bump mapping

You are not allowed to use high-level 3D rendering library, such as three.js. You can use the cuon-matrix.js for matrix/vector computation

我有上傳了一個 index.html，裡面有個 canvas，然後我上傳了我之前一個用 cpp 寫的作業，我想用它來改成作業要用的 javascript

專案的架構如下：

```
PS C:\Users\Mes\Documents\MesRepo\NTNU-ComputerGraphic> tree /f .\final\
列出資料夾 PATH
磁碟區序號為 BA15-F03A
C:\USERS\MES\DOCUMENTS\MESREPO\NTNU-COMPUTERGRAPHIC\FINAL
│  index.html
│  NTNU_ComputerGraphics_FinalProject__113_2.pdf
│  README.md
│  cuon-matrix.js
│  
└─assets
    ├─spot
    │      hmap.jpg
    │      README.txt
    │      spot_texture.png
    │      spot_triangulated_good.obj
    │      
    └─Yokohama2
            negx.jpg
            negy.jpg
            negz.jpg
            posx.jpg
            posy.jpg
            posz.jpg
            readme.txt
```

首先讓我們先把 obj 檔案輸出出來看看? 目前我有一個之前寫的 parseOBJ，不知道能不能用：

```
function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      // the spec says there can be multiple filenames here
      // but many exist with spaces in a single filename
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}
```