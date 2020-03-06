# Welcome to Get Offline Maps tiles

This application will download maps as tiles with TMS tile support

### Installation

```
$ npm install get-offline-maps
```

### Usage

copy below code inside `index.js`
```
var gom = require('get-offline-maps');
var getAccessUrl = "blah";
var outputDir = "blah";
var port = "3127";
gom.getOfflineMaps(getAccessUrl,outputDir,port);
```

Preview at browser
```
http://localhost:3127/index.html
```

### Note:
1) the downloaded tile will be at png
2) at getAccessUrl exclude /z/x/y and pass rest of url prefix
