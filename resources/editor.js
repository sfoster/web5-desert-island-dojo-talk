define([
  '$', 'template', 'Promise', 'json!/slides.json'
], function(
  $, template, Promise, slidesById
){

  var mapNode = null;
  var tileSize = 50, 
      worldSize = { width: 8, height: 8},
      slidesByCoords = {};
  var currentSlide = null;
  var currentTool = "editdetail";
  
  window.slidesByCoords = slidesByCoords;
  
  var mixin = function(o1){
    var args = Array.prototype.slice.call(arguments, 1);
    args.forEach(function(o){
      for(var i in o){
        o1[i] = o[i];
      }
    });
    return o1;
  };

  Object.keys(slidesById).forEach(function(id){
    var slide = slidesById[id], 
        xy = [slide.x, slide.y].join(',');
    slidesByCoords[xy] = slide;
    slidesByCoords[xy].id = id;
  });
  
  function drawSlidesMap(canvasNode){
    Object.keys(slidesById).forEach(function(id, idx){
      var slide = slidesById[id];
      var slideNo = 1+idx;
      var x = slide.x * tileSize, 
          y = slide.y * tileSize;
      var ctx = canvasNode.getContext('2d'); 
      
      ctx.fillStyle = 'rgba(248,248,248,0.95)';
      console.log("Drawing tile at: ", tileSize*slide.x+1, tileSize*slide.y+1);
      ctx.fillRect(tileSize*slide.x+1, tileSize*slide.y+1, tileSize-2, tileSize-2);

      ctx.fillStyle = 'rgba(51,51,51,0.5)';
      ctx.fillRect(tileSize*slide.x, tileSize*slide.y, 24, 12);
      ctx.fillStyle = "#ffc";
      ctx.textBaseline = 'top';
      ctx.font = 'normal 9px sans-serif';
      ctx.fillText( slideNo, tileSize*slide.x+1, tileSize*slide.y+1 );
    });
  }
  
  function save() {
    // Persist the current slides object

    var savePromise = new Promise();
    $.ajax({
      type: 'PUT',
      dataType: 'json',
      contentType: 'application/json',
      url: '/slides.json',
      data: JSON.stringify(slidesById),
      success: function(resp){
        console.log("save response: ", resp);
        alert("slide.json saved: "+ resp.status);
        savePromise.resolve(resp.status);
      }, 
      error: function(xhr){ 
        console.warn("error saving slides.json: ", xhr.status);
        alert("Unable to save slides right now"); 
        savePromise.reject(xhr.status);
      }
    });
    return savePromise;
  }

  function showDetail(){
    $("#map, #maptoolbar").addClass("hidden");
    $("#detail, #detailtoolbar").removeClass("hidden");
  }
  
  function hideDetail(){
    $("#detail, #detailtoolbar").addClass("hidden");
    $("#map, maptoolbar").removeClass("hidden");
  }

  function cancelDetailEdit(){
    hideDetail();
    $('#detailContent').html("");
    currentSlide = null;
  }
  

  function editDetail(slide){
    console.log("editDetail: ", slide);

    showDetail();
    
    var tmpl= template( $('#detail-template')[0].innerHTML );
    var $detailContainer = $('#detail'), 
        $detail = $('#detailContent');
    
    var defaults = {};
    console.log("defaults: ", defaults);
    
    // if(slide.body.match(/^--/)){
    //   delete slide.body;
    // }

    slide = mixin(defaults, slide);
    console.log("Slide: ", slide);
    $detail.html( tmpl( slide ) );
  }
  
  function listUpdate(){
    $list = $('#slidelist');
    $list.delegate('li', 'dragstart', function(e){
      console.log("drag start: ", e.currentTarget.innerHTML);
    });
    Object.keys(slidesById).forEach(function(id, idx){
      var slide = slidesById[id];
      var slideNo = 1+idx;
      $list.append('<li draggable="true">' + slideNo + ': ' + slide.title + '</li>');
    });
  }
  
  function editorInit(){
    console.log("editorInit");
    $('#gridOverlay, #map').css({
      width: worldSize.width*tileSize,
      height: worldSize.height*tileSize,
      outline: "1px dotted #666"
    });
    mapNode = $('#grid')[0];
    mapNode.width = worldSize.width*tileSize;
    mapNode.height = worldSize.height*tileSize;
    console.log("Set height to ", mapNode.height);
    
    var scrollContainerNode = $('#main')[0],
        mapOffsets = $('#map').offset();
        
    $('#gridOverlay').mousedown(function(event){
      console.log("gridOverlay mousedown");
      var scrollOffsets = {
        left: scrollContainerNode.scrollLeft,
        top: scrollContainerNode.scrollTop
      };
      var clickX = event.pageX - mapOffsets.left + scrollOffsets.left,
          clickY = event.pageY - mapOffsets.top + scrollOffsets.top,
          x = Math.floor(clickX / tileSize),
          y = Math.floor(clickY / tileSize);
      console.log("click at: ", x, y, currentTool);
      if(!currentTool) return;

      toolAction(x, y, currentTool);
    });
    $('#gridOverlay')
      .mouseover(function(event){
        $("#tooltip").removeClass("hidden");
      })
      .mouseout(function(event){
        $("#tooltip").addClass("hidden");
      });
      
    $('#gridOverlay').mousemove(function(event){
      var x = Math.floor(event.clientX/tileSize), 
          y = Math.floor(event.clientY/tileSize),
          xy = x+''+y;
      var slide = slidesByCoords[xy] || { x: x, y: y, title: "Untitled", body: "--No content--" };

      $("#tooltip").css({
        top: event.clientY+10, 
        left: event.clientX+10 
      }).html( x+'/'+y + ": " + slide.title );
    });
    
    $("#detail").delegate(".savebtn", "click", function() {
      console.log("savebtn clicked");
      var formNode = $('#detail'); 
      var update = {
        id: $('#id_value', formNode).val(),
        title: $('#title_text', formNode).val(),
        body: $('#body_text', formNode).val()
      };
      console.log("slide content: ", update);
    });
    $("#detail").delegate(".cancelbtn", "click", function() {
      cancelDetailEdit();
    });
  }

  function init(){
    editorInit();
    drawSlidesMap( $('#grid')[0] );
    listUpdate();
  }

  function trim(text){
    return text.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function toolAction(x, y, currentTool){
    var xy = [x, y].join(','), 
        slide = slidesByCoords[xy] || { x: x, y: y, title: "Untitled", body: "--No content--" };
        
    switch(currentTool){
      case "editdetail": 
        editDetail(slide);
        break;
      case "delete": 
        if(confirm("Are you sure you want to delete: " + slide.title)){
          delete slidesByCoords[xy]; 
          if(slide && slide.id){
            delete slidesById[slide.id];
          }
        }
        break;
      default: 
        break;
    }
  }
  function placeTile(x, y, type){
    var tileId = [x,y].join(','), 
        tile = tilesByCoords[tileId];
    if(!tile){
      // create the tile object
      tile = tilesByCoords[tileId] = {
        x: x, y: y
      };
    }
    tile.type = type;
    
    var img = tile.img = terrainTypes[type].img, 
        ctx = mapNode.getContext('2d');

    if(!img) {
      console.log("no image?", tile, img);
    }
    ctx.clearRect(
        tileSize*tile.x,        // dest-x
        tileSize*tile.y,        // dest-y
        tileSize,               // dest-width
        tileSize                // dest-height
    );
    
    if(img && type !== 'clear'){
      ctx.drawImage(
          img,                    // image
          0,                      // source-x
          0,                      // source-y
          tileSize,              // source-width
          tileSize,             // source-height
          tileSize*tile.x,        // dest-x
          tileSize*tile.y,        // dest-y
          tileSize,               // dest-width
          tileSize                // dest-height
      );
    }
  }

  init();
});