import "@/assets/pages/chat.less";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DrawingSidebar, {
  DrawingSubmitPayload,
} from "@/components/drawing/DrawingSidebar.tsx";
import DrawingMain, {
  DrawingMainState,
} from "@/components/drawing/DrawingMain.tsx";
import { apiEndpoint, tokenField } from "@/conf/bootstrap.ts";
import { getMemory } from "@/utils/memory.ts";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/base.ts";
import type { Model } from "@/api/types.tsx";

const initialState: DrawingMainState = {
  status: "idle",
  images: [],
  message: "",
  modelName: undefined,
};

function Drawing() {
  const { t } = useTranslation();
  const [mainState, setMainState] =
    useState<DrawingMainState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleModelChange = useCallback(
    (_id: string, model: Model | null) => {
      setCurrentModel(model);
      setMainState((prev) => ({
        ...prev,
        modelName: model?.name,
      }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (payload: DrawingSubmitPayload) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      setSubmitting(true);
      setMainState({
        status: "running",
        images: [],
        message: "",
        modelName: currentModel?.name,
      });

      const token = getMemory(tokenField);
      const requestBody = {
        model: payload.modelId,
        temperature: 1,
        messages: [
          { role: "system", content: " " },
          {
            role: "user",
            content: `${payload.prompt};${payload.quantity} image, ratio ${payload.ratio}`,
          },
        ],
        stream: true,
        stream_options: {
          include_usage: true,
        },
      };

      const extractData = (chunk: string): string | null => {
        const trimmed = chunk.trim();
        if (!trimmed.length) return null;
        if (!trimmed.includes("data:")) return trimmed;
        return trimmed
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, "").trim())
          .join("\n")
          .trim();
      };

      const sanitizeText = (raw: string): string =>
        raw.replace(/!\[image\]\([^)]+\)/g, "").trim();

      try {
        const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: token } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(response.statusText || "Request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let shouldStop = false;
        let aggregated = "";
        const imageUrls: string[] = [];

        const handleChunk = (jsonString: string) => {
          try {
            const data = JSON.parse(jsonString);
            const delta = data?.choices?.[0]?.delta;
            if (delta?.content) {
              aggregated += delta.content;
              const matches = delta.content.matchAll(
                /!\[image\]\(([^)]+)\)/g,
              );
              for (const match of matches) {
                const url = match[1];
                if (url && !imageUrls.includes(url)) {
                  imageUrls.push(url);
                }
              }
            }
          } catch (error) {
            console.warn("[drawing] failed to parse chunk", error);
          }
        };

        while (!shouldStop) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataString = extractData(rawEvent);
            if (dataString === "[DONE]") {
              shouldStop = true;
              break;
            }
            if (dataString) {
              handleChunk(dataString);
            }
            boundary = buffer.indexOf("\n\n");
          }
        }

        if (!shouldStop && buffer.trim().length > 0) {
          const dataString = extractData(buffer);
          if (dataString && dataString !== "[DONE]") {
            handleChunk(dataString);
          }
        }

        const cleanedMessage = sanitizeText(aggregated);
        const finalImages = imageUrls.slice(0, payload.quantity);

        setMainState({
          status: "success",
          images: finalImages,
          message: cleanedMessage,
          modelName: currentModel?.name,
        });
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return;
        }
        const friendly = getErrorMessage(error);
        setMainState({
          status: "error",
          images: [],
          message: "",
          modelName: currentModel?.name,
          error: friendly,
        });
        toast.error(t("drawing.errorMessage"), {
          description: friendly,
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setSubmitting(false);
        }
      }
    },
    [currentModel, t],
  );

  return (
    <div className="home-page flex flex-row flex-1">
      <DrawingSidebar
        onSubmit={handleSubmit}
        submitting={submitting}
        onModelChange={handleModelChange}
      />
      <DrawingMain {...mainState} />
    </div>
  );
}

export default Drawing;
