define([
  '$', 'template', 'Promise', 'ace/ace', 'json!/slides.json'
], function(
  $, template, Promise, ace, slidesById
){

  var mapNode = null;
  var tileSize = 50, 
      worldSize = { width: 8, height: 18 },
      slidesByCoords = {};
  var currentSlide = null;
  var currentTool = "editdetail";
  
  function nextId(){
    return 'slide_' + (++nextId.count);
  }
  nextId.count = 0;
  
  var mixin = function(o1){
    var args = Array.prototype.slice.call(arguments, 1);
    args.forEach(function(o){
      for(var i in o){
        o1[i] = o[i];
      }
    });
    return o1;
  };

  function trim(text){
    return text.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function nodeById(id){
    var node; 
    if('string' == typeof id){
      id = id.replace(/^#/,'');
      node = document.getElementById(id);
    } else node = id; 
    return node;
  }
  
  var editor = {
    slidePrototype: {
      "body": "",
      "id": "",
      "classes": "",
      "title": "",
      "x": "",
      "y": ""
    },
    fields: {}
  };

  editor.drawSlidesMap = function(canvasNode){
    Object.keys(slidesById).forEach(function(id, idx){
      var slide = slidesById[id];
      var slideNo = 1+idx;
      var x = slide.x * tileSize, 
          y = slide.y * tileSize;
      var ctx = canvasNode.getContext('2d'); 
      
      ctx.fillStyle = 'rgba(0,153,0,0.95)';
      console.log("Drawing tile at: ", tileSize*slide.x+1, tileSize*slide.y+1);
      ctx.fillRect(tileSize*slide.x+1, tileSize*slide.y+1, tileSize-2, tileSize-2);

      ctx.fillStyle = 'rgba(51,51,51,0.5)';
      ctx.fillRect(tileSize*slide.x, tileSize*slide.y, 24, 12);
      ctx.fillStyle = "#ffc";
      ctx.textBaseline = 'top';
      ctx.font = 'normal 9px sans-serif';
      ctx.fillText( slideNo, tileSize*slide.x+1, tileSize*slide.y+1 );
    });
  };
  
  function saveSlide(slide) {
    // Persist a slide
    var url = '/slides/'+slide.id+'.json';
    slidesById[slide.id] = slide;
    var savePromise = new Promise();
    $.ajax({
      type: 'PUT',
      dataType: 'json',
      contentType: 'application/json',
      url: url,
      data: JSON.stringify(slide),
      success: function(resp){
        console.log("save response: ", resp);
        savePromise.resolve(resp.status);
      }, 
      error: function(xhr){ 
        console.warn("error saving: " + url, xhr.status);
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
  
  editor.initSlideEditor = function(){
    var aceEdit = editor.aceEditor = ace.edit('body_editor');
    aceEdit.getSession().on('change', function(evt){
      $('#body_text').val( aceEdit.getSession().getValue() );
    });
  };
  
  editor.editDetail = function(slide){
    console.log("editDetail: ", slide);
    var aceEditor = editor.aceEditor; 
    
    showDetail();
    
    var tmpl= template( $('#detail-template')[0].innerHTML );
    var $detailContainer = $('#detail'), 
        $detail = $('#detailContent');
    
    var defaults = {
      id: nextId()
    };
    
    slide = mixin(defaults, slide);
    console.log("Slide: ", slide);
    $detail.html( tmpl( slide ) );

    editor.aceEditor.getSession().setValue(slide.body);
  };
  
  editor.setupSlideSequence = function(listNode){
    $list = $(listNode);
      
    var slides = [];
    Object.keys(slidesById).forEach(function(id, idx){
      slides.push(slidesById[id]);
    });
    slides.sort(function(a,b){
      if(a.y == b.y) {
        return a.x - b.x;
      } else {
        return a.y - b.y;
      }
    });
    
    slides.forEach(function(slide, idx) {
        var slideNo = 1+idx;
        $('<li>' + slideNo + ': ' + slide.title + '</li>')
          .appendTo($list);
    });
  };
  
  editor.layoutEditorInit = function(){
    console.log("layoutEditorInit");
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

      editor.toolAction(x, y, currentTool);
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
          xy = x+','+y;
      var slide = slidesByCoords[xy] || { x: x, y: y, title: "Untitled", body: "--No content--" };
      
      $("#tooltip").css({
        top: event.clientY+10, 
        left: event.clientX+10 
      }).html( x+'/'+y + ": " + slide.title );
    });
    
    $("#detail").delegate(".savebtn", "click", function() {
      
      var formNode = $('#detail'); 
      var id = $('#id_value', formNode).val() || $('#title_text', formNode).val().toLowerCase().replace(/\W+/g, '-');
      var slide = slidesById[id] || {};
      
      $('input[name], textarea[name]', formNode).each(function(idx, node){
          slide[node.name] = $(node).val();
      });
      saveSlide(slide).then(function(resp){
        console.log("save success: ", resp);
        alert("great, that went well");
        hideDetail();
        refresh();
      }, function(err){
        console.log("save error: ", err);
        alert("ugh, failed to save");
      });
      
      console.log("slide content: ", slide);
    });
    $("#detail").delegate(".cancelbtn", "click", function() {
      cancelDetailEdit();
    });
  };

  var refresh = editor.refresh = function(){
    window.slidesByCoords = slidesByCoords; // just for debug
    Object.keys(slidesById).forEach(function(id){
      var slide = slidesById[id], 
          xy = [slide.x, slide.y].join(',');
      slidesByCoords[xy] = slide;
      slidesByCoords[xy].id = id;
    });
    editor.drawSlidesMap( $('#grid')[0] );
    editor.setupSlideSequence( $('#slidelist') );
  };
  
  function init(){
    editor.layoutEditorInit();
    editor.initSlideEditor();
    editor.refresh();
  }

  editor.toolAction = function(x, y, currentTool){
    var xy = [x, y].join(','), 
        slide = slidesByCoords[xy] || { x: x, y: y, title: "Untitled", body: "--No content--" };
        
    switch(currentTool){
      case "editdetail": 
        editor.editDetail(slide);
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
  };
  
  $(window).load(function(){

    init();
  });
  return editor;
});