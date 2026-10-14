/* ═══════════════════════════════════════════════════════════════════
   STUDIO CRÉATIF — script_v2.js
   ═══════════════════════════════════════════════════════════════════ */
var API_KEY    = localStorage.getItem('agnes_api_key') || '';
var API_BASE   = 'https://apihub.agnes-ai.com/v1';
var POLL_BASE  = 'https://apihub.agnes-ai.com';           // ⚠️ FIX bug #1
var MODEL_VID  = 'agnes-video-2.5-flash';
var MODEL_IMG  = 'agnes-image-2.5-flash';

var scenes = [];
var isRunning = false;
var stopFlag = false;
var timerInterval = null;
var timerStart = 0;
var currentSceneNum = 0;
var totalScenes = 0;

/* ─── Helpers ─────────────────────────────────────────────────── */
function $id(id){ return document.getElementById(id); }

function log(msg){
  var el = $id('log'); if(!el) return;
  el.textContent += '\n[' + new Date().toLocaleTimeString('fr-FR') + '] ' + msg;
  el.scrollTop = el.scrollHeight;
}
function toast(msg, type){
  var t = $id('toast'); if(!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (type || 'success') + ' visible';
  setTimeout(function(){ t.classList.remove('visible'); }, 3000);
}
function formatTime(s){
  var m = Math.floor(s/60), sec = s%60;
  return (m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;
}
function startTimer(){
  timerStart = Date.now();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(function(){
    var e = Math.floor((Date.now()-timerStart)/1000);
    var el = $id('timerVal'); if(el) el.textContent = formatTime(e);
  }, 1000);
}
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }

/* ═══════════════════════════════════════════════════════════════════
   ONGLET HISTOIRE — scènes + vidéo
   ═══════════════════════════════════════════════════════════════════ */
function addScene(){
  scenes.push({ id: Date.now() + Math.random(), imageData: null, description: '', status: 'idle', videoUrl: null });
  renderScenes();
}
function removeScene(id){ scenes = scenes.filter(function(s){ return s.id !== id; }); renderScenes(); }
function updateField(id, field, value){
  for (var i=0;i<scenes.length;i++){ if(scenes[i].id===id){ scenes[i][field]=value; break; } }
}
function onImage(id, file){
  if(!file) return;
  var r = new FileReader();
  r.onload = function(e){
    for(var i=0;i<scenes.length;i++){ if(scenes[i].id===id){ scenes[i].imageData=e.target.result; break; } }
    renderScenes();
  };
  r.readAsDataURL(file);
}
function renderScenes(){
  var list = $id('scenesList'); if(!list) return;
  if(!scenes.length){ list.innerHTML='<div class="empty">Aucune scène. Cliquez sur Ajouter.</div>'; updateGenBtn(); return; }
  var html = '';
  for(var i=0;i<scenes.length;i++){
    var s = scenes[i];
    var cls='sc-status', txt='En attente';
    if(s.status==='done'){ cls+=' done'; txt='OK'; }
    else if(s.status==='processing'){ cls+=' processing'; txt='En cours'; }
    else if(s.status==='failed'){ cls+=' failed'; txt='Échec'; }
    html += '<div class="scene"><div class="sc-head"><div class="sc-num">'+(i+1)+'</div><div class="sc-title">Scène '+(i+1)+'</div><div class="'+cls+'">'+txt+'</div>';
    if(scenes.length>1) html += '<button class="sc-rm" data-rm="'+s.id+'">×</button>';
    html += '</div>';
    html += '<div class="fld"><label>Image de départ (optionnel)</label>';
    if(s.imageData) html += '<div class="file-zone"><img src="'+s.imageData+'"><button class="f-rm" data-ci="'+s.id+'">Retirer</button></div>';
    else html += '<label class="file-zone"><input type="file" accept="image/*" data-if="'+s.id+'"><div class="up-t">+ Ajouter une image</div></label>';
    html += '</div>';
    html += '<div class="fld"><label>Description</label><textarea data-f="description" data-s="'+s.id+'">'+(s.description||'')+'</textarea></div>';
    if(s.videoUrl) html += '<div class="sc-vid"><video src="'+s.videoUrl+'" controls></video></div>';
    html += '</div>';
  }
  list.innerHTML = html;
  list.querySelectorAll('[data-rm]').forEach(function(b){ b.onclick=function(){ removeScene(parseFloat(this.getAttribute('data-rm'))); }; });
  list.querySelectorAll('[data-ci]').forEach(function(b){ b.onclick=function(){ var id=parseFloat(this.getAttribute('data-ci')); for(var i=0;i<scenes.length;i++) if(scenes[i].id===id) scenes[i].imageData=null; renderScenes(); }; });
  list.querySelectorAll('input[data-if]').forEach(function(inp){ inp.onchange=function(){ onImage(parseFloat(this.getAttribute('data-if')), this.files[0]); }; });
  list.querySelectorAll('textarea[data-f]').forEach(function(ta){ ta.oninput=function(){ updateField(parseFloat(this.getAttribute('data-s')), this.getAttribute('data-f'), this.value); }; });
  updateGenBtn();
}
function updateGenBtn(){
  var btn = $id('generateBtn'); if(!btn) return;
  btn.disabled = scenes.length === 0 || isRunning;
  btn.textContent = isRunning ? '⏳ Génération...' : (scenes.length === 0 ? 'Ajoutez une scène' : '🎬 Générer ' + scenes.length + ' vidéo' + (scenes.length > 1 ? 's' : ''));
}

/* ─── Vidéo : création + poll ───────────────────────────────────── */
function createVideoJob(scene, duration){
  var body = {
    model: MODEL_VID,
    prompt: scene.description || 'cinematic scene',
    seconds: String(duration),
    mode: 'text',
    size: '720P',
    aspect_ratio: '9:16'
  };
  return fetch(API_BASE + '/videos', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(function(r){
    if(!r.ok) return r.text().then(function(t){ throw new Error('HTTP ' + r.status + ' - ' + t); });
    return r.json();
  })
  .then(function(d){
    var videoId = d.video_id || (d.data && d.data.video_id) || d.id || d.task_id;
    if(!videoId) throw new Error('Réponse inattendue: ' + JSON.stringify(d));
    log('Tâche créée, ID: ' + videoId);
    return videoId;
  });
}
function pollVideoJob(videoId){
  return new Promise(function(resolve, reject){
    var attempts = 0, maxAttempts = 120;
    function check(){
      if(stopFlag) return reject(new Error('Arrêté'));
      if(attempts >= maxAttempts) return reject(new Error('Timeout'));
      attempts++;
      // ⚠️ FIX bug #1 : POLL_BASE sans /v1
      var url = POLL_BASE + '/agnesapi?video_id=' + encodeURIComponent(videoId) + '&model_name=' + encodeURIComponent(MODEL_VID);
      fetch(url, { headers: { 'Authorization': 'Bearer ' + API_KEY } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var status = String(d.status || d.state || 'pending').toLowerCase();
        log('Statut: ' + status);
        if(['completed','complete','succeeded','done','success','finished','ready'].indexOf(status) >= 0){
          var videoUrl = (d.metadata && (d.metadata.url || d.metadata.video_url))
                       || (d.output && (d.output.url || d.output.video_url))
                       || (d.data && (d.data.url || d.data.video_url))
                       || d.url || d.video_url;
          if(!videoUrl) return reject(new Error("Pas d'URL vidéo"));
          resolve(videoUrl);
        } else if(['failed','error','cancelled','canceled','rejected'].indexOf(status) >= 0){
          reject(new Error('Échec: ' + (d.error || d.message || 'Erreur inconnue')));
        } else {
          setTimeout(check, 2000);
        }
      }).catch(function(e){ log('Erreur vérification: ' + e.message); setTimeout(check, 3000); });
    }
    check();
  });
}
async function start(){
  if(isRunning || !scenes.length) return;
  if(!API_KEY){ toast('Entrez une clé API Agnès', 'error'); return; }
  isRunning = true; stopFlag = false; updateGenBtn();
  var stopBtn = $id('stopBtn'); if(stopBtn) stopBtn.style.display = 'block';
  var timerBox = $id('timerBox'); if(timerBox) timerBox.classList.add('visible');
  var duration = ($id('storyDuration') || {}).value || '6';
  totalScenes = scenes.length;
  stopTimer();
  var tv = $id('timerVal'); if(tv) tv.textContent = '00:00';
  var pf = $id('progressFill'); if(pf) pf.style.width = '0%';
  startTimer();
  log('=== Début ===');
  var successCount = 0;
  for(var i=0;i<scenes.length;i++){
    if(stopFlag) break;
    var scene = scenes[i];
    scene.status = 'processing'; currentSceneNum = i + 1; renderScenes();
    try{
      log('Traitement scène ' + currentSceneNum + '...');
      var videoId = await createVideoJob(scene, duration);
      var videoUrl = await pollVideoJob(videoId);
      scene.status = 'done'; scene.videoUrl = videoUrl;
      renderScenes(); renderGallery(); successCount++;
      log('✓ Scène ' + currentSceneNum + ' prête !');
    } catch(e){
      scene.status = 'failed'; renderScenes();
      log('✗ Échec scène ' + currentSceneNum + ': ' + e.message);
    }
    if(pf) pf.style.width = Math.round(((i+1)/totalScenes)*100) + '%';
  }
  isRunning = false; stopTimer(); updateGenBtn();
  if(stopBtn) stopBtn.style.display = 'none';
  log('=== FIN: ' + successCount + '/' + totalScenes + ' vidéo(s) générée(s) ===');
  toast(successCount + '/' + totalScenes + ' vidéo(s) générée(s)', successCount > 0 ? 'success' : 'error');
}
function renderGallery(){
  var g = $id('gallery'); if(!g) return;
  var html = '';
  for(var i=0;i<scenes.length;i++){
    if(scenes[i].status==='done' && scenes[i].videoUrl){
      html += '<div class="g-item"><video src="'+scenes[i].videoUrl+'" controls></video>';
      html += '<div class="g-cap"><span>Scène '+(i+1)+'</span><a href="'+scenes[i].videoUrl+'" target="_blank" download="scene-'+(i+1)+'.mp4">Télécharger</a></div></div>';
    }
  }
  g.innerHTML = html || '<div class="empty">Aucune vidéo</div>';
}

/* ═══════════════════════════════════════════════════════════════════
   ONGLET IMAGES — texte + photos → image
   ═══════════════════════════════════════════════════════════════════ */
var IMG = { refs: [], results: [], ratio: '1:1', running: false };

function imgLog(msg){
  var el = $id('imgLog'); if(!el) return;
  el.textContent += '\n[' + new Date().toLocaleTimeString('fr-FR') + '] ' + msg;
  el.scrollTop = el.scrollHeight;
}
function renderImgThumbs(){
  var host = $id('imgThumbs'); if(!host) return;
  host.innerHTML = IMG.refs.map(function(r){
    return '<div class="tw"><img src="'+r.u+'"><button data-rm="'+r.id+'">✕</button></div>';
  }).join('');
  host.querySelectorAll('[data-rm]').forEach(function(b){
    b.onclick = function(){
      IMG.refs = IMG.refs.filter(function(x){ return x.id !== b.getAttribute('data-rm'); });
      renderImgThumbs();
    };
  });
}
function renderImgResults(){
  var host = $id('imgResults'); if(!host) return;
  if(!IMG.results.length){ host.innerHTML = '<div class="empty">Aucune image pour l\'instant</div>'; return; }
  host.innerHTML = IMG.results.map(function(im, i){
    return '<div class="iw">'+
      '<img src="'+im.u+'" data-zoom="'+i+'" style="cursor:zoom-in">'+
      '<div class="row">'+
        '<button data-dl="'+i+'">⬇</button>'+
        '<button data-ref="'+i+'">+ Réf</button>'+
        '<button data-rm="'+i+'">🗑</button>'+
      '</div></div>';
  }).join('');
  host.querySelectorAll('[data-dl]').forEach(function(b){
    b.onclick = function(){
      var im = IMG.results[+b.getAttribute('data-dl')];
      var a = document.createElement('a'); a.href = im.u; a.download = 'studio-img-'+Date.now()+'.png'; a.click();
    };
  });
  host.querySelectorAll('[data-ref]').forEach(function(b){
    b.onclick = function(){
      if(IMG.refs.length >= 4) return toast('Max 4 photos', 'error');
      var im = IMG.results[+b.getAttribute('data-ref')];
      IMG.refs.push({ id: uidLocal(), u: im.u, d: im.d || im.u });
      renderImgThumbs();
      toast('Ajoutée aux références');
    };
  });
  host.querySelectorAll('[data-rm]').forEach(function(b){
    b.onclick = function(){ IMG.results.splice(+b.getAttribute('data-rm'), 1); renderImgResults(); };
  });
  host.querySelectorAll('[data-zoom]').forEach(function(el){
    el.onclick = function(){
      var lb = $id('lightbox'); if(!lb) return;
      $id('lbImg').src = el.src;
      lb.classList.add('on');
    };
  });
}
function uidLocal(){ return Math.random().toString(36).slice(2,9); }
function readFileAsDataURL(file, maxSide){
  return new Promise(function(res, rej){
    var fr = new FileReader();
    fr.onload = function(){
      var im = new Image();
      im.onload = function(){
        var s = Math.min(1, maxSide / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        var d = c.toDataURL('image/jpeg', 0.85);
        res({ u: d, d: d });
      };
      im.onerror = function(){ rej(new Error('Image illisible')); };
      im.src = fr.result;
    };
    fr.onerror = function(){ rej(new Error('Lecture impossible')); };
    fr.readAsDataURL(file);
  });
}
function initImages(){
  // Format ratio
  document.querySelectorAll('#imgRatioC button').forEach(function(b){
    b.onclick = function(){
      document.querySelectorAll('#imgRatioC button').forEach(function(x){ x.classList.remove('sel'); });
      this.classList.add('sel');
      IMG.ratio = this.getAttribute('data-r');
    };
  });
  // Input fichiers
  var fi = $id('imgFiles');
  if(fi) fi.onchange = async function(e){
    var files = Array.prototype.slice.call(e.target.files).slice(0, 4);
    e.target.value = '';
    for(var i=0;i<files.length;i++){
      var f = files[i];
      if(IMG.refs.length >= 4){ toast('Max 4 photos', 'error'); break; }
      if(!f.type.startsWith('image/')) continue;
      if(f.size > 8*1024*1024){ toast('Trop lourd: ' + f.name, 'error'); continue; }
      try{
        var im = await readFileAsDataURL(f, 1024);
        IMG.refs.push({ id: uidLocal(), u: im.u, d: im.d, name: f.name });
      } catch(err){ imgLog('Erreur lecture: ' + err.message); }
    }
    renderImgThumbs();
  };
  // Bouton générer
  var gb = $id('imgGenBtn');
  if(gb) gb.onclick = async function(){
    if(IMG.running) return;
    var prompt = ($id('imgPrompt') || {}).value || '';
    prompt = prompt.trim();
    if(!prompt) return toast('Écrivez un prompt', 'error');
    if(!API_KEY) return toast('Enregistrez d\'abord votre clé API', 'error');

    IMG.running = true;
    var oldLbl = gb.innerHTML;
    gb.disabled = true;
    gb.innerHTML = '<span class="spinner"></span>Génération…';

    var il = $id('imgLog'); if(il) il.textContent = '';
    imgLog('Prompt : ' + prompt.slice(0, 100));
    imgLog('Format : ' + IMG.ratio + ' · ' + IMG.refs.length + ' référence(s)');

    try{
      var style = ($id('imgStyle') || {}).value || '';
      var fullPrompt = [prompt, style.trim(), 'high quality, detailed, cinematic lighting'].filter(Boolean).join(', ');
      var size = IMG.ratio === '16:9' ? '1344x768' : IMG.ratio === '9:16' ? '768x1344' : '1024x1024';

      var body = {
        model: MODEL_IMG,
        prompt: fullPrompt,
        n: 1,
        size: size,
        response_format: 'b64_json'
      };
      if(IMG.refs.length){
        body.image = IMG.refs.map(function(r){ return r.d; });
        body.strength = 0.65;
        imgLog('Mode img2img activé');
      }

      imgLog('Envoi à Agnès…');
      var r = await fetch(API_BASE + '/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify(body)
      });
      if(!r.ok){
        var t = (await r.text()).slice(0, 300);
        throw new Error('HTTP ' + r.status + ' — ' + t);
      }
      var d = await r.json();
      var data = d.data || [];
      if(!data.length) throw new Error('Aucune image renvoyée');

      var count = 0;
      for(var i=0;i<data.length;i++){
        var it = data[i];
        var url = it.url || (it.b64_json ? 'data:image/png;base64,' + it.b64_json : null);
        if(!url) continue;
        IMG.results.unshift({ id: uidLocal(), u: url, d: url.indexOf('data:') === 0 ? url : null, ratio: IMG.ratio, date: Date.now() });
        count++;
      }
      if(!count) throw new Error('Format de réponse inattendu');
      imgLog('✓ ' + count + ' image(s) générée(s)');
      renderImgResults();
      toast('🎨 Image générée');
    } catch(err){
      imgLog('✕ ' + err.message);
      toast('Erreur : ' + err.message.slice(0, 80), 'error');
    } finally {
      IMG.running = false;
      gb.disabled = false;
      gb.innerHTML = oldLbl;
    }
  };
  // Bouton clear
  var cb = $id('imgClearBtn');
  if(cb) cb.onclick = function(){
    if(!confirm('Tout effacer ?')) return;
    IMG.refs = []; IMG.results = [];
    if($id('imgPrompt')) $id('imgPrompt').value = '';
    if($id('imgStyle'))  $id('imgStyle').value  = '';
    renderImgThumbs(); renderImgResults();
    var il = $id('imgLog'); if(il) il.textContent = 'Studio réinitialisé.';
    toast('Effacé');
  };
  // Lightbox close
  var lb = $id('lightbox');
  if(lb){
    lb.onclick = function(e){ if(e.target.id === 'lightbox') e.target.classList.remove('on'); };
    var lc = $id('lbClose'); if(lc) lc.onclick = function(){ lb.classList.remove('on'); };
  }
  renderImgThumbs(); renderImgResults();
}

/* ═══════════════════════════════════════════════════════════════════
   CLÉ API + TABS + INIT
   ═══════════════════════════════════════════════════════════════════ */
function refreshApiDiag(){
  var d = $id('apiDiag'); if(!d) return;
  if(!API_KEY){
    d.className = 'diag';
    d.textContent = '⚠️ Aucune clé API Agnès enregistrée. Collez votre clé ci-dessus.';
  } else {
    d.className = 'diag ok';
    d.textContent = '✅ Clé Agnès chargée (' + API_KEY.length + ' car.) — …' + API_KEY.slice(-4);
  }
}
function initKey(){
  var inp = $id('apiKeyInput');
  if(inp && API_KEY) inp.value = API_KEY;

  var sb = $id('saveKeyBtn');
  if(sb) sb.onclick = function(){
    var k = (($id('apiKeyInput') || {}).value || '').trim();
    if(!k){ toast('Entrez une clé', 'error'); return; }
    localStorage.setItem('agnes_api_key', k);
    API_KEY = k;
    refreshApiDiag();
    toast('✓ Clé enregistrée');
  };
  var tb = $id('testKeyBtn');
  if(tb) tb.onclick = function(){
    var k = (($id('apiKeyInput') || {}).value || '').trim();
    if(!k){ toast('Entrez une clé', 'error'); return; }
    var d = $id('apiDiag'); if(d){ d.className='diag'; d.textContent='⏳ Test en cours…'; }
    fetch(API_BASE + '/models', { headers: { 'Authorization': 'Bearer ' + k } })
    .then(function(r){
      if(r.ok){ refreshApiDiag(); toast('✓ Clé valide'); }
      else return r.text().then(function(t){
        if(d){ d.className='diag er'; d.textContent='❌ HTTP '+r.status+' — '+t.slice(0,150); }
        toast('Clé invalide', 'error');
      });
    })
    .catch(function(e){
      if(d){ d.className='diag er'; d.textContent='❌ Réseau : '+e.message; }
      toast('Erreur réseau', 'error');
    });
  };
  refreshApiDiag();
}
function initTabs(){
  document.querySelectorAll('.tab').forEach(function(t){
    t.onclick = function(){
      document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function(x){ x.classList.remove('active'); });
      this.classList.add('active');
      var p = $id(this.getAttribute('data-tab'));
      if(p) p.classList.add('active');
    };
  });
}

/* ─── Boot ─────────────────────────────────────────────────────── */
(function boot(){
  initKey();
  initTabs();
  initImages();

  var add = $id('addSceneBtn'); if(add) add.onclick = addScene;
  var gen = $id('generateBtn'); if(gen) gen.onclick = start;
  var stop = $id('stopBtn');   if(stop) stop.onclick = function(){ stopFlag = true; log('Arrêt demandé...'); };

  // Message dans le diag principal (si pas remplacé par refreshApiDiag)
  var d = $id('apiDiag');
  if(d && !API_KEY) d.textContent = '✅ Script v2 chargé · ⚠️ Aucune clé enregistrée';
  else if(d) refreshApiDiag();

  addScene();
  log('Studio Créatif prêt pour Agnès AI');
})();
