import JSZip from 'jszip';

const loadKmlFiles = async (zip, filePath, baseDir = '', loadedFiles = new Set()) => {
  const normalizedPath = normalizePath(baseDir, filePath);

  if (loadedFiles.has(normalizedPath)) {
    return [];
  }
  loadedFiles.add(normalizedPath);

  const kmlFile = zip.file(normalizedPath);
  if (!kmlFile) {
    return [];
  }

  const kmlText = await kmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'application/xml');

  const currentDir = normalizedPath.split('/').slice(0, -1).join('/');

  const networkLinks = xmlDoc.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "NetworkLink") ||
                      xmlDoc.getElementsByTagName("NetworkLink");

  const linkedKmlPromises = Array.from(networkLinks).map(async (link) => {
    const href = link.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "href")[0]?.textContent ||
                link.getElementsByTagName("href")[0]?.textContent;

    if (href) {
      return loadKmlFiles(zip, href, currentDir, loadedFiles);
    }
    return [];
  });

  const linkedResults = await Promise.all(linkedKmlPromises);

  return [{
    kmlText,
    basePath: currentDir
  }].concat(linkedResults.flat());
};

const normalizePath = (baseDir, relativePath) => {
  relativePath = relativePath.replace(/^\/+/, '');

  if (relativePath.startsWith('../')) {
    const baseSegments = baseDir.split('/').filter(Boolean);
    const relativeSegments = relativePath.split('/');

    let segments = [...baseSegments];
    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }
    return segments.join('/');
  }

  if (baseDir && !relativePath.includes('/')) {
    return `${baseDir}/${relativePath}`;
  }

  return relativePath;
};

export { loadKmlFiles, normalizePath };
