import { motion } from "framer-motion";
import { Loader2, ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export type DrawingMainState = {
  status: "idle" | "running" | "success" | "error";
  images: string[];
  message: string;
  error?: string;
  modelName?: string;
};

export default function DrawingMain({
  status,
  images,
  message,
  error,
  modelName,
}: DrawingMainState) {
  const { t } = useTranslation();

  const isEmpty = status === "idle" && images.length === 0 && !message.length;
  const isSuccess = status === "success" && (images.length > 0 || message);

  return (
    <motion.div
      className="drawing-main"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="drawing-main-board">
        {status === "running" && (
          <div className="drawing-progress-card">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p>{t("drawing.generatingHint")}</p>
          </div>
        )}

        {status === "error" && (
          <div className="drawing-error-card">
            <ImageIcon className="w-5 h-5" />
            <div>
              <p className="drawing-error-title">
                {t("drawing.errorMessage")}
              </p>
              {error && <p className="drawing-error-desc">{error}</p>}
            </div>
          </div>
        )}

        {isSuccess && (
          <>
            {images.length > 0 && (
              <div className="drawing-image-grid">
                {images.map((url, index) => (
                  <div key={url} className="drawing-image-card">
                    <img src={url} alt={`result-${index + 1}`} />
                  </div>
                ))}
              </div>
            )}

            {message && (
              <div className="drawing-result-text">
                <p className="drawing-result-label">
                  {t("drawing.resultLabel", {
                    name: modelName ?? "grok",
                  })}
                </p>
                <p className="drawing-result-message">{message}</p>
              </div>
            )}
          </>
        )}

        {isEmpty && (
          <div className="drawing-main-placeholder">
            <p className="drawing-main-title">{t("drawing.mainTitle")}</p>
            <p className="drawing-main-desc">{t("drawing.mainDesc")}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
