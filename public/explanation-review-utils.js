const EXPLANATION_REVIEW_PREFIX = "review-explanation-";

export function isExplanationReview(item) {
  return item?.kind === "qa" && item.id === `${EXPLANATION_REVIEW_PREFIX}${item.sentenceId}`;
}

export function findExplanationReview(material, sentenceId) {
  return (material?.reviewItems || []).find((item) => item.sentenceId === sentenceId && isExplanationReview(item));
}

export function explanationReviewText(sentence, saved, reviewMode = false) {
  const current = sentence?.analysis?.explanationZh || sentence?.previousAnalysis?.explanationZh || "";
  const snapshot = saved?.answerZh || "";
  return reviewMode ? snapshot || current : current || snapshot;
}

export function createExplanationReview(sentence, text) {
  const explanation = String(text || "").trim();
  if (!sentence?.id || !sentence?.text || !explanation) throw new Error("这句讲解尚未准备好");
  // Reuse the existing sentence-linked question/answer review format, with a
  // study prompt and the already generated explanation. No AI request is needed.
  if (explanation.length > 5000) throw new Error("这段讲解超过 5000 字，暂时无法完整加入复习");
  return {
    id: `${EXPLANATION_REVIEW_PREFIX}${sentence.id}`,
    kind: "qa",
    sentenceId: sentence.id,
    sourceText: sentence.text,
    question: "这句中的重要表达与语法应该怎样理解？",
    answerZh: explanation,
    learningSummaryZh: "结合原句和原声，复习这句的重要表达与语法。",
  };
}
