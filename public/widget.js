(function () {
  var script = document.currentScript;
  var slug = script.getAttribute('data-slug');
  if (!slug) return;

  var color = script.getAttribute('data-color') || '#4ecde6';
  var position = script.getAttribute('data-position') || 'bottom-right';
  var url = 'https://theplayerportal.net/book/' + slug;

  var btn = document.createElement('a');
  btn.href = url;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.textContent = 'Book Now';

  var posStyle = position === 'bottom-left'
    ? 'left:20px;right:auto;'
    : 'right:20px;left:auto;';

  btn.setAttribute('style',
    'position:fixed;bottom:20px;' + posStyle +
    'z-index:999999;padding:14px 28px;border-radius:999px;' +
    'font-size:15px;font-weight:700;font-family:system-ui,sans-serif;' +
    'background-color:' + color + ';color:#fff;text-decoration:none;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.25);' +
    'transition:transform 0.2s,box-shadow 0.2s;cursor:pointer;'
  );

  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 28px rgba(0,0,0,0.35)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
  });

  document.body.appendChild(btn);
})();
