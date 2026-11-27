(function(){
  var KEY_POLLS='quickpoll:polls', KEY_VOTES='quickpoll:myvotes';
  var polls=[], myVotes={};

  function load(){
    try{polls=JSON.parse(localStorage.getItem(KEY_POLLS))||[];}catch(e){polls=[];}
    try{myVotes=JSON.parse(localStorage.getItem(KEY_VOTES))||{};}catch(e){myVotes={};}
    if(!polls.length){
      polls=[{id:'p1',q:'Which front-end language do you use most?',opts:[
        {t:'JavaScript',v:12},{t:'TypeScript',v:9},{t:'Python (backend)',v:4}]}];
    }
  }
  function save(){
    try{localStorage.setItem(KEY_POLLS,JSON.stringify(polls));localStorage.setItem(KEY_VOTES,JSON.stringify(myVotes));}catch(e){}
  }
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  // ---- Create form ----
  var optsEl=document.getElementById('opts'), errEl=document.getElementById('err');
  function addOptInput(val){
    var n=optsEl.children.length+1;
    var w=document.createElement('div');w.className='opt';
    w.innerHTML='<input type="text" maxlength="80" placeholder="Option '+n+'" aria-label="Option '+n+'"><button class="ghost" title="Remove" aria-label="Remove option">✕</button>';
    w.querySelector('input').value=val||'';
    w.querySelector('button').onclick=function(){if(optsEl.children.length>2){w.remove();}};
    optsEl.appendChild(w);
  }
  addOptInput();addOptInput();
  document.getElementById('addOpt').onclick=function(){if(optsEl.children.length<8)addOptInput();};
  document.getElementById('create').onclick=function(){
    var q=document.getElementById('q').value.trim();
    var vals=[].map.call(optsEl.querySelectorAll('input'),function(i){return i.value.trim();}).filter(Boolean);
    var uniq=vals.filter(function(v,i){return vals.indexOf(v)===i;});
    if(!q){errEl.textContent='Please enter a question.';return;}
    if(uniq.length<2){errEl.textContent='Add at least two different options.';return;}
    errEl.textContent='';
    polls.unshift({id:'p'+Date.now(),q:q,opts:uniq.map(function(t){return{t:t,v:0};})});
    save();
    document.getElementById('q').value='';optsEl.innerHTML='';addOptInput();addOptInput();
    render();
  };

  // ---- Render polls ----
  function render(){
    renderCharts();
    var el=document.getElementById('polls');
    if(!polls.length){el.innerHTML='<div class="empty">No polls yet. Create the first one above!</div>';return;}
    el.innerHTML=polls.map(function(p){
      var total=p.opts.reduce(function(s,o){return s+o.v;},0);
      var voted=myVotes[p.id]!==undefined;
      var body=p.opts.map(function(o,i){
        if(!voted){return '<button class="choice" data-p="'+p.id+'" data-i="'+i+'">'+esc(o.t)+'</button>';}
        var pct=total?Math.round(o.v/total*100):0;
        return '<div class="res'+(myVotes[p.id]===i?' mine':'')+'"><div class="fill" style="width:'+pct+'%"></div><span>'+esc(o.t)+(myVotes[p.id]===i?' ✓':'')+'</span><span>'+pct+'% · '+o.v+'</span></div>';
      }).join('');
      return '<div class="card"><div class="poll-head"><p class="poll-q">'+esc(p.q)+'</p><div><button class="ghost" data-sim="'+p.id+'" title="Simulate another person voting">+ Simulate voter</button><button class="ghost danger" data-del="'+p.id+'" title="Delete poll">Delete</button></div></div>'+body+
        '<div class="meta">'+total+' vote'+(total===1?'':'s')+(voted?' · <button class="ghost" data-undo="'+p.id+'">Change vote</button>':' · Pick an option to see results')+'</div></div>';
    }).join('');
  }

  document.getElementById('polls').addEventListener('click',function(e){
    var t=e.target;
    if(t.dataset.p){
      var p=polls.find(function(x){return x.id===t.dataset.p;});
      var i=+t.dataset.i;
      if(p&&myVotes[p.id]===undefined){p.opts[i].v++;myVotes[p.id]=i;save();render();}
    }else if(t.dataset.undo){
      var q=polls.find(function(x){return x.id===t.dataset.undo;});
      if(q&&myVotes[q.id]!==undefined){q.opts[myVotes[q.id]].v=Math.max(0,q.opts[myVotes[q.id]].v-1);delete myVotes[q.id];save();render();}
    }else if(t.dataset.sim){simVote(t.dataset.sim);}else if(t.dataset.del){
      if(confirm('Delete this poll?')){polls=polls.filter(function(x){return x.id!==t.dataset.del;});delete myVotes[t.dataset.del];save();render();}
    }
  });

  // ---- Bar graph of all results ----
  function chartSvg(p){
    var W=600,H=240,L=36,R=10,T=22,B=44,n=p.opts.length;
    var max=Math.max.apply(null,p.opts.map(function(o){return o.v;}));
    var step=Math.ceil(max/4)||1, top=step*4;
    var ph=H-T-B, pw=W-L-R, slot=pw/n, bw=Math.min(56,slot*0.6);
    var total=p.opts.reduce(function(s,o){return s+o.v;},0);
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Bar graph for '+esc(p.q)+'">';
    for(var k=0;k<=4;k++){
      var y=T+ph-(k/4)*ph;
      s+='<line class="g" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text class="t" x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+(k*step)+'</text>';
    }
    p.opts.forEach(function(o,i){
      var h=(o.v/top)*ph, x=L+slot*i+(slot-bw)/2, y=T+ph-h;
      var lbl=o.t.length>11?o.t.slice(0,10)+'…':o.t;
      s+='<rect class="b" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="4"><title>'+esc(o.t)+': '+o.v+'</title></rect>';
      s+='<text class="v" x="'+(x+bw/2)+'" y="'+(y-5)+'" text-anchor="middle">'+o.v+'</text>';
      s+='<text class="t" x="'+(x+bw/2)+'" y="'+(H-B+16)+'" text-anchor="middle">'+esc(lbl)+'</text>';
    });
    return '<div class="chart"><h3>'+esc(p.q)+' <span style="color:var(--muted);font-weight:400">· '+total+' vote'+(total===1?'':'s')+'</span></h3>'+s+'</svg></div>';
  }
  function renderCharts(){
    var c=document.getElementById('charts');
    c.innerHTML=polls.length?'<div class="card"><h2>Results graph (all polls)</h2>'+polls.map(chartSvg).join('')+'</div>':'';
  }

  // ---- Simulated voters ----
  var guestN=1, timer=null, logLines=[];
  function simVote(pid){
    var p=polls.find(function(x){return x.id===pid;});
    if(!p)return;
    // slight bias toward currently popular options, like real crowds
    var w=p.opts.map(function(o){return o.v+1;}), sum=w.reduce(function(a,b){return a+b;},0), r=Math.random()*sum, i=0;
    while(i<w.length-1&&r>=w[i]){r-=w[i];i++;}
    p.opts[i].v++;
    guestN++;
    logLines.unshift('Guest '+guestN+' voted “'+p.opts[i].t+'” in “'+(p.q.length>40?p.q.slice(0,40)+'…':p.q)+'”');
    logLines=logLines.slice(0,4);
    document.getElementById('log').innerHTML=logLines.map(function(l){return '<div>'+esc(l)+'</div>';}).join('');
    save();render();
  }
  function simRandom(){
    if(!polls.length)return;
    simVote(polls[Math.floor(Math.random()*polls.length)].id);
  }
  var autoBtn=document.getElementById('auto');
  autoBtn.onclick=function(){
    if(timer){clearInterval(timer);timer=null;autoBtn.classList.remove('on');autoBtn.textContent='▶ Auto-simulate other voters';}
    else{timer=setInterval(simRandom,1500);autoBtn.classList.add('on');autoBtn.textContent='⏸ Stop simulating';}
  };
  document.getElementById('burst').onclick=function(){for(var k=0;k<10;k++)simRandom();};

  load();render();
})();
