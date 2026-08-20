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

  const idealBadgeH = document.getElementById('idealBadgeH');
  const idealHintH = document.getElementById('idealHintH');
  const heightMatch = document.getElementById('heightMatch');

  const sliceCountInput = document.getElementById('sliceCount');
  const sliceRange = document.getElementById('sliceRange');
  const decBtn = document.getElementById('decBtn');
  const incBtn = document.getElementById('incBtn');

  const sliceCountHInput = document.getElementById('sliceCountH');
  const sliceRangeH = document.getElementById('sliceRangeH');
  const decBtnH = document.getElementById('decBtnH');
  const incBtnH = document.getElementById('incBtnH');

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
  const sumHeight = document.getElementById('sumHeight');
  const sumCompress = document.getElementById('sumCompress');
  const sumZipName = document.getElementById('sumZipName');

  const cutBtn = document.getElementById('cutBtn');
  const cutBtnLabel = document.getElementById('cutBtnLabel');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const resetLink = document.getElementById('resetLink');

  let img = null;
  let originalFile = null;
  let currentBlobUrl = null;
  let naturalW = 0, naturalH = 0;
  let detectedIdealSlices = null;
  let detectedIdealSlicesH = null;
  let resizeRafId = null;

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
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    img = null;
    originalFile = null;
    naturalW = 0; naturalH = 0;
    detectedIdealSlices = null;
    detectedIdealSlicesH = null;
    stage.classList.remove('active');
    if (controlsPanel) controlsPanel.classList.remove('active');
    dropzone.style.display = 'flex';
    fileMeta.style.display = 'none';
    resetLink.style.display = 'none';
    cutBtn.disabled = true;
    dimTag.textContent = '—';
    fileInput.value = '';
    sliceCountInput.min = 1;
    sliceRange.min = 1;
    sliceCountInput.max = 20;
    sliceRange.max = 20;
    if (sliceCountHInput) sliceCountHInput.value = 1;
    if (sliceRangeH) sliceRangeH.value = 1;

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

    updateIdealUI(2, 1);
    syncSliceUI(2, 1);
  });

  function calculateIdealSlices(w) {
    if (!w || w <= 0) return 2;
    const BASE_WIDTH = 1080;
    const slices = Math.round(w / BASE_WIDTH);
    return Math.min(20, Math.max(1, slices));
  }

  function calculateIdealSlicesH(h) {
    if (!h || h <= 0) return { slices: 1, target: 1350, s1350: 1, s1920: 1 };
    const s1350 = Math.min(20, Math.max(1, Math.round(h / 1350)));
    const s1920 = Math.min(20, Math.max(1, Math.round(h / 1920)));
    const isExact1350 = (h % 1350 === 0);
    const isExact1920 = (h % 1920 === 0);

    let bestTarget = 1350;
    let bestSlices = s1350;

    if (isExact1920 && !isExact1350) {
      bestTarget = 1920;
      bestSlices = s1920;
    } else if (!isExact1350 && !isExact1920) {
      const err1350 = Math.abs((h / s1350) - 1350);
      const err1920 = Math.abs((h / s1920) - 1920);
      if (err1920 < err1350) {
        bestTarget = 1920;
        bestSlices = s1920;
      } else {
        bestTarget = 1350;
        bestSlices = s1350;
      }
    }

    return {
      slices: bestSlices,
      target: bestTarget,
      s1350: s1350,
      s1920: s1920
    };
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    originalFile = file;
    currentBlobUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      img = image;
      naturalW = image.naturalWidth;
      naturalH = image.naturalHeight;
      onImageReady(file);
    };
    image.onerror = () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
    };
    image.src = currentBlobUrl;
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
    detectedIdealSlicesH = calculateIdealSlicesH(naturalH);

    sliceCountInput.max = 20;
    sliceRange.max = 20;

    syncSliceUI(detectedIdealSlices, detectedIdealSlicesH ? detectedIdealSlicesH.slices : 1);
  }

  function drawPreview() {
    if (!img) return;
    const holderW = canvas.parentElement.clientWidth - 20;
    const holderH = 460;
    const ratio = Math.min(holderW / naturalW, holderH / naturalH, 1);
    const w = Math.round(naturalW * ratio);
    const h = Math.round(naturalH * ratio);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, naturalW, naturalH, 0, 0, w, h);

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

    const nV = getSliceCountV();
    const nH = getSliceCountH();
    const rows = nH;
    const stepW = displayW / nV;
    const stepH = displayH / rows;

    const fragment = document.createDocumentFragment();

    if (nV > 1) {
      for (let i = 1; i < nV; i++) {
        const line = document.createElement('div');
        line.className = 'cut-line vertical';
        line.style.left = (stepW * i) + 'px';
        fragment.appendChild(line);
      }
    }

    if (nH > 1) {
      for (let r = 1; r < nH; r++) {
        const line = document.createElement('div');
        line.className = 'cut-line horizontal';
        line.style.top = (stepH * r) + 'px';
        fragment.appendChild(line);
      }
    }

    let idx = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < nV; c++) {
        const label = document.createElement('div');
        label.className = 'strip-label';
        label.style.left = (stepW * c + 6) + 'px';
        label.style.top = (stepH * r + 6) + 'px';
        label.textContent = String(idx++).padStart(2, '0');
        fragment.appendChild(label);
      }
    }

    cutOverlay.appendChild(fragment);
  }

  function drawRuler(displayW) {
    ruler.innerHTML = '';
    const n = getSliceCountV();
    const stepW = displayW / n;
    ruler.style.width = displayW + 'px';
    ruler.style.margin = '0 auto';

    const fragment = document.createDocumentFragment();
    for (let i = 0; i <= n; i++) {
      const tick = document.createElement('div');
      tick.style.position = 'absolute';
      tick.style.left = (stepW * i) + 'px';
      tick.style.bottom = '0';
      tick.style.height = (i % n === 0 ? '16px' : '10px');
      tick.style.borderLeft = '1px solid var(--steel-dim)';
      fragment.appendChild(tick);
    }
    ruler.appendChild(fragment);
  }

  function getSliceCountV() {
    let n = parseInt(sliceCountInput.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 20) n = 20;
    return n;
  }

  function getSliceCountH() {
    if (!sliceCountHInput) return 1;
    let n = parseInt(sliceCountHInput.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 20) n = 20;
    return n;
  }

  function getTotalSlices() {
    const v = getSliceCountV();
    const h = getSliceCountH();
    return v * h;
  }

  if (idealHint) {
    idealHint.addEventListener('click', e => {
      const btn = e.target.closest('#applyIdealBtn');
      if (btn && detectedIdealSlices) {
        syncSliceUI(detectedIdealSlices, undefined);
      }
    });
  }

  if (idealHintH) {
    idealHintH.addEventListener('click', e => {
      const btn = e.target.closest('button[data-apply-h]');
      if (btn) {
        const val = parseInt(btn.dataset.applyH, 10);
        if (!isNaN(val)) syncSliceUI(undefined, val);
      }
    });
  }

  function updateIdealUI(nV, nH) {
    if (!naturalW || !detectedIdealSlices) {
      if (idealBadge) idealBadge.style.display = 'none';
      if (idealHint) idealHint.style.display = 'none';
      if (widthMatch) widthMatch.style.display = 'none';
    } else {
      const currentSliceW = Math.round(naturalW / nV);
      const isExact1080 = (naturalW % nV === 0) && (naturalW / nV === 1080);
      const isCloseTo1080 = currentSliceW === 1080;
      const isIdealCount = (nV === detectedIdealSlices);

      if (idealBadge) {
        idealBadge.style.display = 'inline-flex';
        if (isExact1080) {
          idealBadge.textContent = '1080px exato';
          idealBadge.classList.add('active-ideal');
        } else if (isIdealCount) {
          idealBadge.textContent = 'Ideal: ' + detectedIdealSlices + ' fatias vert.';
          idealBadge.classList.add('active-ideal');
        } else {
          idealBadge.textContent = 'Ideal: ' + detectedIdealSlices + ' fatias vert.';
          idealBadge.classList.remove('active-ideal');
        }
      }

      if (idealHint) {
        if (!isIdealCount) {
          idealHint.style.display = 'flex';
          const idealW = Math.round(naturalW / detectedIdealSlices);
          idealHint.innerHTML = `<span>Sugestão: <b>${detectedIdealSlices} fatias verticais</b> (${idealW}px cada)</span><button type="button" class="btn-apply-ideal" id="applyIdealBtn">Aplicar ${detectedIdealSlices} fatias</button>`;
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

    if (!naturalH || !detectedIdealSlicesH) {
      if (idealBadgeH) idealBadgeH.style.display = 'none';
      if (idealHintH) idealHintH.style.display = 'none';
      if (heightMatch) heightMatch.style.display = 'none';
    } else {
      const currentSliceH = Math.round(naturalH / nH);
      const isExact1350 = (naturalH % nH === 0) && (naturalH / nH === 1350);
      const isCloseTo1350 = currentSliceH === 1350;
      const isExact1920 = (naturalH % nH === 0) && (naturalH / nH === 1920);
      const isCloseTo1920 = currentSliceH === 1920;

      const idealInfo = detectedIdealSlicesH;
      const matches1350 = (nH === idealInfo.s1350);
      const matches1920 = (nH === idealInfo.s1920);
      const isIdealCountH = matches1350 || matches1920;

      if (idealBadgeH) {
        idealBadgeH.style.display = 'inline-flex';
        if (isExact1350) {
          idealBadgeH.textContent = '1350px exato';
          idealBadgeH.classList.add('active-ideal');
        } else if (isExact1920) {
          idealBadgeH.textContent = '1920px exato';
          idealBadgeH.classList.add('active-ideal');
        } else if (isIdealCountH) {
          const targetUsed = matches1920 && !matches1350 ? '1920px' : '1350px';
          idealBadgeH.textContent = `Ideal (${targetUsed}): ${nH} fatias horiz.`;
          idealBadgeH.classList.add('active-ideal');
        } else {
          idealBadgeH.textContent = `Ideal (${idealInfo.target}px): ${idealInfo.slices} fatias horiz.`;
          idealBadgeH.classList.remove('active-ideal');
        }
      }

      if (idealHintH) {
        if (!matches1350 && !matches1920) {
          idealHintH.style.display = 'flex';
          const h1350 = Math.round(naturalH / idealInfo.s1350);
          const h1920 = Math.round(naturalH / idealInfo.s1920);

          if (idealInfo.s1350 === idealInfo.s1920) {
            idealHintH.innerHTML = `<span>Sugestão: <b>${idealInfo.s1350} fatias horizontais</b> (${h1350}px cada · padrão ${idealInfo.target}px)</span><button type="button" class="btn-apply-ideal" data-apply-h="${idealInfo.s1350}">Aplicar ${idealInfo.s1350} fatias</button>`;
          } else {
            idealHintH.innerHTML = `<span>Sugestões: <b>${idealInfo.s1350} fatias</b> (${h1350}px p/ 1350px) ou <b>${idealInfo.s1920} fatias</b> (${h1920}px p/ 1920px)</span><div class="ideal-hint-actions"><button type="button" class="btn-apply-ideal" data-apply-h="${idealInfo.s1350}">1350px (${idealInfo.s1350} fat.)</button><button type="button" class="btn-apply-ideal" data-apply-h="${idealInfo.s1920}">1920px (${idealInfo.s1920} fat.)</button></div>`;
          }
        } else {
          idealHintH.style.display = 'none';
        }
      }

      if (heightMatch) {
        if (isExact1350 || isCloseTo1350) {
          heightMatch.style.display = 'inline-block';
          heightMatch.textContent = isExact1350 ? 'Padrão 1350px ✓' : '~1350px';
        } else if (isExact1920 || isCloseTo1920) {
          heightMatch.style.display = 'inline-block';
          heightMatch.textContent = isExact1920 ? 'Padrão 1920px ✓' : '~1920px';
        } else {
          heightMatch.style.display = 'none';
        }
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

  function syncSliceUI(nV, nH) {
    if (nV !== undefined) {
      sliceCountInput.value = nV;
      sliceRange.value = nV;
    }
    if (nH !== undefined && sliceCountHInput && sliceRangeH) {
      sliceCountHInput.value = nH;
      sliceRangeH.value = nH;
    }

    const v = getSliceCountV();
    const h = getSliceCountH();
    const total = v * h;

    if (h > 1 && v > 1) {
      sumCount.textContent = `${total} (${v} vert. × ${h} horiz.)`;
    } else {
      sumCount.textContent = total;
    }

    if (naturalW) {
      sumWidth.textContent = Math.ceil(naturalW / v);
    } else {
      sumWidth.textContent = '—';
    }

    if (sumHeight) {
      if (naturalH) {
        sumHeight.textContent = Math.ceil(naturalH / h);
      } else {
        sumHeight.textContent = '—';
      }
    }

    if (sumCompress) {
      sumCompress.textContent = isCompressed ? `Sim (${compressionQuality}%)` : 'Não';
    }
    updateIdealUI(v, h);
    updateModeSummary();
    if (stage.classList.contains('active')) drawPreview();
  }

  function updateModeSummary() {
    const total = getTotalSlices();
    if (sumCompress) {
      sumCompress.textContent = isCompressed ? `Sim (${compressionQuality}%)` : 'Não';
    }
    if (currentMode === 'individual') {
      sumZipName.textContent = total + ' arquivos separados';
      cutBtnLabel.textContent = 'Cortar e baixar fatias';
    } else {
      sumZipName.textContent = 'fatias.zip';
      cutBtnLabel.textContent = 'Cortar e baixar .zip';
    }
  }

  sliceCountInput.addEventListener('input', () => {
    let val = parseInt(sliceCountInput.value, 10);
    const min = parseInt(sliceCountInput.min || 1, 10);
    const max = parseInt(sliceCountInput.max || 20, 10);
    if (isNaN(val)) return;
    if (val < min) val = min;
    if (val > max) val = max;
    syncSliceUI(val, undefined);
  });
  sliceRange.addEventListener('input', () => syncSliceUI(parseInt(sliceRange.value, 10), undefined));
  decBtn.addEventListener('click', () => {
    const min = parseInt(sliceCountInput.min || 1, 10);
    syncSliceUI(Math.max(min, getSliceCountV() - 1), undefined);
  });
  incBtn.addEventListener('click', () => {
    const max = parseInt(sliceCountInput.max || 20, 10);
    syncSliceUI(Math.min(max, getSliceCountV() + 1), undefined);
  });

  if (sliceCountHInput && sliceRangeH) {
    sliceCountHInput.addEventListener('input', () => {
      let val = parseInt(sliceCountHInput.value, 10);
      const min = parseInt(sliceCountHInput.min || 1, 10);
      const max = parseInt(sliceCountHInput.max || 20, 10);
      if (isNaN(val)) return;
      if (val < min) val = min;
      if (val > max) val = max;
      syncSliceUI(undefined, val);
    });
    sliceRangeH.addEventListener('input', () => syncSliceUI(undefined, parseInt(sliceRangeH.value, 10)));
    if (decBtnH) {
      decBtnH.addEventListener('click', () => {
        const min = parseInt(sliceCountHInput.min || 1, 10);
        syncSliceUI(undefined, Math.max(min, getSliceCountH() - 1));
      });
    }
    if (incBtnH) {
      incBtnH.addEventListener('click', () => {
        const max = parseInt(sliceCountHInput.max || 20, 10);
        syncSliceUI(undefined, Math.min(max, getSliceCountH() + 1));
      });
    }
  }

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

  window.addEventListener('resize', () => {
    if (!img) return;
    if (resizeRafId) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(drawPreview);
  });

  const sliceCanvas = document.createElement('canvas');
  const sctx = sliceCanvas.getContext('2d', { willReadFrequently: true });

  cutBtn.addEventListener('click', async () => {
    if (!img) return;
    const nV = getSliceCountV();
    const nH = getSliceCountH();
    const rows = nH > 0 ? nH : 1;
    const cols = nV;
    const totalSlices = cols * rows;

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
      const colWidths = [];
      const colXs = [];
      let currX = 0;
      let remW = naturalW - Math.floor(naturalW / cols) * cols;
      for (let c = 0; c < cols; c++) {
        const w = Math.floor(naturalW / cols) + (remW > 0 ? 1 : 0);
        if (remW > 0) remW--;
        colWidths.push(w);
        colXs.push(currX);
        currX += w;
      }

      const rowHeights = [];
      const rowYs = [];
      let currY = 0;
      let remH = naturalH - Math.floor(naturalH / rows) * rows;
      for (let r = 0; r < rows; r++) {
        const h = Math.floor(naturalH / rows) + (remH > 0 ? 1 : 0);
        if (remH > 0) remH--;
        rowHeights.push(h);
        rowYs.push(currY);
        currY += h;
      }

      const ext = currentFormat === 'jpeg' ? 'jpg' : 'png';
      const baseName = originalFile ? originalFile.name.replace(/\.[^.]+$/, '') : 'imagem';

      const slices = [];
      let sliceIndex = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          sliceIndex++;
          const sliceW = colWidths[c];
          const sliceH = rowHeights[r];
          const sliceX = colXs[c];
          const sliceY = rowYs[r];

          sliceCanvas.width = sliceW;
          sliceCanvas.height = sliceH;
          sctx.clearRect(0, 0, sliceW, sliceH);
          sctx.drawImage(img, sliceX, sliceY, sliceW, sliceH, 0, 0, sliceW, sliceH);

          let blob;
          if (currentFormat === 'png') {
            if (isCompressed && typeof UPNG !== 'undefined') {
              const imgData = sctx.getImageData(0, 0, sliceW, sliceH);
              const cnum = Math.max(2, Math.min(256, Math.round((compressionQuality / 100) * 256)));
              const pngBuffer = UPNG.encode([imgData.data.buffer], sliceW, sliceH, cnum);
              blob = new Blob([pngBuffer], { type: 'image/png' });
            } else {
              blob = await new Promise(res => sliceCanvas.toBlob(res, 'image/png'));
            }
          } else {
            const q = isCompressed ? (compressionQuality / 100) : 0.92;
            blob = await new Promise(res => sliceCanvas.toBlob(res, 'image/jpeg', q));
          }

          const name = baseName + '-fatia-' + String(sliceIndex).padStart(2, '0') + '.' + ext;
          slices.push({ name, blob });

          progressFill.style.width = Math.round((sliceIndex / totalSlices) * 70) + '%';
          await new Promise(r => setTimeout(r, 10));
        }
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
  syncSliceUI(2, 1);
})();
