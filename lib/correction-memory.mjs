import { listMaterials, updateMaterial } from "./storage.mjs";
import { buildRecognitionHints, extractCorrectionHints } from "../public/transcript-correction-utils.js";

export async function listCorrectionMemory() {
  const materials = await listMaterials();
  return materials.flatMap(material => (material.transcriptCorrections || []).map(correction => ({
    ...correction,
    materialId: material.id,
    materialTitle: material.title,
    hints: extractCorrectionHints(correction.previousText, correction.correctedText),
  }))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function loadRecognitionHints() {
  return buildRecognitionHints(await listCorrectionMemory());
}

export async function setCorrectionEnabled(materialId, correctionId, enabled) {
  return updateMaterial(materialId, material => {
    const correction = (material.transcriptCorrections || []).find(item => item.id === correctionId);
    if (!correction) throw Object.assign(new Error("没有找到这条纠错记忆"), { statusCode: 404 });
    if (enabled && !extractCorrectionHints(correction.previousText, correction.correctedText).length) {
      throw Object.assign(new Error("这次修改没有可用于识别的简短词语"), { statusCode: 400 });
    }
    correction.enabled = enabled;
    return correction;
  });
}
