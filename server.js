var fs = require("fs"), 
    util = require("util"),
    path = require('path'),
    express = require("express"),
    marked = require("marked");

// limit HTML tags and keep attributes for allowed tags
var allowedTags = 'a|img|p|span|b|strong|em|cite|address|textarea', 
    allowedAttributes = {
        'a':'href',
        'img': 'src',
        '*': 'title|class'
    };

var meta = {
  slideHorizontalOffset: 1200,
  slideVerticalOffset: 800,
  title: "Dojo Desert Island Disks"
};

marked.setOptions({
  gfm: true,
  pedantic: false,
  sanitize: false
});  

// convenience for normal markdown handling
var mdParse = function(mdtext){
  return marked(mdtext);
};
var mixin = function(o1){
  var args = Array.prototype.slice.call(arguments, 1);
  args.forEach(function(o){
    for(var i in o){
      o1[i] = o[i];
    }
  });
  return o1;
};
    
var mustache = require('mustache');
// // configure directory to find mustache templates
// mustache.root = __dirname;

var app = express.createServer();
var root = __dirname;
var port = process.env.SLIDEGEN_PORT || 3000;


app.configure(function(){
    app.use(express.logger({ format: ':method :url' }));
    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(app.router);
});

function values(map){
  var arr = [];
  Object.keys(map).forEach(function(id){
    map[id].id = id;
    arr.push(map[id]);
  });
  return arr;
}

function sortSlides(slides){
  if(slides instanceof Array){
    slides.sort(function(a,b){
      if(a.y == b.y) {
        return a.x - b.x;
      } else {
        return a.y - b.y;
      }
    });
    return slides;
  } else {
    var slideMap = slides; 
    slides = sortSlides( values(slideMap) );
    slideMap = {};
    slides.forEach(function(slide){
      slideMap[slide.id] = slide;
    });
    return slideMap;
  }
}
app.get('/', function(req, res, next){
  
  fs.readFile(root + '/slides.json', function(error, str){
    if(error) {
      console.warn("get /: error reading slides.json: ", error);
      res.end(500, error);
    }
    var fileData = sortSlides(JSON.parse(str)), 
        slides = values(fileData);
    
    var view = mixin(Object.create(meta), {
      slides: slides.map(function(slide){
        slide = Object.create(slide);
        slide.body = mdParse(slide.body);
        slide.x*=meta.slideHorizontalOffset;
        slide.y*=meta.slideVerticalOffset;
        return slide;
      })
    });

    fs.readFile('./slides.tmpl', function(err, tmpl){
      if(error) {
        console.warn("error reading template file: ", err);
        res.end(500, error);
      } else {
        console.log("got template: ", tmpl);
        tmpl = tmpl.toString();
        var responseText = mustache.render(tmpl, view);    
        res.send(responseText);
      }
    });
    
  });
  
});

// GET /slides/{slug}.json
//    return an individual slide object as JSON
app.get('/slides/:slug.json', function(req, res){
  var slugid = req.params.slug;
  fs.readFile(root + '/slides.json', function(error, str){
    if(error) {
      console.warn("error reading slides.json file: ", err);
      res.end(500, error);
    } else {
      var fileData = JSON.parse(str);
      var slide = fileData[slugid];
      if(slide) {
        res.send( JSON.stringify( slide, null, 2) );
      } else {
        res.send(404);
      }
    }
  });
});

// GET /slides/{slug}.markdown
//    return the markdown body content only
app.get('/slides/:slug.markdown', function(req, res){
  var slugid = req.params.slug;
  fs.readFile(root + '/slides.json', function(error, str){
    var fileData = JSON.parse(str);
    var slide = fileData[slugid];
    if(slide) {
      res.send(slide.body);
    } else {
      res.send(404);
    }
  });
});

// GET /slides/{slug}.html
//    return the transformed markdown content only
app.get('/slides/:slug.html', function(req, res){
  var slugid = req.params.slug;
  fs.readFile(root + '/slides.json', function(error, str){
    var fileData = JSON.parse(str);
    var slide = fileData[slugid];
    if(slide) {
      res.send( mdParse(slide.body) ) ;
    } else {
      res.send(404);
    }
  });
});


// GET /slides.json
//    return the contents of slides.json
app.get('/:resource', function(req, res){
  var resourcePath = fs.realpathSync(root + '/' + req.params.resource);
  res.sendfile(resourcePath);
});

// PUT /slides/slugid.json
//  the contents of slides.json with new/updated slide
app.put('/slides/:slug.json', function(req, res){
  var slugid = req.params.slug;
  var resourcePath = fs.realpathSync(root + '/slides.json');
  console.log("got put data: ", typeof req.body, req.body);
  fs.readFile(resourcePath, function(error, str){
    if(error) {
      console.warn("error reading template file: ", err);
      res.end(500, error);
    }

    var fileData = JSON.parse(str);
    fileData[slugid] = 'string' == typeof req.body ? JSON.parse(req.body) : req.body;
    fileData = sortSlides(fileData);

    fs.writeFile(resourcePath, JSON.stringify(fileData, null, 2), function(error){
      if(error) res.end(500, error);
      else {
        console.log(resourcePath + " saved");
        res.send({ status: 'ok', 'message': 'updated '+resourcePath });
      }
    });

  });
});

// POST /slides.json
//    update the contents of slides.json
app.post('/slides.json', function(req, res){
  var resourcePath = fs.realpathSync(root + '/slides.json');
  console.log("got post: ", typeof req.body, req.body);
  var fileData = sortSlides(JSON.parse(req.body));
  fs.writeFile(resourcePath, JSON.stringify(fileData, null, 2), function(err) {
    if(err) {
        console.log(err);
        res.send(500);
    } else {
        res.send({ status: 'ok', 'message': 'updated '+resourcePath });
        console.log(resourcePath + " saved");
    }
  });
});

// GET /slides.json
//    return the contents of slides.json
app.get('/resources/*', function(req, res){
  console.log("static resource request: ", req.url, req.params);
  var resourcePath = root + '/resources/' + req.params[0];
  res.sendfile(resourcePath);
});
app.get('/demos/*', function(req, res){
  console.log("static resource request: ", req.url, req.params);
  var resourcePath = root + '/demos/' + req.params[0];
  res.sendfile(resourcePath);
});

app.listen(port);
console.log("listening on localhost:" + port);
