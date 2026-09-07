// Media Grabber - Popup Script
document.addEventListener('DOMContentLoaded', () => {
  let allMedia = [];
  let currentTab = 'all';
  let minSize = 0;
  const selectedUrls = new Set();

  // DOM Elements
  const domainText = document.getElementById('domainText');
  const refreshBtn = document.getElementById('refreshBtn');
  const navTabs = document.querySelectorAll('.tab-btn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const sizeFilter = document.getElementById('sizeFilter');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const selectedCountSpan = document.getElementById('selectedCount');
  const loadingView = document.getElementById('loadingView');
  const emptyView = document.getElementById('emptyView');
  const mediaGrid = document.getElementById('mediaGrid');
  const statusInfo = document.getElementById('statusInfo');
  const countAll = document.getElementById('countAll');
  const countImage = document.getElementById('countImage');
  const countVideo = document.getElementById('countVideo');

  // Initialize
  init();

  async function init() {
    selectedUrls.clear();
    updateSelectionUI();
    showView('loading');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showError('활성 탭을 찾을 수 없습니다.');
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showError('브라우저 시스템 페이지에서는 동작하지 않습니다.');
        return;
      }

      const urlObj = new URL(tab.url);
      domainText.textContent = urlObj.hostname;

      // Inject & execute content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      if (results && results[0] && Array.isArray(results[0].result)) {
        allMedia = results[0].result;
        updateCounts();
        render();
      } else {
        allMedia = [];
        updateCounts();
        render();
      }
    } catch (err) {
      console.error(err);
      showError('미디어를 스캔하는 중 오류가 발생했습니다.');
    }
  }

  function updateCounts() {
    const images = allMedia.filter((m) => m.type === 'image');
    const videos = allMedia.filter((m) => m.type === 'video');

    countAll.textContent = allMedia.length;
    countImage.textContent = images.length;
    countVideo.textContent = videos.length;
  }

  function getFilteredMedia() {
    return allMedia.filter((item) => {
      // Type filter
      if (currentTab !== 'all' && item.type !== currentTab) return false;

      // Size filter (images only usually have width/height)
      if (minSize > 0) {
        const maxDim = Math.max(item.width || 0, item.height || 0);
        if (maxDim > 0 && maxDim < minSize) return false;
      }

      return true;
    });
  }

  function render() {
    const filtered = getFilteredMedia();

    if (filtered.length === 0) {
      showView('empty');
      statusInfo.textContent = '미디어 없음';
      return;
    }

    showView('grid');
    mediaGrid.innerHTML = '';

    filtered.forEach((item, index) => {
      const card = createMediaCard(item, index);
      mediaGrid.appendChild(card);
    });

    statusInfo.textContent = `총 ${filtered.length}개의 미디어 표시 중`;
    updateSelectionUI();
  }

  function createMediaCard(item, index) {
    const card = document.createElement('div');
    card.className = 'media-card';

    const isSelected = selectedUrls.has(item.url);
    const isVideo = item.type === 'video';

    // Preview element
    let previewHtml = '';
    if (isVideo) {
      if (item.poster) {
        previewHtml = `<img src="${escapeHtml(item.poster)}" class="media-preview-img" alt="Video poster" loading="lazy" />`;
      } else {
        previewHtml = `
          <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#8b5cf6;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        `;
      }
    } else {
      previewHtml = `<img src="${escapeHtml(item.url)}" class="media-preview-img" alt="Thumbnail" loading="lazy" onerror="this.src='icons/icon48.png'" />`;
    }

    const resText = item.width && item.height ? `${item.width}×${item.height}` : item.format.toUpperCase();

    card.innerHTML = `
      <div class="media-preview-wrap">
        ${previewHtml}
        <span class="media-badge ${isVideo ? 'badge-video' : 'badge-image'}">${isVideo ? 'VIDEO' : 'IMG'}</span>
        <label class="card-checkbox-wrap">
          <input type="checkbox" class="card-checkbox" data-url="${escapeHtml(item.url)}" ${isSelected ? 'checked' : ''} />
        </label>
      </div>
      <div class="media-info">
        <div class="media-meta">
          <span>${resText}</span>
          <span>.${item.format}</span>
        </div>
        <div class="media-actions">
          <button class="btn-card download-single-btn" data-url="${escapeHtml(item.url)}" data-type="${item.type}">다운로드</button>
          <a href="${escapeHtml(item.url)}" target="_blank" class="btn-card">보기</a>
        </div>
      </div>
    `;

    // Checkbox event
    const chk = card.querySelector('.card-checkbox');
    chk.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedUrls.add(item.url);
      } else {
        selectedUrls.delete(item.url);
      }
      updateSelectionUI();
    });

    // Single download button
    const dlBtn = card.querySelector('.download-single-btn');
    dlBtn.addEventListener('click', () => {
      downloadFile(item.url);
    });

    return card;
  }

  function updateSelectionUI() {
    const filtered = getFilteredMedia();
    const count = selectedUrls.size;

    selectedCountSpan.textContent = count;
    downloadSelectedBtn.disabled = count === 0;

    // Check if all filtered are selected
    if (filtered.length > 0 && filtered.every((item) => selectedUrls.has(item.url))) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  // Select all handler
  selectAllCheckbox.addEventListener('change', (e) => {
    const filtered = getFilteredMedia();
    if (e.target.checked) {
      filtered.forEach((item) => selectedUrls.add(item.url));
    } else {
      filtered.forEach((item) => selectedUrls.delete(item.url));
    }
    render();
  });

  // Tab switching
  navTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      navTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.type;
      render();
    });
  });

  // Size filter
  sizeFilter.addEventListener('change', (e) => {
    minSize = parseInt(e.target.value, 10) || 0;
    render();
  });

  // Refresh
  refreshBtn.addEventListener('click', () => {
    init();
  });

  // Batch download
  downloadSelectedBtn.addEventListener('click', async () => {
    const urls = Array.from(selectedUrls);
    if (urls.length === 0) return;

    downloadSelectedBtn.disabled = true;
    let success = 0;

    for (let i = 0; i < urls.length; i++) {
      statusInfo.textContent = `다운로드 중... (${i + 1}/${urls.length})`;
      try {
        await downloadFile(urls[i]);
        success++;
      } catch (err) {
        console.error('Download failed:', urls[i], err);
      }
      // Small delay to prevent browser download throttling
      await new Promise((r) => setTimeout(r, 250));
    }

    statusInfo.textContent = `다운로드 완료: ${success}개`;
    setTimeout(() => {
      statusInfo.textContent = '준비 완료';
      downloadSelectedBtn.disabled = false;
    }, 2000);
  });

  function downloadFile(url) {
    return new Promise((resolve, reject) => {
      try {
        const filename = generateFilename(url);
        chrome.downloads.download(
          {
            url: url,
            filename: `media_grabber/${filename}`,
            conflictAction: 'uniquify',
            saveAs: false
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              // Fallback: direct window anchor trigger
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              a.target = '_blank';
              a.click();
              resolve(null);
            } else {
              resolve(downloadId);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  function generateFilename(url) {
    try {
      const u = new URL(url);
      let name = u.pathname.split('/').pop() || 'download';
      if (!name.includes('.')) {
        name += '.jpg';
      }
      return name.replace(/[^a-zA-Z0-9._-]/g, '_');
    } catch (e) {
      return `media_${Date.now()}.jpg`;
    }
  }

  function showView(view) {
    loadingView.classList.add('hidden');
    emptyView.classList.add('hidden');
    mediaGrid.classList.add('hidden');

    if (view === 'loading') loadingView.classList.remove('hidden');
    else if (view === 'empty') emptyView.classList.remove('hidden');
    else if (view === 'grid') mediaGrid.classList.remove('hidden');
  }

  function showError(msg) {
    showView('empty');
    emptyView.querySelector('p').textContent = msg;
    statusInfo.textContent = '오류 발생';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
