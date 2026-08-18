(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const stage = document.getElementById('stage');
  const controlsPanel = document.getElementById('controlsPanel');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const cutOverlay = document.getElementById('cutOverlay');
  const ruler = document.getElementById('ruler');
  const dimTag = document.getElementById('dimTag');

  const fileMeta = document.getElementById('fileMeta');
  const metaName = document.getElementById('metaName');
  const metaDim = document.getElementById('metaDim');
  const metaSize = document.getElementById('metaSize');

  const idealBadge = document.getElementById('idealBadge');
  const idealHint = document.getElementById('idealHint');
  const widthMatch = document.getElementById('widthMatch');

  const sliceCountInput = document.getElementById('sliceCount');
  const sliceRange = document.getElementById('sliceRange');
  const decBtn = document.getElementById('decBtn');
  const incBtn = document.getElementById('incBtn');

  const fmtButtons = document.querySelectorAll('.fmt');
  let currentFormat = 'png';

  const compressButtons = document.querySelectorAll('.compress-btn');
  const qualityBlock = document.getElementById('qualityBlock');
  const qualityRange = document.getElementById('qualityRange');
  const qualityBadge = document.getElementById('qualityBadge');
  const qualityDesc = document.getElementById('qualityDesc');
  let isCompressed = false;
  let qualityPNG = 100;
  let qualityJPG = 98;
  let compressionQuality = 100;

  const modeButtons = document.querySelectorAll('.mode');
  let currentMode = 'individual';

  const sumCount = document.getElementById('sumCount');
  const sumWidth = document.getElementById('sumWidth');
  const sumCompress = document.getElementById('sumCompress');
  const sumZipName = document.getElementById('sumZipName');

  const cutBtn = document.getElementById('cutBtn');
  const cutBtnLabel = document.getElementById('cutBtnLabel');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const resetLink = document.getElementById('resetLink');

  let img = null;
  let originalFile = null;
  let naturalW = 0, naturalH = 0;
  let detectedIdealSlices = null;

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
    naturalW = 0; naturalH = 0;
    detectedIdealSlices = null;
    stage.classList.remove('active');
    if (controlsPanel) controlsPanel.classList.remove('active');
    dropzone.style.display = 'flex';
    fileMeta.style.display = 'none';
    resetLink.style.display = 'none';
    cutBtn.disabled = true;
    dimTag.textContent = '—';
    fileInput.value = '';
    sliceCountInput.max = 20;
    sliceRange.max = 20;

    isCompressed = false;
    qualityPNG = 100;
    qualityJPG = 98;
    compressionQuality = currentFormat === 'jpeg' ? qualityJPG : qualityPNG;
    if (qualityRange) qualityRange.value = compressionQuality;
    compressButtons.forEach(b => {
      if (b.dataset.compress === 'no') b.classList.add('active');
      else b.classList.remove('active');
    });
    if (qualityBlock) qualityBlock.style.display = 'none';
    updateQualityUI();

    updateIdealUI(2);
    syncSliceUI(2);
  });

  function calculateIdealSlices(w) {
    if (!w || w <= 0) return 2;
    const BASE_WIDTH = 1080;
    const slices = Math.round(w / BASE_WIDTH);
    return Math.max(2, slices);
  }

  function handleFile(file) {
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

  function onImageReady(file) {
    dropzone.style.display = 'none';
    stage.classList.add('active');
    if (controlsPanel) controlsPanel.classList.add('active');
    fileMeta.style.display = 'flex';
    resetLink.style.display = 'inline-block';
    cutBtn.disabled = false;

    metaName.textContent = file.name;
    metaDim.textContent = naturalW + ' × ' + naturalH + ' px';
    metaSize.textContent = (file.size / 1024).toFixed(0) + ' KB';
    dimTag.textContent = naturalW + '×' + naturalH;

    detectedIdealSlices = calculateIdealSlices(naturalW);

    const maxSlices = Math.max(20, Math.min(50, Math.max(detectedIdealSlices + 4, Math.floor(naturalW / 50))));
    sliceCountInput.max = maxSlices;
    sliceRange.max = maxSlices;

    syncSliceUI(detectedIdealSlices);
  }

  function drawPreview() {
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    drawCutLines(w, h);
    drawRuler(w);
  }

  function drawCutLines(displayW, displayH) {
    cutOverlay.innerHTML = '';
    cutOverlay.style.width = displayW + 'px';
    cutOverlay.style.height = displayH + 'px';
    cutOverlay.style.left = '50%';
    cutOverlay.style.top = '10px';
    cutOverlay.style.transform = 'translateX(-50%)';
    cutOverlay.style.right = 'auto';

    const n = getSliceCount();
    const stepW = displayW / n;

    for (let i = 1; i < n; i++) {
      const line = document.createElement('div');
      line.className = 'cut-line';
      line.style.left = (stepW * i) + 'px';
      cutOverlay.appendChild(line);
    }
    for (let i = 0; i < n; i++) {
      const label = document.createElement('div');
      label.className = 'strip-label';
      label.style.left = (stepW * i + 4) + 'px';
      label.textContent = String(i + 1).padStart(2, '0');
      cutOverlay.appendChild(label);
    }
  }

  function drawRuler(displayW) {
    ruler.innerHTML = '';
    const n = getSliceCount();
    const stepW = displayW / n;
    ruler.style.width = displayW + 'px';
    ruler.style.margin = '0 auto';
    for (let i = 0; i <= n; i++) {
      const tick = document.createElement('div');
      tick.style.position = 'absolute';
      tick.style.left = (stepW * i) + 'px';
      tick.style.bottom = '0';
      tick.style.height = (i % n === 0 ? '16px' : '10px');
      tick.style.borderLeft = '1px solid var(--steel-dim)';
      ruler.appendChild(tick);
    }
  }

  function getSliceCount() {
    let n = parseInt(sliceCountInput.value, 10);
    if (isNaN(n) || n < 2) n = 2;
    return n;
  }

  function updateIdealUI(n) {
    if (!naturalW || !detectedIdealSlices) {
      if (idealBadge) idealBadge.style.display = 'none';
      if (idealHint) idealHint.style.display = 'none';
      if (widthMatch) widthMatch.style.display = 'none';
      return;
    }

    const currentSliceW = Math.round(naturalW / n);
    const isExact1080 = (naturalW % n === 0) && (naturalW / n === 1080);
    const isCloseTo1080 = currentSliceW === 1080;
    const isIdealCount = (n === detectedIdealSlices);

    if (idealBadge) {
      idealBadge.style.display = 'inline-flex';
      if (isExact1080) {
        idealBadge.textContent = '1080px exato';
        idealBadge.classList.add('active-ideal');
      } else if (isIdealCount) {
        idealBadge.textContent = 'Ideal: ' + detectedIdealSlices + ' fatias';
        idealBadge.classList.add('active-ideal');
      } else {
        idealBadge.textContent = 'Ideal: ' + detectedIdealSlices + ' fatias';
        idealBadge.classList.remove('active-ideal');
      }
    }

    if (idealHint) {
      if (!isIdealCount) {
        idealHint.style.display = 'flex';
        const idealW = Math.round(naturalW / detectedIdealSlices);
        idealHint.innerHTML = `<span>Sugestão: <b>${detectedIdealSlices} fatias</b> (${idealW}px cada)</span><button type="button" class="btn-apply-ideal" id="applyIdealBtn">Aplicar ${detectedIdealSlices} fatias</button>`;
        const applyBtn = document.getElementById('applyIdealBtn');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => syncSliceUI(detectedIdealSlices));
        }
      } else {
        idealHint.style.display = 'none';
      }
    }

    if (widthMatch) {
      if (isExact1080 || isCloseTo1080) {
        widthMatch.style.display = 'inline-block';
        widthMatch.textContent = isExact1080 ? 'Padrão 1080px ✓' : '~1080px';
      } else {
        widthMatch.style.display = 'none';
      }
    }
  }

  function updateQualityUI() {
    if (qualityBadge) qualityBadge.textContent = compressionQuality + '%';
    if (!qualityDesc) return;
    if (currentFormat === 'png') {
      if (compressionQuality >= 95) {
        qualityDesc.textContent = 'Qualidade máxima PNG (256 cores quantizadas, alta fidelidade)';
      } else if (compressionQuality >= 70) {
        const c = Math.max(2, Math.round((compressionQuality / 100) * 256));
        qualityDesc.textContent = `Equilíbrio recomendado (${c} cores, arquivo bem mais leve)`;
      } else if (compressionQuality >= 40) {
        const c = Math.max(2, Math.round((compressionQuality / 100) * 256));
        qualityDesc.textContent = `Alta compressão (${c} cores, redução significativa)`;
      } else {
        const c = Math.max(2, Math.round((compressionQuality / 100) * 256));
        qualityDesc.textContent = `Compressão máxima (${c} cores, tamanho mínimo)`;
      }
    } else {
      if (compressionQuality >= 90) {
        qualityDesc.textContent = 'Qualidade máxima JPG (alta fidelidade e máxima nitidez)';
      } else if (compressionQuality >= 70) {
        qualityDesc.textContent = 'Equilíbrio recomendado JPG (ótima nitidez e tamanho leve)';
      } else if (compressionQuality >= 40) {
        qualityDesc.textContent = 'Alta compressão JPG (para carregamento rápido)';
      } else {
        qualityDesc.textContent = 'Compressão máxima JPG (menor tamanho de arquivo)';
      }
    }
  }

  function syncSliceUI(n) {
    sliceCountInput.value = n;
    sliceRange.value = n;
    sumCount.textContent = n;
    if (naturalW) {
      sumWidth.textContent = Math.ceil(naturalW / n);
    } else {
      sumWidth.textContent = '—';
    }
    if (sumCompress) {
      sumCompress.textContent = isCompressed ? `Sim (${compressionQuality}%)` : 'Não';
    }
    updateIdealUI(n);
    updateModeSummary();
    if (stage.classList.contains('active')) drawPreview();
  }

  function updateModeSummary() {
    const n = getSliceCount();
    if (sumCompress) {
      sumCompress.textContent = isCompressed ? `Sim (${compressionQuality}%)` : 'Não';
    }
    if (currentMode === 'individual') {
      sumZipName.textContent = n + ' arquivos separados';
      cutBtnLabel.textContent = 'Cortar e baixar fatias';
    } else {
      sumZipName.textContent = 'fatias.zip';
      cutBtnLabel.textContent = 'Cortar e baixar .zip';
    }
  }

  sliceCountInput.addEventListener('input', () => {
    let val = parseInt(sliceCountInput.value, 10);
    const min = parseInt(sliceCountInput.min || 2, 10);
    const max = parseInt(sliceCountInput.max || 20, 10);
    if (isNaN(val)) return;
    if (val < min) val = min;
    if (val > max) val = max;
    syncSliceUI(val);
  });
  sliceRange.addEventListener('input', () => syncSliceUI(parseInt(sliceRange.value, 10)));
  decBtn.addEventListener('click', () => {
    const min = parseInt(sliceCountInput.min || 2, 10);
    syncSliceUI(Math.max(min, getSliceCount() - 1));
  });
  incBtn.addEventListener('click', () => {
    const max = parseInt(sliceCountInput.max || 20, 10);
    syncSliceUI(Math.min(max, getSliceCount() + 1));
  });

  fmtButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.fmt;
      compressionQuality = (currentFormat === 'jpeg') ? qualityJPG : qualityPNG;
      if (qualityRange) qualityRange.value = compressionQuality;
      updateQualityUI();
      updateModeSummary();
    });
  });

  compressButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      compressButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      isCompressed = (btn.dataset.compress === 'yes');
      if (qualityBlock) {
        qualityBlock.style.display = isCompressed ? 'block' : 'none';
      }
      updateQualityUI();
      updateModeSummary();
    });
  });

  if (qualityRange) {
    qualityRange.addEventListener('input', () => {
      compressionQuality = parseInt(qualityRange.value, 10);
      if (currentFormat === 'jpeg') {
        qualityJPG = compressionQuality;
      } else {
        qualityPNG = compressionQuality;
      }
      updateQualityUI();
      updateModeSummary();
    });
  }

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
    cutBtnLabel.textContent = isCompressed ? 'Comprimindo e cortando…' : 'Cortando…';
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

      const ext = currentFormat === 'jpeg' ? 'jpg' : 'png';
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

        let blob;
        if (currentFormat === 'png') {
          if (isCompressed && typeof UPNG !== 'undefined') {
            // UPNG compression
            const imgData = sctx.getImageData(0, 0, sliceW, naturalH);
            const cnum = Math.max(2, Math.min(256, Math.round((compressionQuality / 100) * 256)));
            const pngBuffer = UPNG.encode([imgData.data.buffer], sliceW, naturalH, cnum);
            blob = new Blob([pngBuffer], { type: 'image/png' });
          } else {
            blob = await new Promise(res => sliceCanvas.toBlob(res, 'image/png'));
          }
        } else {
          // JPG compression
          const q = isCompressed ? (compressionQuality / 100) : 0.92;
          blob = await new Promise(res => sliceCanvas.toBlob(res, 'image/jpeg', q));
        }

        const name = baseName + '-fatia-' + String(i + 1).padStart(2, '0') + '.' + ext;
        slices.push({ name, blob });

        x += sliceW;
        progressFill.style.width = Math.round(((i + 1) / n) * 70) + '%';
        // Allow UI to breathe
        await new Promise(r => setTimeout(r, 10));
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
          progressFill.style.width = (70 + Math.round(((i + 1) / slices.length) * 30)) + '%';
          // small delay so the browser doesn't block a burst of downloads
          await new Promise(r => setTimeout(r, 220));
        }
      } else {
        cutBtnLabel.textContent = 'Compactando zip…';
        const zip = new JSZip();
        slices.forEach(s => zip.file(s.name, s.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
          progressFill.style.width = (70 + Math.round(meta.percent * 0.3)) + '%';
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
  updateQualityUI();
  syncSliceUI(2);
})();
