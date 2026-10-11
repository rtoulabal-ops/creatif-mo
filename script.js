var API_KEY = localStorage.getItem('mon_appli_api_key') || '';
var API_BASE = 'https://api.magichour.ai/v1';

document.getElementById('apiDiag').textContent = '✅ Script chargé !';
if(API_KEY) {
  document.getElementById('apiKeyInput').value = API_KEY;
  document.getElementById('apiDiag').textContent = '✅ Clé chargée (' + API_KEY.length + ' car.)';
} else {
  document.getElementById('apiDiag').textContent = '⚠️ Aucune clé. Entrez votre clé API.';
}

document.getElementById('saveKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  if(!k) { alert('Entrez une clé'); return; }
  localStorage.setItem('mon_appli_api_key', k);
  API_KEY = k;
  document.getElementById('apiDiag').textContent = '✅ Clé enregistrée !';
};

document.getElementById('testKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  if(!k) { alert('Entrez une clé'); return; }
  document.getElementById('apiDiag').textContent = '⏳ Test en cours...';
  fetch(API_BASE + '/files/upload-urls', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({items:[{type:'image', extension:'jpg'}]})
  })
  .then(r => {
    if(r.status === 401) { document.getElementById('apiDiag').textContent = '❌ Erreur 401 : Clé invalide'; }
    else if (r.ok) { document.getElementById('apiDiag').textContent = '✅ Clé API valide et fonctionnelle !'; }
    else { document.getElementById('apiDiag').textContent = '⚠️ Erreur HTTP ' + r.status; }
  })
  .catch(e => { document.getElementById('apiDiag').textContent = '❌ Erreur réseau'; });
};

document.getElementById('addSceneBtn').onclick = function() {
  document.getElementById('log').textContent = 'Bouton ajouter scène cliqué !';
};
document.getElementById('generateBtn').disabled = true;
