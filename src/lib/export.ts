import mermaid from "mermaid";

export async function exportToPNG(
  code: string,
  filename: string,
  pixelRatio: number = 2,
  backgroundColor: 'white' | 'transparent' = 'white'
) {
  try {
    const id = `mermaid-export-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);

    // Create a temporary container for the SVG
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = svg;
    document.body.appendChild(tempDiv);

    const svgElement = tempDiv.querySelector("svg");
    if (!svgElement) {
      throw new Error("SVG element not found");
    }

    // Get SVG dimensions
    const bbox = svgElement.getBBox();
    const width = Math.ceil(bbox.width || parseInt(svgElement.getAttribute("width") || "800"));
    const height = Math.ceil(bbox.height || parseInt(svgElement.getAttribute("height") || "600"));

    // Ensure SVG has proper dimensions and viewBox
    svgElement.setAttribute("width", width.toString());
    svgElement.setAttribute("height", height.toString());

    // Remove white background from SVG if transparent is requested
    if (backgroundColor === 'transparent') {
      // Remove any rect elements with white/light background that might be backgrounds
      const rects = svgElement.querySelectorAll('rect');
      rects.forEach((rect) => {
        const fill = rect.getAttribute('fill');
        const style = rect.getAttribute('style');
        // Check if it's a background rect (usually first rect, full size, white/light color)
        if (
          fill && (
            fill.toLowerCase() === '#ffffff' ||
            fill.toLowerCase() === 'white' ||
            fill.toLowerCase() === '#fff' ||
            fill.toLowerCase() === 'rgb(255, 255, 255)' ||
            fill.toLowerCase() === 'rgb(255,255,255)'
          )
        ) {
          // Check if it's likely a background (full width/height)
          const rectWidth = rect.getAttribute('width');
          const rectHeight = rect.getAttribute('height');
          if (rectWidth === '100%' || rectHeight === '100%' ||
            parseInt(rectWidth || '0') >= width * 0.9) {
            rect.remove();
          }
        }
        // Also check style attribute
        if (style && (style.includes('fill: rgb(255, 255, 255)') ||
          style.includes('fill:#ffffff') ||
          style.includes('fill: white'))) {
          const rectWidth = rect.getAttribute('width');
          if (rectWidth === '100%' || parseInt(rectWidth || '0') >= width * 0.9) {
            rect.remove();
          }
        }
      });

      // Remove background style from SVG itself
      svgElement.removeAttribute('style');
      svgElement.style.background = 'none';
    }

    // Get the SVG as a string
    const svgString = new XMLSerializer().serializeToString(svgElement);

    // Encode SVG as data URL to avoid CORS issues
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

    // Create an image element
    const img = new Image();
    img.width = width;
    img.height = height;

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgDataUrl;
    });

    // Create canvas and draw the image
    const canvas = document.createElement("canvas");
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Fill with background color (white or transparent)
    if (backgroundColor === 'white') {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // For transparent, we don't fill the background

    // Scale for higher quality
    ctx.scale(pixelRatio, pixelRatio);

    // Draw the SVG image onto the canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Convert canvas to PNG blob
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!pngBlob) {
      throw new Error("Failed to create PNG blob");
    }

    // Create download link
    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = pngUrl;
    link.click();

    // Cleanup
    URL.revokeObjectURL(pngUrl);
    document.body.removeChild(tempDiv);
  } catch (error) {
    console.error("PNG export error:", error);
    throw new Error("Failed to export PNG");
  }
}

export async function exportToSVG(
  code: string,
  filename: string,
  backgroundColor: 'white' | 'transparent' = 'transparent'
) {
  try {
    const id = `mermaid-export-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);

    let svgContent = svg;

    // Add white background if requested
    if (backgroundColor === 'white') {
      // Parse the SVG to add background
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (svgElement) {
        // Create a rect element for white background
        const rect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'white');

        // Insert rect as first child
        svgElement.insertBefore(rect, svgElement.firstChild);

        svgContent = new XMLSerializer().serializeToString(svgDoc);
      }
    }

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = `${filename}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  } catch {
    throw new Error("Failed to export SVG");
  }
}

