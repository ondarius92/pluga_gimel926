function buildUrl() {
  return location.href.split('#')[0] + '#' + btoa(encodeURIComponent(JSON.stringify(state)));
}

function genLink() {
  const long = buildUrl();
  document.getElementById('share-area').style.display = 'block';
  document.getElementById('share-status').textContent = '⏳ מקצר...';
  document.getElementById('share-url').value = '';

  fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(long))
    .then(r => r.text())
    .then(s => {
      const url = s && s.includes('tinyurl.com') ? s : long;
      document.getElementById('share-url').value = url;
      document.getElementById('share-status').textContent =
        s && s.includes('tinyurl.com') ? '✅ קישור קצר מוכן!' : '⚠️ קישור מלא';
    })
    .catch(() => {
      document.getElementById('share-url').value = long;
      document.getElementById('share-status').textContent = '⚠️ אין חיבור';
    });
}

function copyLink() {
  const ta = document.getElementById('share-url');
  ta.select(); ta.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(ta.value)
    .then(() => alert('הועתק!'))
    .catch(() => { document.execCommand('copy'); alert('הועתק!'); });
}

function waLink() {
  const cur = document.getElementById('share-url').value;
  if (cur && cur.includes('tinyurl.com')) {
    window.open('https://wa.me/?text=' + encodeURIComponent('שבצק פלוגה 📋\n' + cur), '_blank');
    return;
  }
  const long = buildUrl();
  fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(long))
    .then(r => r.text())
    .then(s => {
      const url = s && s.includes('tinyurl.com') ? s : long;
      window.open('https://wa.me/?text=' + encodeURIComponent('שבצק פלוגה 📋\n' + url), '_blank');
    })
    .catch(() => {
      window.open('https://wa.me/?text=' + encodeURIComponent('שבצק פלוגה 📋\n' + long), '_blank');
    });
}

function loadLink() {
  const input = document.getElementById('load-url').value.trim();
  const msg   = document.getElementById('load-msg');
  try {
    const hash = input.includes('#') ? input.split('#')[1] : input;
    const d = JSON.parse(decodeURIComponent(atob(hash)));
    if (!d || !d.soldiers) throw new Error();
    state = d; fixState(); save(); renderAll();
    msg.innerHTML = '<span style="color:#1a6e32;font-weight:700">✅ נטען!</span>';
  } catch(e) {
    msg.innerHTML = '<span style="color:#8a1a1a;font-weight:700">❌ קישור לא תקין</span>';
  }
}
