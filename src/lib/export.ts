import mermaid from "mermaid";

export async function exportToPNG(code: string, filename: string, pixelRatio: number = 2) {
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

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

export async function exportToSVG(code: string, filename: string) {
  try {
    const id = `mermaid-export-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = `${filename}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error("Failed to export SVG");
  }
}

