var API_KEY = localStorage.getItem('agnes_api_key') || '';
var API_BASE = 'https://apihub.agnes-ai.com/v1';
var MODEL_ID = 'agnes-video-2.5-flash';

var scenes = [];
var isRunning = false;
var stopFlag = false;
var timerInterval = null;
var timerStart = 0;
var currentSceneNum = 0;
var totalScenes = 0;

function log(msg) {
  var el = document.getElementById('log');
  if(!el) return;
  var time = new Date().toLocaleTimeString('fr-FR');
  el.textContent += '\n[' + time + '] ' + msg;
  el.scrollTop = el.scrollHeight;
}

function toast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || 'success');
  t.classList.add('visible');
  setTimeout(function() { t.classList.remove('visible'); }, 3000);
}

function formatTime(s){ var m = Math.floor(s/60), sec = s%60; return (m<10?'0':'')+m+':'+(sec<10?'0':'')+sec; }

function startTimer(){
  timerStart = Date.now();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(function(){ var e = Math.floor((Date.now()-timerStart)/1000); document.getElementById('timerVal').textContent = formatTime(e); }, 1000);
}
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }

function addScene() {
  scenes.push({ id: Date.now() + Math.random(), imageData: null, description: '', status: 'idle', videoUrl: null });
  renderScenes();
}

function removeScene(id) {
  scenes = scenes.filter(function(s) { return s.id !== id; });
  renderScenes();
}

function updateField(id, field, value) {
  for (var i = 0; i < scenes.length; i++) { if (scenes[i].id === id) { scenes[i][field] = value; break; } }
}

function onImage(id, file) {
  if (!file) return;
  var r = new FileReader();
  r.onload = function(e) {
    for (var i = 0; i < scenes.length; i++) { if (scenes[i].id === id) { scenes[i].imageData = e.target.result; break; } }
    renderScenes();
  };
  r.readAsDataURL(file);
}

function renderScenes() {
  var list = document.getElementById('scenesList');
  if (scenes.length === 0) { list.innerHTML = '<div class="empty">Aucune scène. Cliquez sur Ajouter.</div>'; updateGenBtn(); return; }
  var html = '';
  for (var i = 0; i < scenes.length; i++) {
    var s = scenes[i];
    var cls = 'sc-status', txt = 'En attente';
    if (s.status === 'done') { cls += ' done'; txt = 'OK'; }
    else if (s.status === 'processing') { cls += ' processing'; txt = 'En cours'; }
    else if (s.status === 'failed') { cls += ' failed'; txt = 'Échec'; }
    html += '<div class="scene"><div class="sc-head"><div class="sc-num">' + (i+1) + '</div><div class="sc-title">Scène ' + (i+1) + '</div><div class="' + cls + '">' + txt + '</div>';
    if (scenes.length > 1) html += '<button class="sc-rm" data-rm="' + s.id + '">×</button>';
    html += '</div>';
    html += '<div class="fld"><label>Image de départ (optionnel)</label>';
    if (s.imageData) { html += '<div class="file-zone"><img src="' + s.imageData + '"><button class="f-rm" data-ci="' + s.id + '">Retirer</button></div>'; }
    else { html += '<label class="file-zone"><input type="file" accept="image/*" data-if="' + s.id + '"><div class="up-t">+ Ajouter une image</div></label>'; }
    html += '</div>';
    html += '<div class="fld"><label>Description</label><textarea data-f="description" data-s="' + s.id + '">' + (s.description || '') + '</textarea></div>';
    if (s.videoUrl) html += '<div class="sc-vid"><video src="' + s.videoUrl + '" controls></video></div>';
    html += '</div>';
  }
  list.innerHTML = html;
  list.querySelectorAll('[data-rm]').forEach(function(b) { b.onclick = function() { removeScene(parseFloat(this.getAttribute('data-rm'))); }; });
  list.querySelectorAll('[data-ci]').forEach(function(b) { b.onclick = function() { for (var i=0;i<scenes.length;i++) if(scenes[i].id===parseFloat(this.getAttribute('data-ci'))) scenes[i].imageData=null; renderScenes(); }; });
  list.querySelectorAll('input[data-if]').forEach(function(inp) { inp.onchange = function() { onImage(parseFloat(this.getAttribute('data-if')), this.files[0]); }; });
  list.querySelectorAll('textarea[data-f]').forEach(function(ta) { ta.oninput = function() { updateField(parseFloat(this.getAttribute('data-s')), this.getAttribute('data-f'), this.value); }; });
  updateGenBtn();
}

function updateGenBtn() {
  var btn = document.getElementById('generateBtn');
  btn.disabled = scenes.length === 0 || isRunning;
  btn.textContent = isRunning ? '⏳ Génération...' : (scenes.length === 0 ? 'Ajoutez une scène' : '🎬 Générer ' + scenes.length + ' vidéo' + (scenes.length > 1 ? 's' : ''));
}

function dataUriToBlob(dataUri) {
  var parts = dataUri.split(','); var mime = parts[0].match(/:(.*?);/)[1]; var bin = atob(parts[1]); var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Fonction pour créer une tâche vidéo avec Agnès AI
function createVideoJob(scene, duration) {
  var prompt = scene.description || 'cinematic scene';
  var body = {
    model: MODEL_ID,
    prompt: prompt,
    seconds: String(duration),
    mode: 'text',
    size: '720P',
    aspect_ratio: '9:16'
  };
  return fetch(API_BASE + '/videos', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  .then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('HTTP ' + r.status + ' - ' + t); });
    return r.json();
  })
  .then(function(d) {
    var videoId = d.video_id || (d.data && d.data.video_id) || (d.id) || (d.task_id);
    if (!videoId) throw new Error('Réponse Agnès inattendue: ' + JSON.stringify(d));
    log('Tâche créée, ID: ' + videoId);
    return videoId;
  });
}

// Fonction pour vérifier le statut de la tâche
function pollVideoJob(videoId) {
  return new Promise(function(resolve, reject) {
    var attempts = 0;
    var maxAttempts = 120;
    
    function check() {
      if (stopFlag) return reject(new Error('Arrêté par l\'utilisateur'));
      if (attempts >= maxAttempts) return reject(new Error('Timeout: la génération prend trop de temps'));
      attempts++;
      
      var url = API_BASE + '/agnesapi?video_id=' + videoId + '&model_name=' + MODEL_ID;
      
      fetch(url, {
        headers: { 'Authorization': 'Bearer ' + API_KEY }
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var status = d.status || d.state || 'pending';
        log('Statut: ' + status);
        
        if (status === 'completed' || status === 'complete' || status === 'succeeded') {
          var videoUrl = d.url || (d.data && d.data.url) || (d.output && d.output.url);
          if (!videoUrl) return reject(new Error('Pas d\'URL vidéo dans la réponse'));
          resolve(videoUrl);
        } else if (status === 'failed' || status === 'error') {
          reject(new Error('Échec de la génération: ' + (d.error || d.message || 'Erreur inconnue')));
        } else {
          setTimeout(check, 2000);
        }
      })
      .catch(function(e) {
        log('Erreur de vérification: ' + e.message);
        setTimeout(check, 3000);
      });
    }
    check();
  });
}

async function start() {
  if (isRunning || scenes.length === 0) return;
  if (!API_KEY) { toast('Veuillez entrer votre clé API Agnès', 'error'); return; }
  
  isRunning = true;
  stopFlag = false;
  updateGenBtn();
  document.getElementById('stopBtn').style.display = 'block';
  document.getElementById('timerBox').classList.add('visible');
  
  var duration = document.getElementById('storyDuration').value;
  totalScenes = scenes.length;
  
  stopTimer();
  document.getElementById('timerVal').textContent = '00:00';
  document.getElementById('progressFill').style.width = '0%';
  startTimer();
  log('=== Début de la génération (' + totalScenes + ' scène(s)) ===');
  
  var successCount = 0;
  
  for (var i = 0; i < scenes.length; i++) {
    if (stopFlag) break;
    
    var scene = scenes[i];
    scene.status = 'processing';
    currentSceneNum = i + 1;
    renderScenes();
    
    try {
      log('Traitement scène ' + currentSceneNum + '...');
      var videoId = await createVideoJob(scene, duration);
      var videoUrl = await pollVideoJob(videoId);
      
      scene.status = 'done';
      scene.videoUrl = videoUrl;
      renderScenes();
      renderGallery();
      successCount++;
      log('✓ Scène ' + currentSceneNum + ' prête !');
      
    } catch(e) {
      scene.status = 'failed';
      renderScenes();
      log('✗ Échec scène ' + currentSceneNum + ': ' + e.message);
    }
    
    document.getElementById('progressFill').style.width = Math.round(((i+1)/totalScenes)*100) + '%';
  }
  
  isRunning = false;
  stopTimer();
  updateGenBtn();
  document.getElementById('stopBtn').style.display = 'none';
  log('=== FIN: ' + successCount + '/' + totalScenes + ' vidéo(s) générée(s) ===');
  toast(successCount + '/' + totalScenes + ' vidéo(s) générée(s)', successCount > 0 ? 'success' : 'error');
}

function renderGallery() {
  var g = document.getElementById('gallery');
  var html = '';
  for (var i = 0; i < scenes.length; i++) {
    if (scenes[i].status === 'done' && scenes[i].videoUrl) {
      html += '<div class="g-item">';
      html += '<video src="' + scenes[i].videoUrl + '" controls></video>';
      html += '<div class="g-cap"><span>Scène ' + (i+1) + '</span>';
      html += '<a href="' + scenes[i].videoUrl + '" target="_blank" download="scene-' + (i+1) + '.mp4">Télécharger</a>';
      html += '</div></div>';
    }
  }
  g.innerHTML = html || '<div class="empty">Aucune vidéo</div>';
}

// INITIALISATION
document.getElementById('apiDiag').textContent = '✅ Script Agnès AI chargé !';

if (API_KEY) {
  document.getElementById('apiKeyInput').value = API_KEY;
  document.getElementById('apiDiag').textContent = '✅ Clé Agnès chargée (' + API_KEY.length + ' car.)';
} else {
  document.getElementById('apiDiag').textContent = '⚠️ Aucune clé API Agnès. Entrez votre clé.';
}

document.getElementById('saveKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  if (!k) { alert('Veuillez entrer une clé API'); return; }
  localStorage.setItem('agnes_api_key', k);
  API_KEY = k;
  document.getElementById('apiDiag').textContent = '✅ Clé Agnès enregistrée !';
  toast('Clé API enregistrée !');
};

document.getElementById('testKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  if (!k) { alert('Veuillez entrer une clé API'); return; }
  document.getElementById('apiDiag').textContent = '⏳ Test de la clé Agnès...';
  
  fetch(API_BASE + '/videos', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + k,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_ID,
      prompt: 'test',
      seconds: '1',
      mode: 'text',
      size: '720P',
      aspect_ratio: '16:9'
    })
  })
  .then(function(r) {
    if (r.ok) {
      document.getElementById('apiDiag').textContent = '✅ Clé API Agnès valide et fonctionnelle !';
      toast('Clé API valide !', 'success');
    } else {
      return r.text().then(function(t) {
        document.getElementById('apiDiag').textContent = '❌ Clé invalide (HTTP ' + r.status + '): ' + t.slice(0, 100);
        toast('Clé API invalide', 'error');
      });
    }
  })
  .catch(function(e) {
    document.getElementById('apiDiag').textContent = '❌ Erreur réseau: ' + e.message;
    toast('Erreur réseau', 'error');
  });
};

document.getElementById('addSceneBtn').onclick = addScene;
document.getElementById('generateBtn').onclick = start;
document.getElementById('stopBtn').onclick = function() { stopFlag = true; log('Arrêt demandé...'); };

document.querySelectorAll('.tab').forEach(function(t) {
  t.onclick = function() {
    document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
    this.classList.add('active');
    document.querySelectorAll('.panel').forEach(function(x) { x.classList.remove('active'); });
    document.getElementById(this.getAttribute('data-tab')).classList.add('active');
  };
});

addScene();
log('Studio Créatif prêt pour Agnès AI');
