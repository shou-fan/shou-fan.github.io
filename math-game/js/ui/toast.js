function showToast(msg, type) {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.textContent = msg;
    c.appendChild(d);
    setTimeout(() => { d.style.transition = 'opacity .3s'; d.style.opacity = 0; setTimeout(() => d.remove(), 300); }, 2600);
}
