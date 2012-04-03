define(function(){
  function Npc(name){
    this.name = name;
  }
  Npc.prototype.render = function(){
    var name = this.name, 
        node = document.createElement('div');
    node.className = 'npc '+name;
    node.title = this.name;
    return node;
  };
  return Npc;
});