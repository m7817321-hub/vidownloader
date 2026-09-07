// Media Grabber - Content Script / DOM Scanner
(function () {
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

  function extractMediaFromPage() {
    const mediaMap = new Map();

    // 1. Scan <img> elements
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
      if (!src || src.startsWith('data:image/svg') || src.startsWith('data:image/gif;base64,R0lG')) return;

      const fullUrl = getAbsoluteUrl(src);
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;

      // Filter out tiny icons or tracking pixels
      if ((w > 0 && w < 40) || (h > 0 && h < 40)) return;

      if (!mediaMap.has(fullUrl)) {
        mediaMap.set(fullUrl, {
          url: fullUrl,
          type: 'image',
          width: w,
          height: h,
          format: getFileExtension(fullUrl) || 'jpg',
          title: img.alt || document.title || 'Image'
        });
      }
    });

    // 2. Scan <picture> sources
    document.querySelectorAll('picture source').forEach((source) => {
      const srcset = source.srcset;
      if (srcset) {
        const candidates = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]);
        const lastCandidate = candidates[candidates.length - 1];
        if (lastCandidate) {
          const fullUrl = getAbsoluteUrl(lastCandidate);
          if (!mediaMap.has(fullUrl)) {
            mediaMap.set(fullUrl, {
              url: fullUrl,
              type: 'image',
              width: 0,
              height: 0,
              format: getFileExtension(fullUrl) || 'webp',
              title: document.title || 'Image'
            });
          }
        }
      }
    });

    // 3. Scan CSS background images
    document.querySelectorAll('*').forEach((el) => {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.startsWith('url(')) {
        const match = bg.match(/url\(["']?([^"']+)["']?\)/);
        if (match && match[1]) {
          const fullUrl = getAbsoluteUrl(match[1]);
          if (!mediaMap.has(fullUrl) && !fullUrl.startsWith('data:')) {
            const rect = el.getBoundingClientRect();
            if (rect.width >= 50 && rect.height >= 50) {
              mediaMap.set(fullUrl, {
                url: fullUrl,
                type: 'image',
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                format: getFileExtension(fullUrl) || 'jpg',
                title: 'Background Image'
              });
            }
          }
        }
      }
    });

    // 4. Scan <video> elements
    document.querySelectorAll('video').forEach((video) => {
      let videoUrl = video.currentSrc || video.src;
      if (!videoUrl) {
        const source = video.querySelector('source');
        if (source) videoUrl = source.src;
      }

      if (videoUrl) {
        const fullUrl = getAbsoluteUrl(videoUrl);
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
            title: video.title || document.title || 'Video'
          });
        }
      }
    });

    // 5. Scan <a> links pointing directly to video/image files
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      const ext = getFileExtension(href);
      if (['mp4', 'webm', 'mov', 'm4v', 'mkv'].includes(ext)) {
        const fullUrl = getAbsoluteUrl(href);
        if (!mediaMap.has(fullUrl)) {
          mediaMap.set(fullUrl, {
            url: fullUrl,
            type: 'video',
            width: 0,
            height: 0,
            format: ext,
            title: a.innerText.trim() || 'Linked Video'
          });
        }
      } else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        const fullUrl = getAbsoluteUrl(href);
        if (!mediaMap.has(fullUrl)) {
          mediaMap.set(fullUrl, {
            url: fullUrl,
            type: 'image',
            width: 0,
            height: 0,
            format: ext,
            title: a.innerText.trim() || 'Linked Image'
          });
        }
      }
    });

    return Array.from(mediaMap.values());
  }

  // Return extracted media items immediately
  return extractMediaFromPage();
})();
