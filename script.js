var API_KEY = localStorage.getItem('mon_appli_api_key') || '';
var API_BASE = 'https://api.magichour.ai/v1';
var scenes = [];
var isRunning = false;
var stopFlag = false;

function log(msg) {
  var el = document.getElementById('log');
  if(!el) return;
  var time = new Date().toLocaleTimeString('fr-FR');
  el.textContent += '\n[' + time + '] ' + msg;
  el.scrollTop = el.scrollHeight;
}

function toast(msg, type) {
  type = type || 'success';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('visible');
  setTimeout(function() { t.classList.remove('visible'); }, 3000);
}

function addScene() {
  scenes.push({ id: Date.now() + Math.random(), imageData: null, description: '', dialogue: '', character: '', status: 'idle', videoUrl: null });
  renderScenes();
}

function removeScene(id) {
  scenes = scenes.filter(function(s) { return s.id !== id; });
  renderScenes();
}

function updateField(id, field, value) {
  for (var i = 0; i < scenes.length; i++) {
    if (scenes[i].id === id) { scenes[i][field] = value; break; }
  }
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
  if (scenes.length === 0) { list.innerHTML = '<div class="empty">Aucune scène.</div>'; updateGenBtn(); return; }
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
    
    html += '<div class="fld"><label>Image (optionnel)</label>';
    if (s.imageData) { html += '<div class="file-zone"><img src="' + s.imageData + '"><button class="f-rm" data-ci="' + s.id + '">Retirer</button></div>'; }
    else { html += '<label class="file-zone"><input type="file" accept="image/*" data-if="' + s.id + '"><div class="up-t">+ Ajouter une image</div></label>'; }
    html += '</div>';
    
    html += '<div class="fld"><label>Description</label><textarea data-f="description" data-s="' + s.id + '">' + (s.description || '') + '</textarea></div>';
    html += '<div class="fld"><label>Texte dit</label><textarea data-f="dialogue" data-s="' + s.id + '">' + (s.dialogue || '') + '</textarea></div>';
    html += '<div class="fld"><label>Personnage</label><textarea data-f="character" data-s="' + s.id + '">' + (s.character || '') + '</textarea></div>';
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

function uploadFileToMagicHour(dataUri, ext, type) {
  return new Promise(function(resolve, reject) {
    fetch(API_BASE + '/files/upload-urls', { method: 'POST', headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ type: type, extension: ext }] }) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var item = d.items && d.items[0];
      if (!item) throw new Error('Erreur upload');
      return fetch(item.upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: dataUriToBlob(dataUri) })
      .then(function() { resolve(item.file_path); });
    }).catch(reject);
  });
}

function createVideoJob(scene, duration) {
  var prompt = scene.description || 'cinematic scene';
  var body;
  if (scene.imageData) {
    return uploadFileToMagicHour(scene.imageData, 'jpg', 'image').then(function(path) {
      body = { name: 'Scene', end_seconds: parseInt(duration), model: 'kling-3.0', resolution: '720p', aspect_ratio: '9:16', audio: true, style: { prompt: prompt }, assets: { image_file_path: path } };
      return fetch(API_BASE + '/image-to-video', { method: 'POST', headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }).then(function(r) { return r.json(); }).then(function(d) { return d.id || d.data.id; });
  }
  body = { name: 'Scene', end_seconds: parseInt(duration), model: 'kling-3.0', resolution: '720p', aspect_ratio: '9:16', audio: true, style: { prompt: prompt } };
  return fetch(API_BASE + '/text-to-video', { method: 'POST', headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function(r) { return r.json(); }).then(function(d) { return d.id || d.data.id; });
}

function pollVideoJob(jobId) {
  return new Promise(function(resolve, reject) {
    var attempts = 0;
    function check() {
      if (stopFlag) return reject(new Error('Arrêté'));
      if (attempts > 120) return reject(new Error('Timeout'));
      attempts++;
      fetch(API_BASE + '/video-projects/' + jobId, { headers: { 'Authorization': 'Bearer ' + API_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.status === 'complete' || d.status === 'completed' || d.status === 'succeeded') {
          resolve((d.download && d.download.url) || (d.output && d.output.url) || d.url);
        } else if (d.status === 'error' || d.status === 'failed') {
          reject(new Error('Échec génération'));
        } else {
          setTimeout(check, 5000);
        }
      }).catch(function() { setTimeout(check, 5000); });
    }
    check();
  });
}

async function start() {
  if (isRunning || scenes.length === 0) return;
  if (!API_KEY) { toast('Entrez une clé API', 'error'); return; }
  isRunning = true; stopFlag = false; updateGenBtn();
  var duration = document.getElementById('storyDuration').value;
  log('=== Début de la génération ===');
  for (var i = 0; i < scenes.length; i++) {
    if (stopFlag) break;
    scenes[i].status = 'processing'; renderScenes();
    try {
      log('Traitement scène ' + (i+1) + '...');
      var jobId = await createVideoJob(scenes[i], duration);
      var url = await pollVideoJob(jobId);
      scenes[i].status = 'done'; scenes[i].videoUrl = url; renderScenes();
      log('✓ Scène ' + (i+1) + ' prête !');
    } catch(e) {
      scenes[i].status = 'failed'; renderScenes();
      log('✗ Échec scène ' + (i+1) + ' : ' + e.message);
    }
  }
  isRunning = false; updateGenBtn();
  log('=== FIN ===');
  toast('Génération terminée !');
}

// INITIALISATION
document.getElementById('apiDiag').textContent = 'Script chargé !';
if (API_KEY) { document.getElementById('apiKeyInput').value = API_KEY; document.getElementById('apiDiag').textContent = 'Clé chargée (' + API_KEY.length + ' car.)'; }
document.getElementById('saveKeyBtn').onclick = function() { var k = document.getElementById('apiKeyInput').value.trim(); if (!k) return alert('Entrez une clé'); localStorage.setItem('mon_appli_api_key', k); API_KEY = k; document.getElementById('apiDiag').textContent = 'Clé enregistrée !'; };
document.getElementById('testKeyBtn').onclick = function() { var k = document.getElementById('apiKeyInput').value.trim(); if (!k) return alert('Entrez une clé'); document.getElementById('apiDiag').textContent = 'Test...'; fetch(API_BASE + '/files/upload-urls', { method: 'POST', headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ type: 'image', extension: 'jpg' }] }) }).then(r => { document.getElementById('apiDiag').textContent = r.ok ? '✅ Clé valide !' : '❌ Clé invalide (' + r.status + ')'; }); };
document.getElementById('addSceneBtn').onclick = addScene;
document.getElementById('generateBtn').onclick = start;
document.getElementById('stopBtn').onclick = function() { stopFlag = true; log('Arrêt demandé...'); };
document.querySelectorAll('.tab').forEach(function(t) { t.onclick = function() { document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); document.querySelectorAll('.panel').forEach(function(x) { x.classList.remove('active'); }); document.getElementById(this.getAttribute('data-tab')).classList.add('active'); }; });
addScene();
log('Prêt.');
