var API_KEY = localStorage.getItem('agnes_api_key') || '';

document.getElementById('apiDiag').textContent = 'Script chargé.';
document.getElementById('apiKeyInput').value = API_KEY;

document.getElementById('saveKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  localStorage.setItem('agnes_api_key', k);
  API_KEY = k;
  document.getElementById('apiDiag').textContent = 'Clé enregistrée.';
};

document.getElementById('testKeyBtn').onclick = function() {
  var k = document.getElementById('apiKeyInput').value.trim();
  if (!k) { alert('Entrez une clé'); return; }
  document.getElementById('apiDiag').textContent = 'Test en cours...';
  
  // On teste plusieurs URLs possibles pour trouver la bonne
  var urls = [
    'https://api.agnes-ai.com/v1/models',
    'https://apihub.agnes-ai.com/v1/models',
    'https://api.agnes.ai/v1/models'
  ];
  
  var results = '';
  var i = 0;
  
  function testNext() {
    if (i >= urls.length) {
      document.getElementById('apiDiag').textContent = results;
      return;
    }
    var url = urls[i];
    fetch(url, { headers: { 'Authorization': 'Bearer ' + k } })
      .then(function(r) {
        results += url + ' → HTTP ' + r.status + '\n';
        i++;
        testNext();
      })
      .catch(function(e) {
        results += url + ' → ERREUR RÉSEAU\n';
        i++;
        testNext();
      });
  }
  testNext();
};
