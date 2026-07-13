(function(){
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const cutOverlay = document.getElementById('cutOverlay');
  const ruler = document.getElementById('ruler');
  const dimTag = document.getElementById('dimTag');

  const fileMeta = document.getElementById('fileMeta');
  const metaName = document.getElementById('metaName');
  const metaDim = document.getElementById('metaDim');
  const metaSize = document.getElementById('metaSize');

  const sliceCountInput = document.getElementById('sliceCount');
  const sliceRange = document.getElementById('sliceRange');
  const decBtn = document.getElementById('decBtn');
  const incBtn = document.getElementById('incBtn');

  const fmtButtons = document.querySelectorAll('.fmt');
  let currentFormat = 'png';

  const modeButtons = document.querySelectorAll('.mode');
  let currentMode = 'zip';

  const sumCount = document.getElementById('sumCount');
  const sumWidth = document.getElementById('sumWidth');
  const sumZipName = document.getElementById('sumZipName');

  const cutBtn = document.getElementById('cutBtn');
  const cutBtnLabel = document.getElementById('cutBtnLabel');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const resetLink = document.getElementById('resetLink');

  let img = null;
  let originalFile = null;
  let naturalW = 0, naturalH = 0;

  // ---------- upload handling ----------
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  resetLink.addEventListener('click', () => {
    img = null; originalFile = null;
    stage.classList.remove('active');
    dropzone.style.display = 'flex';
    fileMeta.style.display = 'none';
    resetLink.style.display = 'none';
    cutBtn.disabled = true;
    dimTag.textContent = '—';
    fileInput.value = '';
  });

  function handleFile(file){
    if (!file.type.startsWith('image/')) return;
    originalFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      const image = new Image();
      image.onload = () => {
        img = image;
        naturalW = image.naturalWidth;
        naturalH = image.naturalHeight;
        onImageReady(file);
      };
      image.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function onImageReady(file){
    dropzone.style.display = 'none';
    stage.classList.add('active');
    fileMeta.style.display = 'flex';
    resetLink.style.display = 'inline-block';
    cutBtn.disabled = false;

    metaName.textContent = file.name;
    metaDim.textContent = naturalW + ' × ' + naturalH + ' px';
    metaSize.textContent = (file.size/1024).toFixed(0) + ' KB';
    dimTag.textContent = naturalW + '×' + naturalH;

    // clamp max slices sensibly to image width
    const maxSlices = Math.max(2, Math.min(20, naturalW));
    sliceCountInput.max = maxSlices;
    sliceRange.max = maxSlices;

    drawPreview();
  }

  function drawPreview(){
    if (!img) return;
    const holderW = canvas.parentElement.clientWidth - 20;
    const holderH = 460;
    const ratio = Math.min(holderW / naturalW, holderH / naturalH, 1);
    const w = Math.round(naturalW * ratio);
    const h = Math.round(naturalH * ratio);
    canvas.width = naturalW;
    canvas.height = naturalH;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    drawCutLines(w, h);
    drawRuler(w);
  }

  function drawCutLines(displayW, displayH){
    cutOverlay.innerHTML = '';
    cutOverlay.style.width = displayW + 'px';
    cutOverlay.style.height = displayH + 'px';
    cutOverlay.style.left = '50%';
    cutOverlay.style.top = '10px';
    cutOverlay.style.transform = 'translateX(-50%)';
    cutOverlay.style.right = 'auto';

    const n = getSliceCount();
    const stepW = displayW / n;

    for(let i=1;i<n;i++){
      const line = document.createElement('div');
      line.className = 'cut-line';
      line.style.left = (stepW*i) + 'px';
      cutOverlay.appendChild(line);
    }
    for(let i=0;i<n;i++){
      const label = document.createElement('div');
      label.className = 'strip-label';
      label.style.left = (stepW*i + 4) + 'px';
      label.textContent = String(i+1).padStart(2,'0');
      cutOverlay.appendChild(label);
    }
  }

  function drawRuler(displayW){
    ruler.innerHTML = '';
    const n = getSliceCount();
    const stepW = displayW / n;
    ruler.style.width = displayW + 'px';
    ruler.style.margin = '0 auto';
    for(let i=0;i<=n;i++){
      const tick = document.createElement('div');
      tick.style.position = 'absolute';
      tick.style.left = (stepW*i) + 'px';
      tick.style.bottom = '0';
      tick.style.height = (i % n === 0 ? '16px' : '10px');
      tick.style.borderLeft = '1px solid var(--steel-dim)';
      ruler.appendChild(tick);
    }
  }

  function getSliceCount(){
    let n = parseInt(sliceCountInput.value, 10);
    if (isNaN(n) || n < 2) n = 2;
    return n;
  }

  function syncSliceUI(n){
    sliceCountInput.value = n;
    sliceRange.value = n;
    sumCount.textContent = n;
    if (naturalW) {
      sumWidth.textContent = Math.ceil(naturalW / n);
    }
    updateModeSummary();
    if (stage.classList.contains('active')) drawPreview();
  }

  function updateModeSummary(){
    const n = getSliceCount();
    if (currentMode === 'individual') {
      sumZipName.textContent = n + ' arquivos separados';
      cutBtnLabel.textContent = 'Cortar e baixar fatias';
    } else {
      sumZipName.textContent = 'fatias.zip';
      cutBtnLabel.textContent = 'Cortar e baixar .zip';
    }
  }

  sliceCountInput.addEventListener('input', () => syncSliceUI(getSliceCount()));
  sliceRange.addEventListener('input', () => syncSliceUI(parseInt(sliceRange.value,10)));
  decBtn.addEventListener('click', () => syncSliceUI(Math.max(2, getSliceCount()-1)));
  incBtn.addEventListener('click', () => syncSliceUI(Math.min(parseInt(sliceCountInput.max||20,10), getSliceCount()+1)));

  fmtButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.fmt;
    });
  });

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updateModeSummary();
    });
  });

  window.addEventListener('resize', () => { if (img) drawPreview(); });

  // ---------- cutting + downloading ----------
  cutBtn.addEventListener('click', async () => {
    if (!img) return;
    const n = getSliceCount();
    cutBtn.disabled = true;
    cutBtn.classList.add('working');
    cutBtnLabel.textContent = 'Cortando…';
    progressTrack.classList.add('show');
    progressFill.style.width = '0%';

    const restoreLabel = () => {
      updateModeSummary();
      cutBtn.classList.remove('working');
      cutBtn.disabled = false;
      progressTrack.classList.remove('show');
    };

    try {
      const baseWidth = Math.floor(naturalW / n);
      let remainder = naturalW - baseWidth * n;
      let x = 0;

      const mime = currentFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      const ext = currentFormat === 'jpeg' ? 'jpg' : currentFormat;
      const baseName = originalFile ? originalFile.name.replace(/\.[^.]+$/, '') : 'imagem';

      const slices = [];
      for (let i = 0; i < n; i++) {
        let sliceW = baseWidth + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sliceW;
        sliceCanvas.height = naturalH;
        const sctx = sliceCanvas.getContext('2d');
        sctx.drawImage(img, x, 0, sliceW, naturalH, 0, 0, sliceW, naturalH);

        const blob = await new Promise(res => sliceCanvas.toBlob(res, mime, 0.92));
        const name = baseName + '-fatia-' + String(i+1).padStart(2,'0') + '.' + ext;
        slices.push({ name, blob });

        x += sliceW;
        progressFill.style.width = Math.round(((i+1)/n)*70) + '%';
      }

      if (currentMode === 'individual') {
        cutBtnLabel.textContent = 'Baixando fatias…';
        for (let i = 0; i < slices.length; i++) {
          const url = URL.createObjectURL(slices[i].blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = slices[i].name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          progressFill.style.width = (70 + Math.round(((i+1)/slices.length)*30)) + '%';
          // small delay so the browser doesn't block a burst of downloads
          await new Promise(r => setTimeout(r, 220));
        }
      } else {
        cutBtnLabel.textContent = 'Compactando…';
        const zip = new JSZip();
        slices.forEach(s => zip.file(s.name, s.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
          progressFill.style.width = (70 + Math.round(meta.percent*0.3)) + '%';
        });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = baseName + '-fatias.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }

      cutBtnLabel.textContent = 'Baixado ✓';
      setTimeout(restoreLabel, 1600);

    } catch (err) {
      console.error(err);
      cutBtnLabel.textContent = 'Erro — tente novamente';
      cutBtn.classList.remove('working');
      cutBtn.disabled = false;
      setTimeout(updateModeSummary, 2200);
    }
  });
  syncSliceUI(2);
})();
