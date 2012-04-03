define(function(){
  var NodeList = function(nodes){
    this.nodes = nodes;
  };
  NodeList.prototype.append = function(node){
    console.log("append to: ", this.nodes);
    this.nodes[0].appendChild(node);
    return this;
  };
  
  NodeList.prototype.html = function(val){
    var i, res = [], nodes = this.nodes;
    if(arguments.length){
      for(i=0; i<nodes.length; i++){
        nodes[i].innerHTML = val;
      }
      return this;
    } else {
      for(i=0; i<nodes.length; i++){
        res.push(nodes[i].innerHTML);
      }
    }
    return res;
  };
  var dollar = function(sel){
    return new NodeList(document.querySelectorAll(sel));
  };
  return dollar;
});