if(typeof(gom) == 'undefined') gom = {};

gom._getOfflineMaps = function (getAccessUrl,outputDir,port) {
  this.addLibs();
  this.port = port || 3127;
  this.debug = false;
  this.getAccessUrl = getAccessUrl;
  this.outputDir = outputDir;
  if(!this.fs.existsSync(this.outputDir)) {
    console.log("directory fix not proper");
    return false;
  }
  this.init();
}

gom._getOfflineMaps.prototype.addLibs = function () {
  this.http = require('http');
  this.fs = require('fs');
  this.url = require("url");
  this.path = require("path");
}

gom._getOfflineMaps.prototype.init = function () {
  var http = this.http || require('http');
  var port = this.port || 3127;
  var that = this;
  var requestHandlerWrap = function (request, response) {
    that.requestHandler(request, response);
  };
  this.server = http.createServer(requestHandlerWrap)
  this.server.listen(port, (err) => {
    if (err) {
      return that.debugMsg('something bad happened', err)
    }
    that.debugMsg(`server is listening on ${port}`)
  }).on("connection", function (socket) {
    that.debugMsg("connection is done");
  }).on("error", function (err) {
    that.debugMsg("something bad happended", err);
  });
}

gom._getOfflineMaps.prototype.requestHandler = function (request, response) {
  var that = this;
  switch (request.url) {
    case '/':
      request.url = "index.html";
      this.renderFiles(request, response);
      break;
    case '/getAccessUrl':
      var res = {
        accessKey:that.getAccessUrl
      };
      that.printResponse(response,res);
      break;
    case '/getTileSet':
      var gtn = require("get-tile-number");
      var dataChunck = "";
      request.on("data", function (chunk) {
        dataChunck += chunk.toString('utf8');
      }).on("end", function () {
        var data = JSON.parse(dataChunck);
        console.log(data);
        var zoomLvl = [];
        var tileList = {};
        if(process.argv.length > 1) {
          process.argv.push(data['bbox']);
          var g = new gtn._tileUtilUsage();
          var opts = {noPrint:true,ll:data['bbox']};
          var tiles = g.handleLatLonStr(opts);
          //console.log(tiles);
          if(tiles && tiles['z']) {
            for(var i in tiles['z']) {
              if('xy' in tiles['z'][i]) {}
              else {
                if('tile' in tiles['z'][i]) {
                  var xy = tiles['z'][i]['tile'].split('/');
                  tiles['z'][i]['xy'] = {x:xy[1],y:xy[2]};
                }
              }
            }
            tileList = tiles['z'];
            //console.log(tiles['z']['12']['to']);
            for(var lvl in tiles['z']) {
              zoomLvl.push(lvl);
            }
          }
        }
        var res = {
          "result": true
          ,zoomLvl:zoomLvl
          ,tileList:tileList
        };
        that.printResponse(response,res);
      });
      break;
    case '/storeTile':
      var fx = require("mkdir-recursive");
      var fs = require("fs");
      var res = {
        "result": false
        ,"progress": false
      };
      if(this.storeTileObj) {
        res = {
          data:{zoom:this.storeTileObj.data['zoom'],tileList:this.storeTileObj.data['tileList']}
        };
        if(this.storeTileObj['progress'] && !this.storeTileObj.done) {
          res['progress'] = true;
        } else if(!this.storeTileObj['progress'] && this.storeTileObj.done) {
          res['progress'] = false;
          res['done'] = true;
          res['result'] = 'done';
          delete this.storeTileObj;
        }
        this.printResponse(response,res);
      } else {
        var dataChunck = "";
        request.on("data", function (chunk) {
          dataChunck += chunk.toString('utf8');
        }).on("end", function () {
          var data = JSON.parse(dataChunck);
          console.log(data);
          var res = {
            "result": false
            ,"progress": false
          };
          if(data.zoom && data.tileList) {
            that.storeTileObj = {};
            var zoomVal = data.zoom;
            var tileList = data.tileList;
            console.log('zoom number ',zoomVal);
            console.log('tileList array ',tileList);
            res = {
              "result": false
              ,"progress": false
            };
            var rasterTileFinal = that.outputDir;//"/data/MMIRaster/";
            if(zoomVal in tileList) {
              res = {
                "progress": true
                ,data:{zoom:zoomVal,tileList:tileList}
              };
              that.storeTileObj['data'] = {zoom:zoomVal,tileList:tileList};
              that.storeTileObj['progress'] = true;
              that.storeTileObj['done'] = false;
              var rasterTile = zoomVal+"/";
              var rangeFromX = 0;
              var rangeToX = 0;
              var rangeFromY = 0;
              var rangeToY = 0;
              if(tileList[zoomVal] && tileList[zoomVal]['xy']) {
                rangeFromX = tileList[zoomVal].xy.x;
                rangeFromY = tileList[zoomVal].xy.y;
                rangeToX = tileList[zoomVal].xy.x;
                rangeToY = tileList[zoomVal].xy.y
                if(tileList[zoomVal]['to']) {
                  rangeToX = tileList[zoomVal]['to'].x;
                  rangeToY = tileList[zoomVal]['to'].y
                }
              }
              that.totalTile = 0;
              that.finalTileCount = tileList[zoomVal]['count'];
              //console.log(rangeFromX,rangeToX,rangeFromY,rangeToY);
              //console.log("in done",totalTile, " dfsdf ",tileList[zoomVal]['count']);
              for(var j = rangeFromX; j <= rangeToX; j++) {
                var rasterX = rasterTile + j;
                for(var k = rangeFromY; k <= rangeToY; k++) {
                  var dirT = rasterTileFinal + rasterX;
                  //console.log(dirT);
                  fx.mkdirSync(dirT, 0777);
                  var rasterY = dirT + "/" + k+".png";
                  var requestRasterY = that.getAccessUrl + "/" + rasterX + "/" + k+".png"
                  if(!fs.existsSync(rasterY)) {
                    that.downloadTile(requestRasterY, rasterY, function(){
                      that.totalTile++;
                      if(that.totalTile >= that.finalTileCount) {
                        that.storeTileObj['progress'] = false;
                        that.storeTileObj['done'] = true;
                      }
                      that.debugMsg('done',that.storeTileObj,that.totalTile,that.finalTileCount);
                    });
                  } else {
                    that.totalTile++;
                    if(that.totalTile >= that.finalTileCount) {
                      that.storeTileObj['progress'] = false;
                      that.storeTileObj['done'] = true;
                    }
                    that.debugMsg('already present',that.storeTileObj,that.totalTile,that.finalTileCount);
                  }
                  //that.debugMsg("in done",totalTile, " dfsdf ",tileList[zoomVal]['count']);
                }
              }
              that.printResponse(response,res);
            } else {
              res['result'] = 'error';
              that.printResponse(response,res);
            }
          } else {
            res['result'] = 'error';
            that.printResponse(response,res);
          }
        });
      }
      break;
    default:
      this.renderFiles(request, response);
  }
}

gom._getOfflineMaps.prototype.downloadTile = function(uri, filename, cb) {
  console.log(uri, filename);
  var request = require("request");
  var fs = require("fs");
  const options = {
    url: uri,
    headers: {
      'User-Agent': 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'
    }
  };
  request.head(options, function(err, res, body){
    if(res && res['headers']) {
      if(res.headers['content-type'] == 'image/png') {
        //console.log('content-type:', res.headers['content-type']);
        //console.log('content-length:', res.headers['content-length']);
        request(options).pipe(fs.createWriteStream(filename)).on('close', cb);
      } else {
        if(cb) cb();
      }
    } else {
      if(cb) cb();
    }
  });
}

gom._getOfflineMaps.prototype.renderFiles = function (request, response) {
  var fs = this.fs || require('fs');
  var url = this.url || require("url");
  var urlObj = url.parse(request.url, true);
  this.debugMsg(urlObj);
  var href = urlObj.pathname;
  this.debugMsg("first href " + href);
  if (href.match(/^\/home/)) {} else {
    //href = './' + href;
    var parentDir = __dirname;
    href = parentDir + href;
  }
  this.debugMsg("later href " + href);
  var that = this;
  fs.readFile(href, function (err, data) {
    if (!err) {
      var dotoffset = href.lastIndexOf('.');
      var mimetype = dotoffset == -1 ?
        'text/plain' : {
          '.html': 'text/html',
          '.ico': 'image/x-icon',
          '.jpg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.eot': 'application/vnd.ms-fontobject',
          '.ttf': 'application/octet-stream',
          '.svg': 'image/svg+xml',
          '.woff': 'application/font-woff',
          '.woff2': 'application/font-woff2',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'text/json'
          //,'.pbf' : 'application/xml'
          //,'.php' : 'text/php'
        } [href.substr(dotoffset)];
      that.debugMsg(request.url, mimetype);
      if (mimetype) {
        response.setHeader('Content-type', mimetype);
        response.end(data);
      } else {
        that.debugMsg(href + " mimitype " + mimetype);
        response.writeHead(400, "mimetype undefined");
        response.end();
      }
    } else {
      that.debugMsg(err);
      that.debugMsg('file not found: ' + href);
      response.writeHead(404, "Not Found");
      response.end();
    }
  });
}

gom._getOfflineMaps.prototype.printResponse = function(response,res) {
  var result = res;
  if(typeof(res) == "object") result = JSON.stringify(res);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-type', 'text/json');
  response.end(result);
}

gom._getOfflineMaps.prototype.debugMsg = function () {
  if (this.debug) {
    if (arguments && arguments.length) {
      for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (typeof (arguments[i]) == 'undefined') {
          arg = "undefined";
        }
        if (typeof (arguments[i]) == 'object') {
          arg = JSON.stringify(arguments[i]);
        }
        console.log(arg);
      }
    }
  }
}

exports.getOfflineMaps = function(getAccessUrl,outputDir,port) {
  console.log("Welcome to getOfflineMaps with accessKey is ",getAccessUrl,outputDir,port);
  if(getAccessUrl && outputDir) {
    new gom._getOfflineMaps(getAccessUrl,outputDir,port);
  }
}

//exports.printMsg = function(getAccessUrl) {
//  console.log("This is a message from the demo package",getAccessUrl);
//}
