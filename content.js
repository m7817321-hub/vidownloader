// Media Grabber - Content Script (광고/배너 차단 및 한글 파일명 지원)
(function () {
  // 제외할 광고 및 트래커 도메인/키워드 목록
  const AD_PATTERNS = [
    'doubleclick', 'googlesyndication', 'adnxs', 'adsystem', 'criteo', 
    'taboola', 'outbrain', 'analytics', 'pixel', 'facebook.com/tr/', 
    'adclick', 'banner', 'sponsor', 'tracker'
  ];

  function isAdUrl(url) {
    const lower = url.toLowerCase();
    return AD_PATTERNS.some(pattern => lower.includes(pattern));
  }

  function isAdElement(el) {
    // 광고 태그 및 클래스 검사
    const adClosest = el.closest('ins.adsbygoogle, .ad, .ads, [class*="banner"], [id*="banner"], [class*="sponsor"], iframe');
    return !!adClosest;
  }

  function getAbsoluteUrl(url) {
    try {
      return new URL(url, document.baseURI).href;
    } catch (e) {
      return url;
    }
  }

  function getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop().toLowerCase();
      if (ext && ext.length <= 4 && !ext.includes('/')) {
        return ext;
      }
    } catch (e) {}
    return '';
  }

  function extractMedia() {
    const mediaMap = new Map();

    // 1. <img> 요소 스캔
    document.querySelectorAll('img').forEach((img) => {
      if (isAdElement(img)) return;

      const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
      if (!src || src.startsWith('data:image/svg') || src.startsWith('data:image/gif;base64,R0lG')) return;

      const fullUrl = getAbsoluteUrl(src);
      if (isAdUrl(fullUrl)) return;

      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;

      // 50px 미만 아이콘 제외
      if ((w > 0 && w < 50) || (h > 0 && h < 50)) return;

      // 배너 비율 필터 (가로/세로 비율이 4:1 이상이거나 1:4 이상인 띠배너 제외)
      if (w > 0 && h > 0) {
        const ratio = w / h;
        if (ratio > 4 || ratio < 0.25) return;
      }

      if (!mediaMap.has(fullUrl)) {
        mediaMap.set(fullUrl, {
          url: fullUrl,
          type: 'image',
          width: w,
          height: h,
          format: getFileExtension(fullUrl) || 'jpg',
          title: decodeURIComponent(img.alt || document.title || 'Image')
        });
      }
    });

    // 2. <video> 요소 스캔
    document.querySelectorAll('video').forEach((video) => {
      let videoUrl = video.currentSrc || video.src;
      if (!videoUrl) {
        const source = video.querySelector('source');
        if (source) videoUrl = source.src;
      }

      if (videoUrl && !videoUrl.startsWith('blob:')) {
        const fullUrl = getAbsoluteUrl(videoUrl);
        if (isAdUrl(fullUrl)) return;

        const w = video.videoWidth || video.clientWidth || 0;
        const h = video.videoHeight || video.clientHeight || 0;

        if (!mediaMap.has(fullUrl)) {
          mediaMap.set(fullUrl, {
            url: fullUrl,
            type: 'video',
            poster: video.poster ? getAbsoluteUrl(video.poster) : null,
            width: w,
            height: h,
            format: getFileExtension(fullUrl) || 'mp4',
            title: decodeURIComponent(video.title || document.title || 'Video')
          });
        }
      }
    });

    return Array.from(mediaMap.values());
  }

  return extractMedia();
})();
