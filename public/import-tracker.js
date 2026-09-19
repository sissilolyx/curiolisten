const STORAGE_KEY = "meeting-listening-import-jobs-v1";
const ACTIVE_STATUSES = new Set(["queued", "running"]);

export function isImportActive(entry) {
  return ACTIVE_STATUSES.has(entry.status);
}

// Job tracking is independent of the short-lived request/upload lock in the form.
export class ImportTracker {
  constructor(storage) {
    this.storage = storage;
    this.entries = new Map();
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return;
      for (const item of saved) {
        if (!/^job-[\w-]+$/.test(item?.jobId) || !/^material-[\w-]+$/.test(item?.materialId)) continue;
        this.entries.set(item.materialId, {
          jobId: item.jobId, materialId: item.materialId,
          title: "正在读取材料", status: "running", stage: "正在恢复处理进度", progress: null,
        });
      }
    } catch { /* Storage is optional; material summaries still recover active imports. */ }
  }

  get active() {
    return [...this.entries.values()].filter(isImportActive);
  }

  track(job, material) {
    this.entries.set(material.id, {
      materialId: material.id, jobId: job.id, title: material.title,
      status: job.status, stage: job.stage, progress: job.progress, error: job.error,
      canOpen: false,
    });
    this.persist();
  }

  updateJob(job) {
    const entry = this.entries.get(job.materialId);
    // A late response must not bring back a dismissed or deleted material.
    if (!entry || entry.jobId !== job.id) return;
    Object.assign(entry, {
      status: job.status, stage: job.stage, progress: job.progress,
      error: job.error, connectionError: "",
    });
    this.persist();
  }

  jobUnavailable(jobId, error) {
    const entry = [...this.entries.values()].find((item) => item.jobId === jobId);
    if (!entry) return;
    if (error.status === 404) {
      // Recover from the material status if an old job record is unavailable.
      entry.jobId = null;
      entry.progress = null;
    }
    entry.connectionError = "暂时无法更新进度，正在自动重试。";
    this.persist();
  }

  syncMaterials(materials) {
    const byId = new Map(materials.map((material) => [material.id, material]));
    for (const material of materials) {
      const active = material.status === "processing" || material.analysisStatus === "processing";
      if (!this.entries.has(material.id) && active) {
        this.entries.set(material.id, { materialId: material.id, jobId: null, progress: null });
      }
      const entry = this.entries.get(material.id);
      if (!entry) continue;
      entry.title = material.title;
      entry.canOpen = material.status === "ready" && material.sentenceCount > 0;
      entry.warning = material.warning;
      if (!entry.jobId) {
        entry.status = material.status === "failed" ? "failed" : active ? "running" : "completed";
        entry.stage = material.stage;
        entry.error = material.error;
        entry.connectionError = "";
        entry.progress = active ? null : entry.status === "completed" ? 1 : null;
      }
    }
    for (const [id, entry] of this.entries) {
      if (!byId.has(id) && (!entry.jobId || !isImportActive(entry))) this.entries.delete(id);
    }
    this.persist();
  }

  remove(materialId) {
    this.entries.delete(materialId);
    this.persist();
  }

  persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.active
        .filter((entry) => entry.jobId)
        .map(({ jobId, materialId }) => ({ jobId, materialId }))));
    } catch { /* Imports continue even when browser storage is unavailable. */ }
  }
}
