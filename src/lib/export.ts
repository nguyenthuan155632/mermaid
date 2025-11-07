import mermaid from "mermaid";
import { toPng } from "html-to-image";

export async function exportToPNG(code: string, filename: string) {
  try {
    const id = `mermaid-export-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = svg;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);

    const svgElement = tempDiv.querySelector("svg");
    if (!svgElement) {
      throw new Error("SVG element not found");
    }

    const dataUrl = await toPng(tempDiv as HTMLElement, {
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();

    document.body.removeChild(tempDiv);
  } catch (error) {
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

